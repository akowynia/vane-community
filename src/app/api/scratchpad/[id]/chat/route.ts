export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import db, { ensureScratchpadTables } from '@/lib/db';
import { scratchpads, scratchpadVersions, scratchpadMessages, waypoints } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { NextRequest } from 'next/server';
import {
  resolveRequestUser,
  canAccessProvider,
  canAccessModel,
  checkTokenUsage,
} from '@/lib/security/rbac';
import configManager from '@/lib/config';
import ModelRegistry from '@/lib/models/registry';
import { ModelWithProvider } from '@/lib/models/types';
import SessionManager from '@/lib/session';
import { classify } from '@/lib/agents/search/classifier';
import Researcher from '@/lib/agents/search/researcher';
import { SearchSources } from '@/lib/agents/search/types';
import { evaluateScratchpadClarification } from '@/lib/agents/scratchpad/clarifier';
import { evaluatePresentationClarification } from '@/lib/agents/scratchpad/presentationClarifier';
import { generatePresentationPlan } from '@/lib/agents/scratchpad/presentationPlanner';
import { presentationGeneratorPrompt } from '@/lib/prompts/scratchpad/presentationGenerator';
import { recordLlmMetric } from '@/lib/stats/tracker';
import { getTokenCount } from '@/lib/utils/splitText';
import { z } from 'zod';
import crypto from 'crypto';

const chatModelSchema: z.ZodType<ModelWithProvider> = z.object({
  providerId: z.string({ message: 'Chat model provider id must be provided' }),
  key: z.string({ message: 'Chat model key must be provided' }),
});

const embeddingModelSchema: z.ZodType<ModelWithProvider> = z.object({
  providerId: z.string({ message: 'Embedding model provider id must be provided' }),
  key: z.string({ message: 'Embedding model key must be provided' }),
});

const clarificationResponseSchema = z.object({
  question: z.string().optional(),
  selectedOption: z.string().optional(),
  customText: z.string().optional(),
});

const presentationConfigSchema = z.object({
  slideCount: z.number().optional(),
  theme: z.string().optional(),
  targetAudience: z.string().optional(),
  maxClarificationRounds: z.number().optional(),
  tokenBudgetCap: z.number().optional(),
  researchIntensity: z.string().optional(),
  includeSpeakerNotes: z.boolean().optional(),
  includeCitations: z.boolean().optional(),
});

const scratchpadChatSchema = z.object({
  message: z.object({
    messageId: z.string().min(1),
    content: z.string().min(1),
  }),
  chatModel: chatModelSchema,
  embeddingModel: embeddingModelSchema,
  optimizationMode: z.enum(['speed', 'balanced', 'quality']).default('balanced'),
  sources: z.array(z.string()).default([]),
  selectedText: z.string().nullable().optional(),
  currentContent: z.string().default(''),
  currentTitle: z.string().default(''),
  waypointId: z.string().nullable().optional(),
  files: z.array(z.string()).default([]),
  clarificationResponse: clarificationResponseSchema.optional(),
  skipClarification: z.boolean().optional().default(false),
  isPresentation: z.boolean().optional(),
  planApproved: z.boolean().optional().default(false),
  approvedPlan: z.any().optional(),
  presentationConfig: presentationConfigSchema.optional(),
});

export const POST = async (
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  try {
    ensureScratchpadTables();
    const { id } = await params;
    const user = await resolveRequestUser(req as NextRequest);
    const instanceMode = configManager.getConfig('instanceMode', 'single');

    if (instanceMode === 'multi' && !user) {
      return Response.json({ message: 'Login required.' }, { status: 401 });
    }

    const sketch = await db.query.scratchpads.findFirst({
      where: eq(scratchpads.id, id),
    });

    if (!sketch) {
      return Response.json({ message: 'Scratchpad not found.' }, { status: 404 });
    }

    if (instanceMode === 'multi' && user && user.role !== 'admin' && sketch.userId !== user.id) {
      return Response.json({ message: 'You do not have permission to access this scratchpad.' }, { status: 403 });
    }

    const body = await req.json();
    const parsed = scratchpadChatSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { message: 'Invalid request data', errors: parsed.error.issues },
        { status: 400 },
      );
    }

    const data = parsed.data;

    // RBAC & token check
    if (user && user.role !== 'admin') {
      if (!canAccessProvider(user, data.chatModel.providerId) || !canAccessModel(user, data.chatModel.key)) {
        return Response.json({ message: 'You do not have permission to use the selected AI model.' }, { status: 403 });
      }

      const usage = await checkTokenUsage(user);
      if (usage.limit5hExceeded || usage.limitWeeklyExceeded || usage.dayLimitExceeded) {
        return Response.json({ message: 'User token limit exceeded.' }, { status: 429 });
      }
    }

    const registry = new ModelRegistry();
    let llm: any;
    let embedding: any;
    try {
      [llm, embedding] = await Promise.all([
        registry.loadChatModel(data.chatModel.providerId, data.chatModel.key),
        registry.loadEmbeddingModel(data.embeddingModel.providerId, data.embeddingModel.key),
      ]);
    } catch (loadErr: any) {
      return Response.json(
        { message: loadErr?.message || 'Failed to load the AI model.' },
        { status: 400 },
      );
    }

    // Resolve active waypoint instructions if linked
    let activeWaypointId = data.waypointId || sketch.waypointId;
    let waypointInstructions = '';
    if (activeWaypointId) {
      try {
        const wp = await db.query.waypoints.findFirst({
          where: eq(waypoints.id, activeWaypointId),
        });
        if (wp?.systemInstructions) {
          waypointInstructions = wp.systemInstructions;
        }
      } catch {}
    }

    const session = SessionManager.createSession();
    const responseStream = new TransformStream();
    const writer = responseStream.writable.getWriter();
    const encoder = new TextEncoder();

    let isClosed = false;
    const safeWrite = async (chunkStr: string) => {
      if (isClosed) return;
      try {
        await writer.write(encoder.encode(chunkStr));
      } catch {
        isClosed = true;
      }
    };

    const safeClose = async () => {
      if (isClosed) return;
      isClosed = true;
      try {
        await writer.close();
      } catch {}
    };

    const disconnect = session.subscribe((event: string, eventData: any) => {
      if (event === 'data') {
        if (eventData.type === 'block') {
          safeWrite(JSON.stringify({ type: 'block', block: eventData.block }) + '\n');
        } else if (eventData.type === 'updateBlock') {
          safeWrite(JSON.stringify({ type: 'updateBlock', blockId: eventData.blockId, patch: eventData.patch }) + '\n');
        } else if (eventData.type === 'researchComplete') {
          safeWrite(JSON.stringify({ type: 'researchComplete' }) + '\n');
        }
      }
    });

    (async () => {
      let fullResponseText = '';
      let collectedSources: any[] = [];
      const now = new Date().toISOString();

      try {
        const isPresentation = sketch.type === 'presentation' || data.isPresentation;
        const rawMetadata =
          typeof sketch.metadata === 'string'
            ? JSON.parse(sketch.metadata || '{}')
            : sketch.metadata || {};

        const cleanConfig = data.presentationConfig
          ? Object.fromEntries(
              Object.entries(data.presentationConfig).filter(
                ([k, v]) =>
                  v !== undefined &&
                  k !== 'currentClarificationRound' &&
                  k !== 'clarifications' &&
                  k !== 'plan' &&
                  k !== 'planStatus',
              ),
            )
          : {};

        const metadata = {
          slideCount: 8,
          theme: 'dark-modern',
          targetAudience: 'general',
          maxClarificationRounds: 2,
          ...rawMetadata,
          ...cleanConfig,
        };

        const baseTopic = metadata.topic || sketch.title || data.message.content;

        // =========================================================================
        // PRESENTATION MODE WORKFLOW
        // =========================================================================
        if (isPresentation) {
          const isPlanApproved = Boolean(
            data.planApproved ||
              (metadata.planStatus === 'approved' && sketch.content && sketch.content.includes('---')),
          );

          // PHASE 1 & 2: Clarification Loop and Plan Generation
          if (!isPlanApproved) {
            const maxRounds =
              metadata.maxClarificationRounds !== undefined
                ? Number(metadata.maxClarificationRounds)
                : 2;

            let currentRound = Number(rawMetadata.currentClarificationRound) || 0;
            let recordedClarifications = Array.isArray(rawMetadata.clarifications)
              ? [...rawMetadata.clarifications]
              : [];

            if (data.clarificationResponse) {
              const answerText = [
                data.clarificationResponse.selectedOption,
                data.clarificationResponse.customText,
              ]
                .filter(Boolean)
                .join(' - ');

              recordedClarifications.push({
                question: data.clarificationResponse.question || 'Wytyczne',
                answer: answerText,
              });
              currentRound += 1;
            }

            const shouldSkipClarification =
              data.skipClarification || currentRound >= maxRounds || maxRounds === 0;

            if (!shouldSkipClarification) {
              const previousMessages = await db.query.scratchpadMessages.findMany({
                where: eq(scratchpadMessages.scratchpadId, id),
                orderBy: [scratchpadMessages.id],
              });

              const formattedHistory = previousMessages.map((m) => {
                let text = m.query || '';
                if (!text && m.responseBlocks && m.responseBlocks.length > 0) {
                  const b = m.responseBlocks[0];
                  if (b.type === 'presentation_clarification' || b.type === 'clarification') {
                    text = b.data?.question ? `Pytanie AI: ${b.data.question}` : '';
                  } else if (typeof b.data === 'string') {
                    text = b.data;
                  }
                }
                return {
                  role: m.role,
                  content: text,
                };
              });

              const clarifEval = await evaluatePresentationClarification({
                topic: baseTopic,
                targetAudience: metadata.targetAudience,
                slideCount: metadata.slideCount || 8,
                currentRound,
                maxRounds,
                clarifications: recordedClarifications,
                conversationHistory: formattedHistory,
                llm,
                providerId: data.chatModel.providerId,
                modelKey: data.chatModel.key,
              });

              if (clarifEval.needsClarification && clarifEval.options.length >= 2) {
                const clarificationId = crypto.randomUUID();
                const clarificationData = {
                  id: clarificationId,
                  question: clarifEval.question,
                  options: clarifEval.options,
                  round: currentRound + 1,
                  maxRounds,
                  status: 'pending' as const,
                };

                const updatedMeta = {
                  ...metadata,
                  currentClarificationRound: currentRound,
                  clarifications: recordedClarifications,
                };

                await db
                  .update(scratchpads)
                  .set({ metadata: updatedMeta, updatedAt: now })
                  .where(eq(scratchpads.id, id));

                // Save messages in db
                await db.insert(scratchpadMessages).values({
                  scratchpadId: id,
                  messageId: data.message.messageId,
                  role: 'user',
                  query: data.message.content,
                  responseBlocks: [],
                  sources: [],
                  metrics: null,
                  selectedText: null,
                  createdAt: now,
                });

                await db.insert(scratchpadMessages).values({
                  scratchpadId: id,
                  messageId: `${data.message.messageId}-assistant`,
                  role: 'assistant',
                  query: '',
                  responseBlocks: [
                    {
                      id: crypto.randomUUID(),
                      type: 'presentation_clarification',
                      data: clarificationData,
                    },
                  ],
                  sources: [],
                  metrics: null,
                  selectedText: null,
                  createdAt: now,
                });

                safeWrite(
                  JSON.stringify({
                    type: 'presentation_clarification',
                    clarification: clarificationData,
                  }) + '\n',
                );

                safeWrite(JSON.stringify({ type: 'messageEnd' }) + '\n');
                return;
              }
            }

            // Generate Plan (Outline + Deep Research Queries)
            const planResult = await generatePresentationPlan({
              topic: baseTopic,
              targetAudience: metadata.targetAudience,
              slideCount: metadata.slideCount || 8,
              theme: metadata.theme,
              clarifications: recordedClarifications,
              llm,
              providerId: data.chatModel.providerId,
              modelKey: data.chatModel.key,
            });

            const updatedMeta = {
              ...metadata,
              currentClarificationRound: currentRound,
              clarifications: recordedClarifications,
              plan: planResult,
              planStatus: 'pending',
            };

            await db
              .update(scratchpads)
              .set({ metadata: updatedMeta, updatedAt: now })
              .where(eq(scratchpads.id, id));

            await db.insert(scratchpadMessages).values({
              scratchpadId: id,
              messageId: data.message.messageId,
              role: 'user',
              query: data.message.content,
              responseBlocks: [],
              sources: [],
              metrics: null,
              selectedText: null,
              createdAt: now,
            });

            const planBlock = {
              id: crypto.randomUUID(),
              type: 'presentation_plan',
              data: planResult,
            };

            await db.insert(scratchpadMessages).values({
              scratchpadId: id,
              messageId: `${data.message.messageId}-assistant`,
              role: 'assistant',
              query: '',
              responseBlocks: [planBlock],
              sources: [],
              metrics: null,
              selectedText: null,
              createdAt: now,
            });

            safeWrite(
              JSON.stringify({
                type: 'presentation_plan',
                plan: planResult,
              }) + '\n',
            );

            safeWrite(JSON.stringify({ type: 'messageEnd' }) + '\n');
            return;
          }

          // PHASE 3: Multi-Step Deep Research & Slide Generation (Plan Approved)
          const activePlan = data.approvedPlan || metadata.plan;
          const researchQueries: string[] = Array.isArray(activePlan?.researchQueries) && activePlan.researchQueries.length > 0
            ? activePlan.researchQueries
            : [data.message.content || sketch.title];

          let searchFindingsText = '';
          const hasWebSources = data.sources && data.sources.length > 0;

          if (hasWebSources) {
            const researcher = new Researcher();
            for (const query of researchQueries.slice(0, 5)) {
              try {
                const classification = await classify({
                  chatHistory: [],
                  enabledSources: data.sources as SearchSources[],
                  query,
                  llm,
                  providerId: data.chatModel.providerId,
                  modelKey: data.chatModel.key,
                });

                if (!classification.classification.skipSearch) {
                  const searchRes = await researcher.research(session, {
                    chatHistory: [],
                    followUp: query,
                    classification,
                    config: {
                      llm,
                      embedding,
                      sources: data.sources as SearchSources[],
                      mode: data.optimizationMode,
                      fileIds: data.files,
                      systemInstructions: waypointInstructions || 'None',
                      providerId: data.chatModel.providerId,
                      modelKey: data.chatModel.key,
                      qualityModeTokenLimit: metadata.tokenBudgetCap || (data.optimizationMode === 'quality' ? 75000 : 35000),
                    },
                  });

                  if (searchRes?.searchFindings?.length) {
                    collectedSources = [...collectedSources, ...searchRes.searchFindings];
                  }
                }
              } catch (resErr) {
                console.warn('[PresentationResearch] Query error:', query, resErr);
              }
            }

            // Deduplicate sources
            collectedSources = collectedSources.filter(
              (s, idx, self) =>
                idx === self.findIndex((o) => (o.metadata?.url && o.metadata.url === s.metadata?.url) || o.metadata?.title === s.metadata?.title),
            );

            if (collectedSources.length > 0) {
              searchFindingsText = collectedSources
                .map((f, i) => `<result index=${i + 1} title="${f.metadata?.title || 'Source'}" url="${f.metadata?.url || ''}">${f.content}</result>`)
                .join('\n');

              safeWrite(
                JSON.stringify({
                  type: 'sources',
                  sources: collectedSources,
                }) + '\n',
              );
            }
          }

          safeWrite(JSON.stringify({ type: 'researchComplete' }) + '\n');

          const targetSlideCount = metadata.slideCount || activePlan?.slides?.length || 8;
          const presentationSystemPrompt = `${presentationGeneratorPrompt}

PRESENTATION METADATA & CONFIG:
- EXACT TARGET SLIDE COUNT: ${targetSlideCount} slides (MANDATORY: Output EXACTLY ${targetSlideCount} slides separated by '---' delimiters)
- Visual Theme: ${metadata.theme || 'Dark Modern'}
- Target Audience: ${metadata.targetAudience || 'General / Accessible'}
- Include Speaker Notes: ${metadata.includeSpeakerNotes !== false ? 'YES (<!-- speaker: ... --> on every slide)' : 'NO'}
- Include Citations: ${metadata.includeCitations !== false ? 'YES ([1], [2] notation)' : 'NO'}

${
  activePlan?.slides
    ? `APPROVED PLAN OUTLINE (${activePlan.slides.length} SLIDES - YOU MUST GENERATE ALL ${activePlan.slides.length} SLIDES IN ORDER):
${JSON.stringify(activePlan.slides, null, 2)}`
    : ''
}

${
  !data.planApproved && data.currentContent && !data.currentContent.includes('w trakcie generowania') && !data.currentContent.includes('czeka na zatwierdzenie')
    ? `EXISTING SLIDES CONTENT (for context/revision):
\`\`\`markdown
${data.currentContent}
\`\`\``
    : ''
}

${
  searchFindingsText
    ? `<search_results note="Factual information found on the web. STRICT RULE: Every number in charts MUST cite index and exact quote from here. Do not invent numbers.">
${searchFindingsText}
</search_results>`
    : ''
}

${
  waypointInstructions
    ? `MASTER INSTRUCTIONS:
${waypointInstructions}`
    : ''
}
`;

          const streamStartTime = performance.now();
          let activeResponseBlockId = crypto.randomUUID();

          session.emitBlock({
            id: activeResponseBlockId,
            type: 'text',
            data: '',
          });

          const promptForLlm = data.planApproved
            ? `The presentation plan has been approved. Your task is to generate the FULL PRESENTATION containing EXACTLY ${targetSlideCount} SLIDES (from slide 1 to ${targetSlideCount}, strictly following the approved outline).

GENERATION GUIDELINES:
- Generate ALL ${targetSlideCount} slides in a single <presentation_update>...</presentation_update> block.
- Each slide MUST be separated from the previous one by a standalone line: '---'.
- DO NOT STOP after 1 slide. Generate slide 1, slide 2, slide 3, all the way through slide ${targetSlideCount}.
- Every slide must have a concrete title (# ...), substantive bullet points, a chart (Grounded Chart Schema) or infographic, and speaker notes (<!-- speaker: ... -->).
- After generating all ${targetSlideCount} slides, close the </presentation_update> block and provide suggestions in <presentation_suggestions>.`
            : data.message.content;

          const llmStream = llm.streamText({
            messages: [
              { role: 'system', content: presentationSystemPrompt },
              { role: 'user', content: promptForLlm },
            ],
            options: {
              maxTokens: 8192,
            },
          });

          for await (const chunk of llmStream) {
            if (chunk.contentChunk) {
              fullResponseText += chunk.contentChunk;

              const block = session.getBlock(activeResponseBlockId) as any;
              if (block) {
                block.data = fullResponseText;
                session.updateBlock(block.id, [
                  { op: 'replace', path: '/data', value: fullResponseText },
                ]);
              }
            }
          }

          const durationMs = Math.round(performance.now() - streamStartTime);
          const promptTokens = getTokenCount(presentationSystemPrompt + '\n' + promptForLlm);
          const completionTokens = getTokenCount(fullResponseText);
          const totalTokens = promptTokens + completionTokens;

          const metricsData = {
            providerId: data.chatModel.providerId,
            modelKey: data.chatModel.key,
            promptTokens,
            completionTokens,
            totalTokens,
            durationMs,
          };

          await recordLlmMetric({
            chatId: id,
            messageId: data.message.messageId,
            providerId: data.chatModel.providerId,
            modelKey: data.chatModel.key,
            query: data.message.content,
            step: 'presentation_generator',
            promptTokens,
            completionTokens,
            totalTokens,
            durationMs,
            optimizationMode: data.optimizationMode,
            status: 'success',
          });

          // Parse <presentation_update> or fallback to <note_update> or raw slide deck
          let updatedSlidesContent: string | null = null;
          const presClosedMatch = fullResponseText.match(/<presentation_update(?:\s+title="[^"]*")?>([\s\S]*?)<\/presentation_update>/i);
          if (presClosedMatch && presClosedMatch[1]?.trim()) {
            updatedSlidesContent = presClosedMatch[1].trim();
          }

          if (!updatedSlidesContent) {
            const presOpenMatch = fullResponseText.match(/<presentation_update(?:\s+title="[^"]*")?>([\s\S]*?)(?:<presentation_suggestions>|<\/presentation_update>|$)/i);
            if (presOpenMatch && presOpenMatch[1]?.trim()) {
              updatedSlidesContent = presOpenMatch[1].trim();
            }
          }

          if (!updatedSlidesContent) {
            const noteMatch = fullResponseText.match(/<note_update(?:\s+title="[^"]*")?>([\s\S]*?)(?:<\/note_update>|<note_suggestions>|$)/i);
            if (noteMatch && noteMatch[1]?.trim()) {
              updatedSlidesContent = noteMatch[1].trim();
            }
          }

          // Fallback: If fullResponseText contains slide delimiters or multiple headings
          if (!updatedSlidesContent && (fullResponseText.includes('---') || fullResponseText.includes('***') || (fullResponseText.match(/^#\s+[^\n]+/gm) || []).length > 1)) {
            const cleaned = fullResponseText
              .replace(/<presentation_suggestions[\s\S]*?(?:<\/presentation_suggestions>|$)/gi, '')
              .replace(/<note_suggestions[\s\S]*?(?:<\/note_suggestions>|$)/gi, '')
              .replace(/<presentation_update(?:\s+title="[^"]*")?>/gi, '')
              .replace(/<\/presentation_update>/gi, '')
              .trim();
            if (cleaned.length > 50) {
              updatedSlidesContent = cleaned;
            }
          }

          let parsedSuggestions: string[] = [];
          const sugMatch = fullResponseText.match(/<(?:presentation_suggestions|note_suggestions)>([\s\S]*?)<\/(?:presentation_suggestions|note_suggestions)>/i);
          if (sugMatch && sugMatch[1]) {
            parsedSuggestions = sugMatch[1]
              .split('\n')
              .map((line) => line.replace(/^[\s*\-•\d.]+\s*/, '').trim())
              .filter((line) => line.length > 3);
          }

          const finalTitle = data.currentTitle || sketch.title;
          const finalContent = updatedSlidesContent !== null ? updatedSlidesContent : (data.currentContent || sketch.content);

          const existingSources = Array.isArray(sketch.sources)
            ? sketch.sources
            : typeof sketch.sources === 'string'
              ? JSON.parse(sketch.sources || '[]')
              : [];
          const mergedSources = [...existingSources, ...collectedSources].filter(
            (s, idx, self) =>
              idx === self.findIndex((o) => (o.metadata?.url && o.metadata.url === s.metadata?.url) || o.metadata?.title === s.metadata?.title),
          );

          const updatedMetadata = {
            ...metadata,
            planStatus: 'approved',
          };

          await db
            .update(scratchpads)
            .set({
              title: finalTitle,
              content: finalContent,
              type: 'presentation',
              metadata: updatedMetadata,
              sources: mergedSources,
              waypointId: activeWaypointId || null,
              updatedAt: now,
            })
            .where(eq(scratchpads.id, id));

          const allVersions = await db.query.scratchpadVersions.findMany({
            where: eq(scratchpadVersions.scratchpadId, id),
            orderBy: [desc(scratchpadVersions.versionNumber)],
          });
          const nextVersionNumber = (allVersions[0]?.versionNumber || 0) + 1;

          await db.insert(scratchpadVersions).values({
            id: crypto.randomUUID(),
            scratchpadId: id,
            versionNumber: nextVersionNumber,
            title: finalTitle,
            content: finalContent,
            summary: `AI presentation generation (${data.message.content.slice(0, 50)})`,
            prompt: data.message.content,
            sources: collectedSources,
            author: 'ai',
            createdAt: now,
          });

          const strippedResponseText = fullResponseText
            .replace(/<(?:presentation_update|note_update)[\s\S]*?<\/(?:presentation_update|note_update)>/gi, '')
            .replace(/<(?:presentation_suggestions|note_suggestions)[\s\S]*?<\/(?:presentation_suggestions|note_suggestions)>/gi, '')
            .trim();

          // Never claim success when nothing was actually extracted — a model that fails to
          // emit the <presentation_update> wrapper (or any recognizable slide markdown) must
          // not be reported as having generated a deck, or the empty result looks like a bug
          // instead of a generation failure the user can retry.
          const chatDisplayText =
            strippedResponseText ||
            (updatedSlidesContent !== null
              ? 'Presentation generated with slides and charts.'
              : 'Failed to generate the presentation — the model did not return correctly formatted content. Try again or pick a different (stronger) model.');

          await db.insert(scratchpadMessages).values({
            scratchpadId: id,
            messageId: data.message.messageId,
            role: 'user',
            query: data.message.content,
            responseBlocks: [],
            sources: [],
            metrics: null,
            selectedText: null,
            createdAt: now,
          });

          const assistantBlocks: any[] = [
            {
              id: activeResponseBlockId,
              type: 'text',
              data: chatDisplayText,
            },
          ];

          if (collectedSources.length > 0) {
            assistantBlocks.push({
              id: crypto.randomUUID(),
              type: 'source',
              data: collectedSources,
            });
          }

          if (parsedSuggestions.length > 0) {
            assistantBlocks.push({
              id: crypto.randomUUID(),
              type: 'suggestions',
              data: parsedSuggestions,
            });
          }

          await db.insert(scratchpadMessages).values({
            scratchpadId: id,
            messageId: `${data.message.messageId}-assistant`,
            role: 'assistant',
            query: '',
            responseBlocks: assistantBlocks,
            sources: collectedSources,
            metrics: metricsData,
            selectedText: null,
            createdAt: now,
          });

          safeWrite(
            JSON.stringify({
              type: 'scratchpadUpdate',
              title: finalTitle,
              content: finalContent,
              versionNumber: nextVersionNumber,
              sources: collectedSources,
              chatText: chatDisplayText,
              suggestions: parsedSuggestions,
              metrics: metricsData,
            }) + '\n',
          );

          safeWrite(JSON.stringify({ type: 'messageEnd' }) + '\n');
          return;
        }

        // =========================================================================
        // STANDARD NOTE WORKFLOW (Scratchpad Note)
        // =========================================================================

        // Step 0: Clarification & Disambiguation Evaluation
        const shouldEvaluateClarification = !data.skipClarification && !data.clarificationResponse;

        if (shouldEvaluateClarification) {
          const clarifEvaluation = await evaluateScratchpadClarification({
            query: data.message.content,
            currentTitle: data.currentTitle || sketch.title,
            currentContent: data.currentContent || sketch.content,
            selectedText: data.selectedText,
            llm,
            providerId: data.chatModel.providerId,
            modelKey: data.chatModel.key,
          });

          if (clarifEvaluation.needsClarification && clarifEvaluation.options.length >= 2) {
            const clarificationId = crypto.randomUUID();
            const clarificationData = {
              id: clarificationId,
              question: clarifEvaluation.question,
              options: clarifEvaluation.options,
              status: 'pending' as const,
            };

            // Save user message in database
            await db.insert(scratchpadMessages).values({
              scratchpadId: id,
              messageId: data.message.messageId,
              role: 'user',
              query: data.message.content,
              responseBlocks: [],
              sources: [],
              metrics: null,
              selectedText: data.selectedText || null,
              createdAt: now,
            });

            // Save assistant clarification message in database
            await db.insert(scratchpadMessages).values({
              scratchpadId: id,
              messageId: `${data.message.messageId}-assistant`,
              role: 'assistant',
              query: '',
              responseBlocks: [
                {
                  id: crypto.randomUUID(),
                  type: 'clarification',
                  data: clarificationData,
                },
              ],
              sources: [],
              metrics: null,
              selectedText: null,
              createdAt: now,
            });

            // Emit clarification event to stream
            safeWrite(
              JSON.stringify({
                type: 'clarification',
                clarification: clarificationData,
              }) + '\n',
            );

            safeWrite(JSON.stringify({ type: 'messageEnd' }) + '\n');
            return;
          }
        }

        // Step 1: Research / Search if sources enabled
        const hasWebSources = data.sources && data.sources.length > 0;
        let searchFindingsText = '';

        // Formulate effective query for search taking clarification into account
        let effectiveQuery = data.message.content;
        if (data.clarificationResponse) {
          const parts: string[] = [data.message.content];
          if (data.clarificationResponse.selectedOption) {
            parts.push(`Direction: ${data.clarificationResponse.selectedOption}`);
          }
          if (data.clarificationResponse.customText) {
            parts.push(`Details: ${data.clarificationResponse.customText}`);
          }
          effectiveQuery = parts.join(' | ');
        }

        if (hasWebSources) {
          const classification = await classify({
            chatHistory: [],
            enabledSources: data.sources as SearchSources[],
            query: effectiveQuery,
            llm,
            providerId: data.chatModel.providerId,
            modelKey: data.chatModel.key,
          });

          if (!classification.classification.skipSearch) {
            const researcher = new Researcher();
            const searchResults = await researcher.research(session, {
              chatHistory: [],
              followUp: effectiveQuery,
              classification,
              config: {
                llm,
                embedding,
                sources: data.sources as SearchSources[],
                mode: data.optimizationMode,
                fileIds: data.files,
                systemInstructions: waypointInstructions || 'None',
                providerId: data.chatModel.providerId,
                modelKey: data.chatModel.key,
              },
            });

            if (searchResults?.searchFindings?.length) {
              collectedSources = searchResults.searchFindings;
              searchFindingsText = searchResults.searchFindings
                .map((f, i) => `<result index=${i + 1} title="${f.metadata?.title || 'Source'}">${f.content}</result>`)
                .join('\n');

              safeWrite(
                JSON.stringify({
                  type: 'sources',
                  sources: collectedSources,
                }) + '\n',
              );
            }
          }
        }

        safeWrite(JSON.stringify({ type: 'researchComplete' }) + '\n');

        // Step 2: System Prompt for Scratchpad Copilot
        let clarificationSection = '';
        if (data.clarificationResponse) {
          clarificationSection = `
### USER CLARIFICATION / FOCUS:
- Focus/Perspective chosen by user: "${data.clarificationResponse.selectedOption || 'Standard angle'}"
${data.clarificationResponse.customText ? `- Additional user notes/specifications: "${data.clarificationResponse.customText}"` : ''}
${data.clarificationResponse.question ? `- Clarified question was: "${data.clarificationResponse.question}"` : ''}
Tailor the research depth, technical angle, examples, and note structure specifically to this chosen focus!`;
        }

        const systemPrompt = `You are Vane Scratchpad Copilot, an expert AI research and writing collaborator paired with a live interactive document editor.
The user is drafting, refining, structuring, or expanding a document in the Scratchpad.

DOCUMENT TITLE: "${data.currentTitle || sketch.title}"
CURRENT DOCUMENT CONTENT:
\`\`\`markdown
${data.currentContent || sketch.content || '(Pusty dokument)'}
\`\`\`

${
  data.selectedText
    ? `IMPORTANT: The user has selected this specific snippet in the editor for focused refinement:
<selected_text>
${data.selectedText}
</selected_text>
Your task is to modify, rewrite, or expand upon this specific selection while seamlessly integrating with the overall document.`
    : ''
}

${clarificationSection}

${
  searchFindingsText
    ? `<search_results note="Factual information found on the web. Cite these using [1], [2] notation where appropriate">
${searchFindingsText}
</search_results>`
    : ''
}

${
  waypointInstructions
    ? `USER MASTERPROMPT / SPACE INSTRUCTIONS:
${waypointInstructions}`
    : ''
}

### CRITICAL INSTRUCTIONS:
1. Always respond in the same language as the user query. If the language is ambiguous, default to English.
2. Chat Response:
   - Provide a direct, natural, conversational explanation of your work, findings, or modifications.
   - NEVER output meta-headers, prefixes, or labels like "Part 1:", "Part 1 (Chat Commentary):", "Chat Commentary:", or "Komentarz:". Start speaking directly to the user.
   - Cite search findings naturally using [1], [2] notation where relevant.
3. Selection Context:
   - If <selected_text> is provided, acknowledge the targeted snippet and clearly explain the revisions made to it.
4. CITING SOURCES IN THE NOTE CONTENT (MANDATORY):
   - In the document update block <note_update>, whenever search results are provided, you MUST ACTIVELY CITE them by placing citation numbers like [1], [2], or [3] at the end of the specific factual sentences, definitions, bullet points, or algorithm explanations derived from those sources.
   - Example inside note: "Recursion requires defining a base case [1] and calling itself with a smaller subproblem [2]."
   - These citation tags [1], [2] are essential for the user's interactive source highlighter to work.
5. DOCUMENT UPDATE BLOCK:
   - ALWAYS include a <note_update>...</note_update> block containing the COMPLETE, UPDATED, BEAUTIFULLY FORMATTED MARKDOWN of the document.
   - Do NOT modify or change the document title. The document title is strictly preserved and managed by the user.
   - If the document contains placeholder text, replace it entirely with rich, detailed content.
6. NOTE EXPANSION SUGGESTIONS (MANDATORY):
   - Immediately after the </note_update> block, ALWAYS output a <note_suggestions> block with 3 to 4 actionable, specific suggestions for expanding, deepening, or applying the note.
   - Format each suggestion on a separate line starting with "- ".
   - Make suggestions concrete and tailored to the topic (e.g. adding code in a specific language, comparing complexity, adding real-world practice tasks, adding diagrams).
   Example:
   <note_suggestions>
   - Add a section on tail recursion (Tail Call Optimization) with examples in C and Python
   - Compare the time and space complexity of the recursive approach vs. the iterative one
   - Add 3 practical algorithmic exercises with solutions (e.g. Towers of Hanoi, binary trees)
   </note_suggestions>
7. Ensure headings (#, ##, ###), bullet points, code blocks, and bold formatting are clean, complete, and professional.
8. MARKDOWN COMPARISON & DATA TABLE FORMATTING RULES (CRITICAL):
   - Always use standard GFM table syntax with valid column headers and delimiter lines (e.g. \`| Criterion / Feature | Tool A | Tool B |\` followed by \`| :--- | :--- | :--- |\`).
   - Keep table cells compact, concise, and punchy (e.g. short phrases, key metrics, status indicators, badges).
   - NEVER insert long, multi-sentence narrative paragraphs into table cells — elaborate on pros, cons, and nuances in the dedicated text sections below the table.
   - NEVER insert raw line breaks inside a table row or cell.
   - If a cell contains a pipe symbol \`|\` (e.g. in type signatures or shell commands), always escape it as \`\\|\` or wrap it in code format so it doesn't split table columns.
   - Keep comparison tables to 2 to 4 comparison items for optimal responsive layout in split editor view.`;

        const streamStartTime = performance.now();
        let activeResponseBlockId = crypto.randomUUID();

        session.emitBlock({
          id: activeResponseBlockId,
          type: 'text',
          data: '',
        });

        const promptForLlm = data.clarificationResponse
          ? `${data.message.content}\n\n[Doprecyzowanie: ${data.clarificationResponse.selectedOption || ''} ${data.clarificationResponse.customText || ''}]`.trim()
          : data.message.content;

        const llmStream = llm.streamText({
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: promptForLlm },
          ],
        });

        for await (const chunk of llmStream) {
          if (chunk.contentChunk) {
            fullResponseText += chunk.contentChunk;

            // Stream updated text block
            const block = session.getBlock(activeResponseBlockId) as any;
            if (block) {
              block.data = fullResponseText;
              session.updateBlock(block.id, [
                { op: 'replace', path: '/data', value: fullResponseText },
              ]);
            }
          }
        }

        const durationMs = Math.round(performance.now() - streamStartTime);
        const promptTokens = getTokenCount(systemPrompt + '\n' + promptForLlm);
        const completionTokens = getTokenCount(fullResponseText);
        const totalTokens = promptTokens + completionTokens;

        const metricsData = {
          providerId: data.chatModel.providerId,
          modelKey: data.chatModel.key,
          promptTokens,
          completionTokens,
          totalTokens,
          durationMs,
        };

        await recordLlmMetric({
          chatId: id,
          messageId: data.message.messageId,
          providerId: data.chatModel.providerId,
          modelKey: data.chatModel.key,
          query: data.message.content,
          step: 'scratchpad_copilot',
          promptTokens,
          completionTokens,
          totalTokens,
          durationMs,
          optimizationMode: data.optimizationMode,
          status: 'success',
        });

        // Step 3: Parse <note_update> and update database
        let updatedNoteContent: string | null = null;

        const updateMatch = fullResponseText.match(/<note_update(?:\s+title="[^"]*")?>([\s\S]*?)<\/note_update>/i);
        if (updateMatch) {
          updatedNoteContent = updateMatch[1]?.trim() || null;
        }

        // Step 4: Parse <note_suggestions>
        let parsedSuggestions: string[] = [];
        const suggestionsMatch = fullResponseText.match(/<note_suggestions>([\s\S]*?)<\/note_suggestions>/i);
        if (suggestionsMatch && suggestionsMatch[1]) {
          parsedSuggestions = suggestionsMatch[1]
            .split('\n')
            .map((line) => line.replace(/^[\s*\-•\d.]+\s*/, '').trim())
            .filter((line) => line.length > 3);
        }

        const finalTitle = data.currentTitle || sketch.title;
        const finalContent = updatedNoteContent !== null ? updatedNoteContent : (data.currentContent || sketch.content);

        // Merge accumulated sources
        const existingSources = Array.isArray(sketch.sources)
          ? sketch.sources
          : typeof sketch.sources === 'string'
            ? JSON.parse(sketch.sources || '[]')
            : [];
        const mergedSources = [...existingSources, ...collectedSources].filter(
          (s, idx, self) =>
            idx === self.findIndex((o) => (o.metadata?.url && o.metadata.url === s.metadata?.url) || o.metadata?.title === s.metadata?.title),
        );

        // Update scratchpad
        await db
          .update(scratchpads)
          .set({
            title: finalTitle,
            content: finalContent,
            sources: mergedSources,
            waypointId: activeWaypointId || null,
            updatedAt: now,
          })
          .where(eq(scratchpads.id, id));

        // Create new version snapshot if content was updated
        const allVersions = await db.query.scratchpadVersions.findMany({
          where: eq(scratchpadVersions.scratchpadId, id),
          orderBy: [desc(scratchpadVersions.versionNumber)],
        });
        const nextVersionNumber = (allVersions[0]?.versionNumber || 0) + 1;

        let versionSummary = data.selectedText
          ? `AI edit to selection: "${data.selectedText.slice(0, 40)}..."`
          : `AI update (${data.message.content.slice(0, 50)})`;

        await db.insert(scratchpadVersions).values({
          id: crypto.randomUUID(),
          scratchpadId: id,
          versionNumber: nextVersionNumber,
          title: finalTitle,
          content: finalContent,
          summary: versionSummary,
          prompt: data.message.content,
          sources: collectedSources,
          author: 'ai',
          createdAt: now,
        });

        // Clean conversational response text for chat display
        const chatDisplayText = fullResponseText
          .replace(/<note_update[\s\S]*?<\/note_update>/gi, '')
          .replace(/<note_suggestions[\s\S]*?<\/note_suggestions>/gi, '')
          .trim() || 'Updated the note content in the editor.';

        // Save messages in scratchpad_messages
        await db.insert(scratchpadMessages).values({
          scratchpadId: id,
          messageId: data.message.messageId,
          role: 'user',
          query: data.message.content,
          responseBlocks: [],
          sources: [],
          metrics: null,
          selectedText: data.selectedText || null,
          createdAt: now,
        });

        const assistantBlocks: any[] = [
          {
            id: activeResponseBlockId,
            type: 'text',
            data: chatDisplayText,
          },
        ];

        if (collectedSources.length > 0) {
          assistantBlocks.push({
            id: crypto.randomUUID(),
            type: 'source',
            data: collectedSources,
          });
        }

        if (parsedSuggestions.length > 0) {
          assistantBlocks.push({
            id: crypto.randomUUID(),
            type: 'suggestions',
            data: parsedSuggestions,
          });
        }

        await db.insert(scratchpadMessages).values({
          scratchpadId: id,
          messageId: `${data.message.messageId}-assistant`,
          role: 'assistant',
          query: '',
          responseBlocks: assistantBlocks,
          sources: collectedSources,
          metrics: metricsData,
          selectedText: null,
          createdAt: now,
        });

        // Emit final event with note updates, telemetry metrics and suggestions
        safeWrite(
          JSON.stringify({
            type: 'scratchpadUpdate',
            title: finalTitle,
            content: finalContent,
            versionNumber: nextVersionNumber,
            sources: collectedSources,
            chatText: chatDisplayText,
            suggestions: parsedSuggestions,
            metrics: metricsData,
          }) + '\n',
        );

        safeWrite(JSON.stringify({ type: 'messageEnd' }) + '\n');
      } catch (err: any) {
        console.error('Error during scratchpad copilot stream:', err);
        safeWrite(
          JSON.stringify({
            type: 'error',
            data: err?.message || 'An error occurred while generating the response.',
          }) + '\n',
        );
      } finally {
        disconnect();
        session.removeAllListeners();
        safeClose();
      }
    })();

    return new Response(responseStream.readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        Connection: 'keep-alive',
        'Cache-Control': 'no-cache, no-transform',
      },
    });
  } catch (err: any) {
    console.error('Error in scratchpad chat API:', err);
    return Response.json(
      { message: err?.message || 'An unexpected server error occurred.' },
      { status: 500 },
    );
  }
};
