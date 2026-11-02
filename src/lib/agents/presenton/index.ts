import { searchSearxng } from '@/lib/searxng';
import BaseLLM from '@/lib/models/base/llm';
import SessionManager from '@/lib/session';
import mcpClientManager from '@/lib/mcp/client';

export interface PresentonPipelineOptions {
  systemInstructions?: string;
  signal?: AbortSignal;
  language?: string;
}

export interface PresentonPipelineResult {
  content: string;
  sources: Array<{
    title: string;
    url: string;
    publishedDate?: string;
  }>;
}

export class PresentonEngine {
  /**
   * Run the complete autonomous Research-to-Presentation pipeline
   */
  async runPresentationPipeline(
    topic: string,
    llm: BaseLLM<any>,
    session: SessionManager,
    options: PresentonPipelineOptions = {},
  ): Promise<PresentonPipelineResult> {
    const allSources: Array<{
      title: string;
      url: string;
      publishedDate?: string;
    }> = [];
    const visitedUrls = new Set<string>();
    const collectedSnippets: Array<{ title: string; url: string; text: string }> = [];

    // Phase 1: Web Research & Discovery
    const isPolish =
      (options.language && options.language.startsWith('pl')) ||
      /[ąćęłńóśźż]/i.test(topic) ||
      /\b(prezentacj|polsk|blogu|zrób|utwórz)\b/i.test(topic);

    const targetLang = isPolish ? 'pl' : (options.language || 'en');

    const searchQueries = isPolish
      ? [
          topic,
          `${topic} informacje przegląd`,
          `${topic} kluczowe fakty podsumowanie`,
        ]
      : [
          topic,
          `${topic} key facts statistics analysis`,
          `${topic} overview trends`,
        ];

    session.emit('data', {
      type: 'searching',
      data: searchQueries,
    });

    for (const query of searchQueries) {
      if (options.signal?.aborted) break;

      try {
        const searchRes = await searchSearxng(query, {
          categories: ['general'],
        });

        for (const item of (searchRes.results || []).slice(0, 5)) {
          if (!item.url || visitedUrls.has(item.url)) continue;
          visitedUrls.add(item.url);

          allSources.push({
            title: item.title,
            url: item.url,
            publishedDate: item.publishedDate,
          });

          collectedSnippets.push({
            title: item.title,
            url: item.url,
            text: (item.content || '').substring(0, 800),
          });
        }
      } catch (searchErr) {
        console.warn(`[PresentonEngine] Search query "${query}" failed:`, searchErr);
      }
    }

    session.emit('data', {
      type: 'reading',
      data: allSources.map((s) => ({
        content: s.title,
        metadata: {
          title: s.title,
          url: s.url,
        },
      })),
    });

    // Phase 2: Slide Deck Outline Synthesis
    const evidenceContext = collectedSnippets
      .map(
        (snip, idx) =>
          `[${idx + 1}] Source: ${snip.title}\nURL: ${snip.url}\nExcerpt: ${snip.text}`,
      )
      .join('\n\n');

    const langDirective = isPolish
      ? 'Language instruction: Write the entire presentation blueprint, all slide titles, primary goals, bullet points, and visual recommendations in Polish.'
      : `Language instruction: Write the entire presentation blueprint in ${targetLang}.`;

    const synthesisPrompt = `You are a Principal Presentation Architect. Based on the verified web research below, formulate a comprehensive, professional 8-slide presentation blueprint on the topic: "${topic}".

Verified Web Research Findings:
${evidenceContext || '(General topic knowledge)'}

Instructions:
1. Ground all numbers, percentages, and statements in the gathered web research.
2. Structure the deck logically across 8 distinct slides:
   - Slide 1: Title and executive hook
   - Slide 2: Context and background
   - Slide 3-6: Core substantive findings, mechanisms, data, and case examples
   - Slide 7: Future outlook, challenges, and strategic opportunities
   - Slide 8: Key takeaways and conclusion
3. For each slide, provide:
   - Slide Title
   - Primary Goal
   - 3-4 concise, high-impact bullet points with source citations (e.g. [1], [2])
   - Visual recommendation (Chart, Diagram, or Key Metric Card)
4. ${langDirective}

Format your response in clean Markdown with clear headings for each slide.`;

    let synthesizedDeck = '';
    try {
      const llmRes = await llm.generateText({
        messages: [
          {
            role: 'system',
            content: options.systemInstructions
              ? `${options.systemInstructions}\nYou are a presentation synthesis specialist.`
              : 'You are a presentation synthesis specialist. Craft rigorous, well-structured slide decks.',
          },
          { role: 'user', content: synthesisPrompt },
        ],
      });
      synthesizedDeck = llmRes.content || '';
    } catch (genErr) {
      console.warn('[PresentonEngine] Outline synthesis failed, fallback to raw notes:', genErr);
      synthesizedDeck = `## Presentation Outline: ${topic}\n\n* Research completed across ${allSources.length} sources.`;
    }

    // Phase 3: Check for Presenton MCP Server and invoke generation tool
    let mcpExecuted = false;
    let mcpDetails = '';

    try {
      const servers = mcpClientManager.getServers().filter((s) => s.enabled);
      const presentonServer = servers.find(
        (s) =>
          s.name.toLowerCase().includes('presenton') ||
          (s.url && s.url.includes('5000')) ||
          (s.url && s.url.includes('5001')) ||
          (s.url && s.url.toLowerCase().includes('presenton')),
      );

      if (presentonServer) {
        const tools = await mcpClientManager.listServerTools(presentonServer);
        const presTool = tools.find(
          (t) =>
            t.name === 'start_standard_presentation' ||
            t.name === 'start_smart_presentation' ||
            t.name === 'generate_presentation' ||
            t.name.includes('presentation') ||
            t.name.includes('deck'),
        );

        if (presTool) {
          const allowedProps = presTool.inputSchema?.properties
            ? Object.keys(presTool.inputSchema.properties)
            : null;

          const fullArgs: Record<string, any> = {
            content: synthesizedDeck || topic,
            prompt: `Topic: ${topic}\n\n${synthesizedDeck}`,
            n_slides: 8,
            language: targetLang,
            export_as: 'pptx',
            tone: 'professional',
            verbosity: 'standard',
          };

          const toolArgs: Record<string, any> = {};
          if (allowedProps) {
            for (const key of allowedProps) {
              if (fullArgs[key] !== undefined) {
                toolArgs[key] = fullArgs[key];
              }
            }
          } else {
            Object.assign(toolArgs, fullArgs);
          }

          const mcpResult = await mcpClientManager.callTool(
            presentonServer.id,
            presTool.name,
            toolArgs,
          );

          let taskId: string | null = null;
          try {
            for (const c of mcpResult.content || []) {
              if (c.text) {
                const parsed = JSON.parse(c.text);
                if (parsed.id) {
                  taskId = parsed.id;
                  break;
                }
              }
            }
          } catch {}

          if (taskId) {
            const hasStatusTool = tools.some((t) => t.name === 'get_job_status');
            if (hasStatusTool) {
              session.emit('data', {
                type: 'generating',
                data: isPolish
                  ? 'Presenton przygotowuje strukturę slajdów...'
                  : 'Presenton is preparing slide outlines...',
              });

              let attempts = 0;
              const maxAttempts = 120;
              let jobFinished = false;
              let lastPresentationId: string | null = null;

              while (attempts < maxAttempts && !jobFinished && !options.signal?.aborted) {
                await new Promise((r) => setTimeout(r, 5000));
                attempts++;

                try {
                  const statusRes = await mcpClientManager.callTool(
                    presentonServer.id,
                    'get_job_status',
                    { id: taskId },
                  );

                  let statusData: any = null;
                  for (const c of statusRes.content || []) {
                    if (c.text) {
                      try {
                        statusData = JSON.parse(c.text);
                        break;
                      } catch {}
                    }
                  }

                  if (statusData) {
                    if (statusData.data?.presentation_id) {
                      lastPresentationId = statusData.data.presentation_id;
                    }

                    const created = statusData.data?.created_slides;
                    const remaining = statusData.data?.remaining_slides;
                    const progressCount =
                      created !== undefined && remaining !== undefined && created + remaining > 0
                        ? ` (${created}/${created + remaining})`
                        : '';

                    if (statusData.message) {
                      session.emit('data', {
                        type: 'generating',
                        data: `Presenton: ${statusData.message}${progressCount}...`,
                      });
                    }

                    if (statusData.status === 'completed') {
                      jobFinished = true;
                      mcpExecuted = true;
                      const rawPath = statusData.data?.path || '';
                      const rawEditPath = statusData.data?.edit_path || '';
                      const hostBase = 'http://localhost:5001';

                      const downloadLink = rawPath.replace(/^https?:\/\/presenton(?::\d+)?/, hostBase).startsWith('http')
                        ? rawPath.replace(/^https?:\/\/presenton(?::\d+)?/, hostBase)
                        : `${hostBase}${rawPath}`;

                      const editorLink = rawEditPath.replace(/^https?:\/\/presenton(?::\d+)?/, hostBase).startsWith('http')
                        ? rawEditPath.replace(/^https?:\/\/presenton(?::\d+)?/, hostBase)
                        : `${hostBase}${rawEditPath}`;

                      mcpDetails = isPolish
                        ? `✅ **Prezentacja wygenerowana pomyślnie!**\n\n- 📥 [Pobierz prezentację PowerPoint (.pptx)](${downloadLink})\n- ✏️ [Otwórz i edytuj w edytorze Presenton](${editorLink})`
                        : `✅ **Presentation generated successfully!**\n\n- 📥 [Download Presentation (.pptx)](${downloadLink})\n- ✏️ [Open in Presenton Slide Editor](${editorLink})`;
                    } else if (statusData.status === 'error') {
                      jobFinished = true;
                      const errorMsg =
                        statusData.error?.detail || statusData.message || 'Generation failed in Presenton';
                      mcpDetails = isPolish
                        ? `⚠️ **Błąd silnika Presenton:** \`${errorMsg}\`\n\nMożesz dostosować model LLM w pliku \`docker-compose.yaml\` lub w interfejsie Presenton pod adresem [http://localhost:5001](http://localhost:5001).`
                        : `⚠️ **Presenton Engine Error:** \`${errorMsg}\`\n\nYou can configure or adjust the LLM provider in \`docker-compose.yaml\` or directly in the Presenton Web UI at [http://localhost:5001](http://localhost:5001).`;
                    }
                  }
                } catch (pollErr) {
                  console.warn('[PresentonEngine] Error polling job status:', pollErr);
                }
              }

              if (!jobFinished && taskId) {
                const hostBase = 'http://localhost:5001';
                const editorLink = lastPresentationId
                  ? `${hostBase}/presentation?id=${lastPresentationId}`
                  : `${hostBase}`;
                mcpDetails = isPolish
                  ? `⏳ **Kompilacja prezentacji trwa w tle**\n\nLokalny model AI generuje układ i treść wszystkich 8 slajdów. Zadanie (ID: \`${taskId}\`) jest nadal aktywne w kontenerze Presenton.\n\n- ✏️ [Otwórz w edytorze Presenton](${editorLink}) (po ukończeniu slajdy pojawią się w edytorze)`
                  : `⏳ **Presentation compilation running in background**\n\nThe local model is compiling all slides and visual layouts. Task (ID: \`${taskId}\`) is still active in Presenton.\n\n- ✏️ [Open in Presenton Slide Editor](${editorLink})`;
              }
            }
          } else {
            const textContent = (mcpResult.content || [])
              .map((c) => c.text || '')
              .filter(Boolean)
              .join('\n\n');

            if (textContent) {
              mcpExecuted = true;
              mcpDetails = textContent;
            }
          }
        }
      }
    } catch (mcpErr) {
      console.warn('[PresentonEngine] Presenton MCP tool call failed or server not reached:', mcpErr);
    }

    // Phase 4: Construct final user-facing response
    let finalContent = '';

    if (mcpExecuted) {
      finalContent = `### 📊 Presenton AI Presentation Generated (MCP)

> **Topic:** ${topic}  
> **Status:** Successfully compiled into PowerPoint (.pptx) via Presenton MCP  
> **Sources Researched:** ${allSources.length} verified web sources  

---

#### 📥 Presentation Export & Artifacts
${mcpDetails}

---

#### 📋 Synthesized Presentation Blueprint
${synthesizedDeck}`;
    } else if (mcpDetails) {
      finalContent = `### 📊 Research-Backed Presentation Deck

> **Topic:** ${topic}  
> **Research Summary:** Grounded in ${allSources.length} authoritative web sources  

---

#### ⚠️ Presenton Generation Status
${mcpDetails}

---

#### 📋 Structured Slide Deck Blueprint
${synthesizedDeck}`;
    } else {
      finalContent = `### 📊 Research-Backed Presentation Deck

> **Topic:** ${topic}  
> **Research Summary:** Grounded in ${allSources.length} authoritative web sources  

---

#### 📋 Structured Slide Deck Blueprint
${synthesizedDeck}

---

> [!NOTE]
> **Presenton MCP Connection**: To generate editable PowerPoint (\`.pptx\`) and PDF files directly, connect the Presenton MCP server in **Settings → MCP** using the **Presenton (SSE)** preset (\`http://presenton/mcp\` or \`http://localhost:5001/mcp\`).  
> If running locally with Docker, activate the container using:  
> \`\`\`bash
> docker compose --profile presenton up -d
> \`\`\``;
    }

    return {
      content: finalContent,
      sources: allSources,
    };
  }
}

export const presentonEngine = new PresentonEngine();
export default presentonEngine;

