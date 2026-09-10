import BaseEmbedding from '@/lib/models/base/embedding';
import BaseLLM from '@/lib/models/base/llm';
import {
  searchSearxng,
  SearxngSearchOptions,
  SearxngUnresponsiveEngine,
} from '@/lib/searxng';
import SessionManager from '@/lib/session';
import { Chunk, ResearchBlock, SearchResultsResearchBlock } from '@/lib/types';
import { SearchAgentConfig } from '../../../types';
import computeSimilarity from '@/lib/utils/computeSimilarity';
import z from 'zod';
import Scraper from '@/lib/scraper';
import { splitText, getTokenCount } from '@/lib/utils/splitText';

export const normalizeUrl = (url?: string): string => {
  if (!url) return '';
  try {
    const parsed = new URL(url);
    const trackingParams = [
      'utm_source',
      'utm_medium',
      'utm_campaign',
      'utm_term',
      'utm_content',
      'ref',
      'source',
      'fbclid',
      'gclid',
    ];
    trackingParams.forEach((p) => parsed.searchParams.delete(p));
    const pathname = parsed.pathname.replace(/\/+$/, '') || '/';
    let clean = `${parsed.protocol}//${parsed.hostname.toLowerCase()}${pathname}`;
    if (parsed.search) {
      clean += parsed.search;
    }
    return clean;
  } catch {
    return url.trim().toLowerCase().replace(/\/+$/, '');
  }
};

export const normalizeTitle = (title?: string): string => {
  if (!title) return '';
  return title
    .toLowerCase()
    .replace(
      /\s*[-–|:]\s*(pubmed|ncbi|sciencedirect|researchgate|google scholar|arxiv|springer|wiley|nature|frontiers|plos|ieee|biorxiv|medrxiv|science|cell).*$/i,
      '',
    )
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

export const areTitlesSimilar = (title1?: string, title2?: string): boolean => {
  const t1 = normalizeTitle(title1);
  const t2 = normalizeTitle(title2);
  if (!t1 || !t2) return false;
  if (t1 === t2) return true;

  if (t1.length >= 15 && t2.length >= 15) {
    if (t1.includes(t2) || t2.includes(t1)) return true;
  }

  const words1 = new Set(t1.split(' ').filter((w) => w.length >= 3));
  const words2 = new Set(t2.split(' ').filter((w) => w.length >= 3));
  if (words1.size === 0 || words2.size === 0) return false;

  const intersection = new Set([...words1].filter((w) => words2.has(w)));
  const union = new Set([...words1, ...words2]);
  const jaccard = intersection.size / union.size;

  return jaccard >= 0.7;
};

const emitSearchWarnings = (
  collectedUnresponsive: SearxngUnresponsiveEngine[],
  totalResultsCount: number,
  researchBlock: ResearchBlock,
  session: InstanceType<typeof SessionManager>,
) => {
  const uniqueCaptchaEngines = Array.from(
    new Set(
      collectedUnresponsive
        .filter((e) => e.type === 'captcha')
        .map((e) => e.engine),
    ),
  );

  const uniqueRateLimitEngines = Array.from(
    new Set(
      collectedUnresponsive
        .filter((e) => e.type === 'rate_limit')
        .map((e) => e.engine),
    ),
  );

  const uniqueErrorEngines = Array.from(
    new Set(
      collectedUnresponsive
        .filter((e) => e.type === 'blocked' || e.type === 'error')
        .map((e) => e.engine),
    ),
  );

  let hasWarnings = false;

  if (uniqueCaptchaEngines.length > 0) {
    hasWarnings = true;
    researchBlock.data.subSteps.push({
      id: crypto.randomUUID(),
      type: 'search_warning',
      warningType: 'captcha',
      engines: uniqueCaptchaEngines,
    });
  }

  if (uniqueRateLimitEngines.length > 0) {
    hasWarnings = true;
    researchBlock.data.subSteps.push({
      id: crypto.randomUUID(),
      type: 'search_warning',
      warningType: 'rate_limit',
      engines: uniqueRateLimitEngines,
    });
  }

  if (uniqueErrorEngines.length > 0) {
    hasWarnings = true;
    researchBlock.data.subSteps.push({
      id: crypto.randomUUID(),
      type: 'search_warning',
      warningType: 'error',
      engines: uniqueErrorEngines,
    });
  }

  if (totalResultsCount === 0 && collectedUnresponsive.length === 0) {
    hasWarnings = true;
    researchBlock.data.subSteps.push({
      id: crypto.randomUUID(),
      type: 'search_warning',
      warningType: 'no_results',
      engines: [],
    });
  }

  if (hasWarnings) {
    session.updateBlock(researchBlock.id, [
      {
        op: 'replace',
        path: '/data/subSteps',
        value: researchBlock.data.subSteps,
      },
    ]);
  }
};

export const executeSearch = async (input: {
  queries: string[];
  mode: SearchAgentConfig['mode'];
  searchConfig?: SearxngSearchOptions;
  researchBlock: ResearchBlock;
  session: InstanceType<typeof SessionManager>;
  llm: BaseLLM<any>;
  embedding: BaseEmbedding<any>;
  tokenTracker?: {
    addTokens: (count: number) => void;
    getUsedTokens: () => number;
    isLimitExceeded: () => boolean;
  };
}) => {
  const researchBlock = input.researchBlock;

  researchBlock.data.subSteps.push({
    id: crypto.randomUUID(),
    type: 'searching',
    searching: input.queries,
  });

  input.session.updateBlock(researchBlock.id, [
    {
      op: 'replace',
      path: '/data/subSteps',
      value: researchBlock.data.subSteps,
    },
  ]);

  if (input.mode === 'speed' || input.mode === 'balanced') {
    const searchResultsBlockId = crypto.randomUUID();
    let searchResultsEmitted = false;

    const results: Chunk[] = [];
    const collectedUnresponsive: SearxngUnresponsiveEngine[] = [];

    const search = async (q: string) => {
      try {
        let res = await searchSearxng(q, {
          ...(input.searchConfig ? input.searchConfig : {}),
        });

        // Fallback: if a query restricted to a category (e.g. 'general') returned 0 results,
        // retry without the categories parameter in case the external SearXNG has no active engines in that category
        if (
          res.results.length === 0 &&
          input.searchConfig?.categories &&
          input.searchConfig.categories.length > 0
        ) {
          console.log(
            `[baseSearch] Category "${input.searchConfig.categories.join(',')}" returned 0 results for "${q}". Retrying without category restriction...`,
          );
          try {
            const fallbackOpts = { ...input.searchConfig };
            delete fallbackOpts.categories;
            const fallbackRes = await searchSearxng(q, fallbackOpts);
            if (fallbackRes.results.length > 0) {
              console.log(
                `[baseSearch] Category fallback search retrieved ${fallbackRes.results.length} results for "${q}".`,
              );
              res = fallbackRes;
            }
          } catch (fallbackErr: any) {
            console.warn(
              `[baseSearch] Fallback search without categories failed for "${q}":`,
              fallbackErr?.message || fallbackErr,
            );
          }
        }

        if (res.unresponsiveEngines && res.unresponsiveEngines.length > 0) {
          collectedUnresponsive.push(...res.unresponsiveEngines);
        }

        let resultChunks: Chunk[] = [];

        try {
          const contents = res.results.map((r) => r.content || r.title);

          const [queryEmbeddingRes, chunkEmbeddings] = await Promise.all([
            input.embedding.embedText([q]),
            contents.length > 0
              ? input.embedding.embedText(contents)
              : Promise.resolve([]),
          ]);

          const queryEmbedding = queryEmbeddingRes[0];

          const scoredChunks: Chunk[] = res.results.map((r, idx) => {
            const content = contents[idx];
            const chunkEmbedding = chunkEmbeddings[idx] || [];

            return {
              content,
              metadata: {
                title: r.title,
                url: r.url,
                similarity:
                  queryEmbedding && chunkEmbedding.length > 0
                    ? computeSimilarity(queryEmbedding, chunkEmbedding)
                    : 1,
                embedding: chunkEmbedding,
              },
            };
          });

          const filtered = scoredChunks.filter((c) => c.metadata.similarity > 0.3);
          resultChunks = filtered.length > 0 ? filtered : scoredChunks;
        } catch (err: any) {
          console.warn(
            `[baseSearch] Embedding calculation failed for query "${q}", falling back to unranked results:`,
            err?.message || err,
          );
          resultChunks = res.results.map((r) => {
            const content = r.content || r.title;

            return {
              content,
              metadata: {
                title: r.title,
                url: r.url,
                similarity: 1,
                embedding: [],
              },
            };
          });
        } finally {
          results.push(...resultChunks);
        }

        if (!searchResultsEmitted) {
          searchResultsEmitted = true;

          researchBlock.data.subSteps.push({
            id: searchResultsBlockId,
            type: 'search_results',
            reading: resultChunks,
          });

          input.session.updateBlock(researchBlock.id, [
            {
              op: 'replace',
              path: '/data/subSteps',
              value: researchBlock.data.subSteps,
            },
          ]);
        } else if (searchResultsEmitted) {
          const subStepIndex = researchBlock.data.subSteps.findIndex(
            (step) => step.id === searchResultsBlockId,
          );

          if (subStepIndex !== -1) {
            const subStep = researchBlock.data.subSteps[
              subStepIndex
            ] as SearchResultsResearchBlock;

            subStep.reading.push(...resultChunks);

            input.session.updateBlock(researchBlock.id, [
              {
                op: 'replace',
                path: '/data/subSteps',
                value: researchBlock.data.subSteps,
              },
            ]);
          }
        }
      } catch (searchErr: any) {
        console.error(
          `[baseSearch] Search execution failed for query "${q}":`,
          searchErr?.message || searchErr,
        );
      }
    };

    await Promise.all(input.queries.map(search));

    emitSearchWarnings(
      collectedUnresponsive,
      results.length,
      researchBlock,
      input.session,
    );

    results.sort((a, b) => b.metadata.similarity - a.metadata.similarity);

    const uniqueSearchResultIndices: Set<number> = new Set();

    for (let i = 0; i < results.length; i++) {
      let isDuplicate = false;
      const currentUrl = normalizeUrl(results[i].metadata.url);
      const currentTitle = results[i].metadata.title;

      for (const indice of uniqueSearchResultIndices.keys()) {
        const existingUrl = normalizeUrl(results[indice].metadata.url);
        const existingTitle = results[indice].metadata.title;

        // 1. Check for an identical or normalized URL
        if (currentUrl && existingUrl && currentUrl === existingUrl) {
          isDuplicate = true;
          break;
        }

        // 2. Check for the same academic article / study by title (e.g. PubMed vs ScienceDirect)
        if (
          currentTitle &&
          existingTitle &&
          areTitlesSimilar(currentTitle, existingTitle)
        ) {
          isDuplicate = true;
          break;
        }

        // 3. Check vector similarity if embeddings are available
        if (
          results[i].metadata.embedding &&
          results[indice].metadata.embedding &&
          results[i].metadata.embedding.length > 0 &&
          results[indice].metadata.embedding.length > 0
        ) {
          const similarity = computeSimilarity(
            results[i].metadata.embedding,
            results[indice].metadata.embedding,
          );

          if (similarity > 0.75) {
            isDuplicate = true;
            break;
          }
        }
      }

      if (!isDuplicate) {
        uniqueSearchResultIndices.add(i);
      }
    }

    const uniqueSearchResults = Array.from(uniqueSearchResultIndices.keys())
      .map((i) => {
        const uniqueResult = results[i];

        delete uniqueResult.metadata.embedding;
        delete uniqueResult.metadata.similarity;

        return uniqueResult;
      })
      .slice(0, 20);

    return uniqueSearchResults;
  } else if (input.mode === 'quality') {
    const searchResultsBlockId = crypto.randomUUID();
    let searchResultsEmitted = false;

    const searchResults: Chunk[] = [];
    const collectedUnresponsive: SearxngUnresponsiveEngine[] = [];

    const isAntiBotOrBlocked = (title?: string, content?: string): boolean => {
      const text = `${title || ''} ${content || ''}`.toLowerCase();
      return (
        text.includes('blocked by security policy') ||
        text.includes('attention required! | cloudflare') ||
        text.includes('403 forbidden') ||
        text.includes('access denied') ||
        text.includes('captcha')
      );
    };

    const search = async (q: string) => {
      try {
        let res = await searchSearxng(q, {
          ...(input.searchConfig ? input.searchConfig : {}),
        });

        if (
          res.results.length === 0 &&
          input.searchConfig?.categories &&
          input.searchConfig.categories.length > 0
        ) {
          console.log(
            `[baseSearch] Quality mode category "${input.searchConfig.categories.join(',')}" returned 0 results for "${q}". Retrying without category restriction...`,
          );
          try {
            const fallbackOpts = { ...input.searchConfig };
            delete fallbackOpts.categories;
            const fallbackRes = await searchSearxng(q, fallbackOpts);
            if (fallbackRes.results.length > 0) {
              console.log(
                `[baseSearch] Quality mode fallback retrieved ${fallbackRes.results.length} results for "${q}".`,
              );
              res = fallbackRes;
            }
          } catch (fallbackErr: any) {
            console.warn(
              `[baseSearch] Quality mode fallback search failed for "${q}":`,
              fallbackErr?.message || fallbackErr,
            );
          }
        }

        if (res.unresponsiveEngines && res.unresponsiveEngines.length > 0) {
          collectedUnresponsive.push(...res.unresponsiveEngines);
        }

        let resultChunks: Chunk[] = [];

        // Wczesne filtrowanie relewancji cosine similarity > 0.3 w trybie Quality przed LLM Pickerem
        try {
          const cleanResults = res.results.filter(
            (r) => !isAntiBotOrBlocked(r.title, r.content),
          );
          const contents = cleanResults.map((r) => r.content || r.title);

          const [queryEmbeddingRes, chunkEmbeddings] = await Promise.all([
            input.embedding.embedText([q]),
            contents.length > 0
              ? input.embedding.embedText(contents)
              : Promise.resolve([]),
          ]);

          const queryEmbedding = queryEmbeddingRes[0];

          const scoredChunks: Chunk[] = cleanResults.map((r, idx) => {
            const content = contents[idx];
            const chunkEmbedding = chunkEmbeddings[idx] || [];

            return {
              content,
              metadata: {
                title: r.title,
                url: r.url,
                similarity:
                  queryEmbedding && chunkEmbedding.length > 0
                    ? computeSimilarity(queryEmbedding, chunkEmbedding)
                    : 1,
                embedding: chunkEmbedding,
              },
            };
          });

          const filtered = scoredChunks.filter((c) => c.metadata.similarity > 0.3);
          resultChunks = filtered.length > 0 ? filtered : scoredChunks;
        } catch (embedErr: any) {
          console.warn(
            `[baseSearch] Quality mode embedding calculation failed for "${q}", falling back to raw results:`,
            embedErr?.message || embedErr,
          );
          resultChunks = res.results
            .filter((r) => !isAntiBotOrBlocked(r.title, r.content))
            .map((r) => {
              const content = r.content || r.title;
              return {
                content,
                metadata: {
                  title: r.title,
                  url: r.url,
                  similarity: 1,
                  embedding: [],
                },
              };
            });
        }

        searchResults.push(...resultChunks);

        if (!searchResultsEmitted) {
          searchResultsEmitted = true;

          researchBlock.data.subSteps.push({
            id: searchResultsBlockId,
            type: 'search_results',
            reading: resultChunks,
          });

          input.session.updateBlock(researchBlock.id, [
            {
              op: 'replace',
              path: '/data/subSteps',
              value: researchBlock.data.subSteps,
            },
          ]);
        } else if (searchResultsEmitted) {
          const subStepIndex = researchBlock.data.subSteps.findIndex(
            (step) => step.id === searchResultsBlockId,
          );

          if (subStepIndex !== -1) {
            const subStep = researchBlock.data.subSteps[
              subStepIndex
            ] as SearchResultsResearchBlock;

            subStep.reading.push(...resultChunks);

            input.session.updateBlock(researchBlock.id, [
              {
                op: 'replace',
                path: '/data/subSteps',
                value: researchBlock.data.subSteps,
              },
            ]);
          }
        }
      } catch (searchErr: any) {
        console.error(
          `[baseSearch] Quality mode search execution failed for query "${q}":`,
          searchErr?.message || searchErr,
        );
      }
    };

    await Promise.all(input.queries.map(search));

    emitSearchWarnings(
      collectedUnresponsive,
      searchResults.length,
      researchBlock,
      input.session,
    );

    // Sort results by vector relevance before passing them to the LLM Picker
    searchResults.sort(
      (a, b) => (b.metadata?.similarity || 0) - (a.metadata?.similarity || 0),
    );

    const pickerPrompt = `
      Assistant is an AI search result picker. Assistant's task is to pick 2-3 of the most relevant search results based off the query which can be then scraped for information to answer the query.
      Assistant will be shared with the search results retrieved from a search engine along with the queries used to retrieve those results. Assistant will then pick maxiumum 3 of the most relevant search results based on the queries and the content of the search results. Assistant should only pick search results that are relevant to the query and can help in answering the question.
      
      ## Things to taken into consideration when picking the search results:
      1. Relevance to the query: The search results should be relevant to the query provided. Irrelevant results should be ignored.
      2. Content quality: The content of the search results should be of high quality and provide valuable information that can help in answering the question.
      3. Favour known and reputable sources: If there are search results from known and reputable sources that are relevant to the query, those should be prioritized.
      4. Diversity: If there are multiple search results that are relevant and of high quality, try to pick results that provide diverse perspectives or information to get a well-rounded understanding of the topic.
      5. Avoid picking search results that are too similar to each other in terms of content to maximize the amount of information gathered.
      6. Maximum 3 results: Assistant should pick a maximum of 3 search results. If there are more than 3 relevant and high-quality search results, pick the top 3 based on the above criteria. If the queries are very specific and there are only 1 or 2 relevant search results, it's okay to pick only those 1 or 2 results.
      7. Try to pick only one high quality result unless there are diverse perspective in multiple results then you can pick a maximum of 3.
      8. Analyze the title, the snippet and the URL to determine the relevant to query, quality of the content that might be present inside and the reputation of the source before picking the search result.
      
      ## Output format
      Assistant should output an array of indices corresponding to the search results that were picked based on the above criteria. The indices should be based on the order of the search results provided to Assistant. For example, if Assistant picks the 1st, 3rd, and 5th search results, Assistant should output [0, 2, 4].
      
      <example_output>
      {
       "picked_indices": [0,2,4]
      }
      </example_output>
      `;

    const pickerSchema = z.object({
      picked_indices: z
        .array(z.number())
        .describe(
          'The array of the picked indices to be scraped for answering',
        ),
    });

    const deduplicatedSearchResults: Chunk[] = [];
    for (const r of searchResults) {
      const rUrl = normalizeUrl(r.metadata?.url);
      const rTitle = r.metadata?.title;
      const isDup = deduplicatedSearchResults.some((u) => {
        const uUrl = normalizeUrl(u.metadata?.url);
        const uTitle = u.metadata?.title;
        if (rUrl && uUrl && rUrl === uUrl) return true;
        if (rTitle && uTitle && areTitlesSimilar(rTitle, uTitle)) return true;
        return false;
      });
      if (!isDup) {
        deduplicatedSearchResults.push(r);
      }
    }

    // Check whether the token budget is already exhausted before calling the picker
    if (input.tokenTracker?.isLimitExceeded()) {
      return deduplicatedSearchResults.slice(0, 5);
    }

    let pickedIndices: number[] = [];
    try {
      const pickerUserContent = `<queries>${input.queries.join(', ')}</queries>\n<search_results>${deduplicatedSearchResults.map((result, index) => `<result indice=${index}>${JSON.stringify(result)}</result>`).join('\n')}</search_results>`;
      
      if (input.tokenTracker) {
        input.tokenTracker.addTokens(
          getTokenCount(pickerPrompt) + getTokenCount(pickerUserContent),
        );
      }

      const pickerResponse = await input.llm.generateObject<typeof pickerSchema>({
        schema: pickerSchema,
        messages: [
          {
            role: 'system',
            content: pickerPrompt,
          },
          {
            role: 'user',
            content: pickerUserContent,
          },
        ],
      });

      if (input.tokenTracker && pickerResponse) {
        input.tokenTracker.addTokens(getTokenCount(JSON.stringify(pickerResponse)));
      }

      pickedIndices = Array.isArray(pickerResponse?.picked_indices)
        ? pickerResponse.picked_indices.slice(0, 3)
        : [];
    } catch (pickerErr) {
      console.warn('[baseSearch] Picker LLM call failed, falling back to top search results:', pickerErr);
      pickedIndices = [0, 1, 2].slice(0, Math.min(3, deduplicatedSearchResults.length));
    }

    if (pickedIndices.length === 0 && deduplicatedSearchResults.length > 0) {
      pickedIndices = [0, 1, 2].slice(0, Math.min(3, deduplicatedSearchResults.length));
    }

    const pickedResults = pickedIndices
      .map((i) => deduplicatedSearchResults[i])
      .filter((r) => r !== undefined);

    const alreadyExtractedURLs: string[] = [];

    researchBlock.data.subSteps.forEach((step) => {
      if (step.type === 'reading') {
        step.reading.forEach((chunk) => {
          alreadyExtractedURLs.push(chunk.metadata.url);
        });
      }
    });

    const filteredResults = pickedResults.filter(
      (r) =>
        !alreadyExtractedURLs.some(
          (url) =>
            url === r.metadata.url ||
            (normalizeUrl(url) && normalizeUrl(url) === normalizeUrl(r.metadata.url)),
        ),
    );

    if (filteredResults.length > 0) {
      researchBlock.data.subSteps.push({
        id: crypto.randomUUID(),
        type: 'reading',
        reading: filteredResults,
      });

      input.session.updateBlock(researchBlock.id, [
        {
          path: '/data/subSteps',
          op: 'replace',
          value: researchBlock.data.subSteps,
        },
      ]);
    }

    const extractedFacts: Chunk[] = [];

    const extractorPrompt = `
      Assistant is an AI information extractor. Assistant will be shared with scraped information from a website along with the queries used to retrieve that information. Assistant's task is to extract relevant facts from the scraped data to answer the queries.

      ## Things to taken into consideration when extracting information:
      1. Relevance to the query: The extracted information must dynamically adjust based on the query's intent. If the query asks "What is [X]", you must extract the definition/identity. If the query asks for "[X] specs" or "features", you must provide deep, granular technical details.
         - Example: For "What is [Product]", extract the core definition. For "[Product] capabilities", extract every technical function mentioned.
      2. Concentrate on extracting factual information that can help in answering the question rather than opinions or commentary. Ignore marketing fluff like "best-in-class" or "seamless."
      3. Noise to signal ratio: If the scraped data is noisy (headers, footers, UI text), ignore it and extract only the high-value information. 
         - Example: Discard "Click for more" or "Subscribe now" messages.
      4. Avoid using filler sentences or words; extract concise, telegram-style information.
         - Example: Change "The device features a weight of only 1.2kg" to "Weight: 1.2kg."
      5. Duplicate information: If a fact appears multiple times (e.g., in a paragraph and a technical table), merge the details into a single, high-density bullet point to avoid redundancy.
      6. Numerical Data Integrity: NEVER summarize or generalize numbers, benchmarks, or table data. Extract raw values exactly as they appear.
         - Example: Do not say "Improved coding scores." Say "LiveCodeBench v6: 80.0%."

      ## Example
      For example, if the query is "What are the health benefits of green tea?" and the scraped data contains various pieces of information about green tea, Assistant should focus on extracting factual information related to the health benefits of green tea such as "Green tea contains antioxidants which can help in reducing inflammation" and ignore irrelevant information such as "Green tea is a popular beverage worldwide".
      
      It can also remove filler words to reduce the sentence to "Contains antioxidants; reduces inflammation." 
      
      For tables/numerical data extraction, Assistant should extract the raw numerical data or the content of the table without trying to summarize it to avoid losing important details. For example, if a table lists specific battery life hours for different modes, Assistant should list every mode and its corresponding hour count rather than giving a general average.
      
      Make sure the extracted facts are in bullet points format to make it easier to read and understand.

      ## Output format
      Assistant should reply with a JSON object containing a key "extracted_facts" which is a string of the bulleted facts. Return only raw JSON without markdown formatting (no \`\`\`json blocks).

      <example_output>
      {
        "extracted_facts": "- Fact 1\n- Fact 2\n- Fact 3"
      }
      </example_output>
      `;

    const extractorSchema = z.object({
      extracted_facts: z
        .string()
        .describe(
          'The extracted facts that are relevant to the query and can help in answering the question should be listed here in a concise manner.',
        ),
    });

    for (const result of filteredResults) {
      if (input.tokenTracker?.isLimitExceeded()) {
        console.warn(
          '[baseSearch] Token budget limit reached during scraping, breaking early.',
        );
        break;
      }

      try {
        const scrapedData = await Scraper.scrape(result.metadata.url, {
          optimizationMode: 'quality',
        }).catch((err) => {
          console.log('Error scraping data from', result.metadata.url, err);
          return null;
        });

        if (!scrapedData || scrapedData.error || !scrapedData.content) {
          console.warn(
            `[baseSearch] Skipping ${result.metadata.url} due to extraction failure: ${scrapedData?.error || 'no_data'}`,
          );
          continue;
        }

        let accumulatedContent = '';
        // Limit to max 2 most important chunks per page to conserve the token budget
        const chunks = splitText(scrapedData.content, 4000, 500).slice(0, 2);

        for (const chunk of chunks) {
          if (input.tokenTracker?.isLimitExceeded()) {
            console.warn(
              '[baseSearch] Token budget limit reached during chunk extraction, stopping further chunks.',
            );
            break;
          }

          try {
            const userContent = `<queries>${input.queries.join(', ')}</queries>\n<scraped_data>${chunk}</scraped_data>`;
            if (input.tokenTracker) {
              input.tokenTracker.addTokens(
                getTokenCount(extractorPrompt) + getTokenCount(userContent),
              );
            }

            const extractorOutput = await input.llm.generateObject<
              typeof extractorSchema
            >({
              schema: extractorSchema,
              messages: [
                {
                  role: 'system',
                  content: extractorPrompt,
                },
                {
                  role: 'user',
                  content: userContent,
                },
              ],
            });

            if (input.tokenTracker && extractorOutput?.extracted_facts) {
              input.tokenTracker.addTokens(
                getTokenCount(extractorOutput.extracted_facts),
              );
            }

            accumulatedContent += (extractorOutput?.extracted_facts || '') + '\n';
          } catch (err) {
            console.log('Error extracting information from chunk', err);
          }
        }

        if (accumulatedContent.trim().length > 0) {
          extractedFacts.push({
            ...result,
            content: accumulatedContent.trim(),
          });
        }
      } catch (err) {
        console.log(
          'Error scraping or extracting information from',
          result.metadata.url,
          err,
        );
      }
    }

    // If nothing was extracted, or due to the limit, include the top snippets instead
    if (extractedFacts.length === 0 && deduplicatedSearchResults.length > 0) {
      return deduplicatedSearchResults.slice(0, 5);
    }

    return extractedFacts;
  } else {
    return [];
  }
};
