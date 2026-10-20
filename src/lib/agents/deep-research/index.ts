import { searchSearxng } from '@/lib/searxng';
import Scraper from '@/lib/scraper';
import BaseLLM from '@/lib/models/base/llm';
import SessionManager from '@/lib/session';
import crypto from 'crypto';
import {
  DeepResearchPlan,
  DeepResearchFinding,
  DeepResearchResult,
  DeepResearchProgress,
} from './types';

export class DeepResearchEngine {
  /**
   * Step 1: Formulate a structured investigative research plan
   */
  async formulatePlan(
    query: string,
    llm: BaseLLM<any>,
    systemInstructions?: string,
  ): Promise<DeepResearchPlan> {
    const prompt = `You are a Principal Research Architect. Deconstruct the following complex research inquiry into 3 focused investigative hypotheses/angles.

Query: "${query}"

Return STRICT JSON in the following format:
{
  "executiveFocus": "Brief 1-sentence statement of core objective",
  "hypotheses": [
    {
      "id": "h1",
      "topic": "Concise topic title",
      "angle": "What specific aspect, mechanism or comparison to investigate",
      "queries": ["Primary search query 1", "Primary search query 2"]
    }
  ]
}`;

    try {
      const res = await llm.generateText({
        messages: [
          {
            role: 'system',
            content: systemInstructions
              ? `${systemInstructions}\n\nYou are a deep research planner.`
              : 'You are a deep research planner. Output strict valid JSON only.',
          },
          { role: 'user', content: prompt },
        ],
      });

      const cleaned = (res.content || '').replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
      const parsed = JSON.parse(cleaned);

      return {
        query,
        executiveFocus: parsed.executiveFocus || query,
        hypotheses: (parsed.hypotheses || []).map((h: any, idx: number) => ({
          id: h.id || `h${idx + 1}`,
          topic: h.topic || `Investigation Branch ${idx + 1}`,
          angle: h.angle || '',
          queries: Array.isArray(h.queries) && h.queries.length > 0 ? h.queries : [query],
          findingsCount: 0,
          status: 'pending' as const,
        })),
      };
    } catch (err) {
      // Fallback plan if json parsing fails
      return {
        query,
        executiveFocus: `Comprehensive investigation into ${query}`,
        hypotheses: [
          {
            id: 'h1',
            topic: 'Overview and Core Foundations',
            angle: 'Foundational concepts, current state, and fundamental principles',
            queries: [query, `${query} overview`],
            findingsCount: 0,
            status: 'pending',
          },
          {
            id: 'h2',
            topic: 'Technical Analysis and Comparison',
            angle: 'Architecture, methodologies, trade-offs, and empirical benchmarks',
            queries: [`${query} analysis`, `${query} comparison`],
            findingsCount: 0,
            status: 'pending',
          },
          {
            id: 'h3',
            topic: 'Future Outlook and Practical Applications',
            angle: 'Emerging trends, challenges, and actionable implementations',
            queries: [`${query} trends`, `${query} challenges`],
            findingsCount: 0,
            status: 'pending',
          },
        ],
      };
    }
  }

  /**
   * Step 2: Execute multi-hop recursive research across hypotheses
   */
  async executeResearch(
    plan: DeepResearchPlan,
    llm: BaseLLM<any>,
    session: SessionManager,
    options: {
      maxDepth?: number;
      signal?: AbortSignal;
    } = {},
  ): Promise<{
    allFindings: DeepResearchFinding[];
    allSources: Array<{ title: string; url: string; publishedDate?: string }>;
  }> {
    const maxDepth = Math.min(Math.max(options.maxDepth || 2, 1), 3);
    const allFindings: DeepResearchFinding[] = [];
    const visitedUrls = new Set<string>();
    const allSources: Array<{ title: string; url: string; publishedDate?: string }> = [];

    const totalBranches = plan.hypotheses.length;

    for (let bIdx = 0; bIdx < plan.hypotheses.length; bIdx++) {
      if (options.signal?.aborted) break;

      const hyp = plan.hypotheses[bIdx];
      hyp.status = 'in_progress';

      this.emitProgress(session, {
        stage: 'exploring',
        currentDepth: 1,
        maxDepth,
        activeTopic: hyp.topic,
        discoveredSourcesCount: allSources.length,
        completedBranches: bIdx,
        totalBranches,
      });

      // Hop 1: Primary queries
      const branchFindings: DeepResearchFinding[] = [];

      for (const q of hyp.queries.slice(0, 2)) {
        if (options.signal?.aborted) break;

        try {
          const searchRes = await searchSearxng(q, {
            categories: ['general', 'science'],
          });

          for (const item of (searchRes.results || []).slice(0, 4)) {
            if (!item.url || visitedUrls.has(item.url)) continue;
            visitedUrls.add(item.url);

            allSources.push({
              title: item.title,
              url: item.url,
              publishedDate: item.publishedDate,
            });

            // Scrape full content or use search snippet
            let content = item.content || '';
            try {
              const scraped = await Scraper.scrape(item.url, { minLength: 150 });
              if (scraped.content && scraped.content.length > 200) {
                content = scraped.content.substring(0, 3000);
              }
            } catch {
              // Fall back to search snippet
            }

            const finding: DeepResearchFinding = {
              title: item.title,
              url: item.url,
              content,
              sourceCategory: 'web',
              publishedDate: item.publishedDate,
              hopLevel: 1,
            };

            branchFindings.push(finding);
            allFindings.push(finding);
          }
        } catch (searchErr) {
          console.warn(`[DeepResearch] Search error on query "${q}":`, searchErr);
        }
      }

      // Hop 2: Gap Analysis & Refinement Query (if depth >= 2)
      if (maxDepth >= 2 && branchFindings.length > 0 && !options.signal?.aborted) {
        this.emitProgress(session, {
          stage: 'analyzing_gaps',
          currentDepth: 2,
          maxDepth,
          activeTopic: hyp.topic,
          discoveredSourcesCount: allSources.length,
          completedBranches: bIdx,
          totalBranches,
        });

        try {
          const gapPrompt = `Based on the following collected snippets for "${hyp.topic} (${hyp.angle})", identify one critical unanswered question or nuance and produce ONE concise search query to investigate it.

Snippets:
${branchFindings.map((f) => f.title + ': ' + f.content.substring(0, 300)).join('\n\n')}

Return ONLY the refined query string, nothing else.`;

          const gapRes = await llm.generateText({
            messages: [
              { role: 'system', content: 'You are a research refinement assistant. Return only the single query string.' },
              { role: 'user', content: gapPrompt },
            ],
          });
          const followUpQuery = (gapRes.content || '').trim().replace(/^"/, '').replace(/"$/, '');

          if (followUpQuery && followUpQuery.length > 4) {
            const hop2Res = await searchSearxng(followUpQuery, {
              categories: ['general'],
            });

            for (const item of (hop2Res.results || []).slice(0, 3)) {
              if (!item.url || visitedUrls.has(item.url)) continue;
              visitedUrls.add(item.url);

              allSources.push({
                title: item.title,
                url: item.url,
                publishedDate: item.publishedDate,
              });

              allFindings.push({
                title: item.title,
                url: item.url,
                content: item.content || '',
                sourceCategory: 'web_deep',
                publishedDate: item.publishedDate,
                hopLevel: 2,
              });
            }
          }
        } catch (gapErr) {
          console.warn('[DeepResearch] Gap refinement skipped:', gapErr);
        }
      }

      hyp.status = 'completed';
      hyp.findingsCount = branchFindings.length;
    }

    return { allFindings, allSources };
  }

  /**
   * Step 3: Synthesize exhaustive multi-section publication-grade whitepaper
   */
  async synthesizeWhitepaper(
    query: string,
    plan: DeepResearchPlan,
    findings: DeepResearchFinding[],
    sources: Array<{ title: string; url: string; publishedDate?: string }>,
    llm: BaseLLM<any>,
    systemInstructions?: string,
  ): Promise<string> {
    const formattedSources = findings
      .slice(0, 15)
      .map(
        (f, idx) =>
          `[${idx + 1}] Title: ${f.title}\nURL: ${f.url}\nExcerpt:\n${f.content.substring(0, 1000)}`,
      )
      .join('\n\n---\n\n');

    const synthesisPrompt = `You are a Distinguished Research Fellow. Synthesize a comprehensive, exhaustive, publication-grade Deep Research Whitepaper addressing the user's inquiry based on the collected multi-hop evidence below.

Original Topic: "${query}"
Executive Focus: "${plan.executiveFocus}"

Evidence Base:
${formattedSources}

Instructions:
1. Produce an in-depth, structured report with Markdown headings:
   - # Title (Academic, informative, professional)
   - ## Executive Summary (High-level synthesis of key findings)
   - ## Background, Foundations & Context
   - ## In-Depth Analysis & Comparative Findings (Use markdown tables where appropriate)
   - ## Conflicting Perspectives, Trade-offs & Limitations
   - ## Strategic Outlook & Actionable Recommendations
   - ## References (List cited sources corresponding to [1], [2], etc.)
2. Cite sources accurately using bracket notation [1], [2] matching the indexes above.
3. Provide rigorous, objective, and deeply informative analysis.`;

    const reportRes = await llm.generateText({
      messages: [
        {
          role: 'system',
          content: systemInstructions
            ? `${systemInstructions}\n\nYou are writing an exhaustive deep research whitepaper.`
            : 'You are writing an exhaustive, publication-grade research whitepaper. Be thorough, detailed, and clear.',
        },
        { role: 'user', content: synthesisPrompt },
      ],
    });

    return reportRes.content || '';
  }

  /**
   * Complete Deep Research execution loop
   */
  async runDeepResearch(
    query: string,
    llm: BaseLLM<any>,
    session: SessionManager,
    options: {
      systemInstructions?: string;
      maxDepth?: number;
      signal?: AbortSignal;
    } = {},
  ): Promise<DeepResearchResult> {
    const startTime = Date.now();

    this.emitProgress(session, {
      stage: 'planning',
      currentDepth: 0,
      maxDepth: options.maxDepth || 2,
      discoveredSourcesCount: 0,
      completedBranches: 0,
      totalBranches: 3,
    });

    const plan = await this.formulatePlan(query, llm, options.systemInstructions);

    const { allFindings, allSources } = await this.executeResearch(
      plan,
      llm,
      session,
      options,
    );

    this.emitProgress(session, {
      stage: 'synthesizing',
      currentDepth: options.maxDepth || 2,
      maxDepth: options.maxDepth || 2,
      discoveredSourcesCount: allSources.length,
      completedBranches: plan.hypotheses.length,
      totalBranches: plan.hypotheses.length,
    });

    const whitepaper = await this.synthesizeWhitepaper(
      query,
      plan,
      allFindings,
      allSources,
      llm,
      options.systemInstructions,
    );

    this.emitProgress(session, {
      stage: 'completed',
      currentDepth: options.maxDepth || 2,
      maxDepth: options.maxDepth || 2,
      discoveredSourcesCount: allSources.length,
      completedBranches: plan.hypotheses.length,
      totalBranches: plan.hypotheses.length,
    });

    return {
      whitepaper,
      sources: allSources,
      plan,
      totalSourcesExplored: allSources.length,
      durationMs: Date.now() - startTime,
    };
  }

  private emitProgress(session: SessionManager, progress: DeepResearchProgress) {
    session.emit('data', {
      type: 'deepResearchProgress',
      data: progress,
    });
  }
}

export const deepResearchEngine = new DeepResearchEngine();
export default deepResearchEngine;

