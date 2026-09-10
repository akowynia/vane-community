import { searchSearxng } from '@/lib/searxng';

const fallbackThumbnails: Record<string, string[]> = {
  tech: [
    'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1504639725590-34d0984388bd?auto=format&fit=crop&w=800&q=80',
  ],
  finance: [
    'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=800&q=80',
  ],
  art: [
    'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1547891654-e66ed7ebb968?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1513364776144-60967b0f800f?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?auto=format&fit=crop&w=800&q=80',
  ],
  sports: [
    'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1517649763962-0c623266ddc0?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=800&q=80',
  ],
  entertainment: [
    'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=800&q=80',
  ],
};

const websitesForTopic = {
  tech: {
    query: [
      'technology news',
      'latest tech AI gadgets',
      'science innovation',
      'wired techcrunch verge',
    ],
    links: ['techcrunch.com', 'wired.com', 'theverge.com', 'arstechnica.com'],
  },
  finance: {
    query: [
      'finance news economy',
      'stock market investing',
      'business news',
      'bloomberg cnbc marketwatch',
    ],
    links: ['bloomberg.com', 'cnbc.com', 'marketwatch.com', 'reuters.com'],
  },
  art: {
    query: [
      'art news culture',
      'contemporary modern art',
      'cultural events exhibitions',
      'design architecture news',
    ],
    links: [
      'artnews.com',
      'hyperallergic.com',
      'theartnewspaper.com',
      'designboom.com',
    ],
  },
  sports: {
    query: [
      'sports news latest',
      'football soccer tennis basketball',
      'olympics championship',
      'espn bbc sport',
    ],
    links: ['espn.com', 'bbc.com/sport', 'skysports.com', 'theathletic.com'],
  },
  entertainment: {
    query: [
      'entertainment news movies',
      'TV shows celebrities cinema',
      'music festival awards',
      'variety hollywood reporter',
    ],
    links: [
      'hollywoodreporter.com',
      'variety.com',
      'deadline.com',
      'rollingstone.com',
    ],
  },
};

type Topic = keyof typeof websitesForTopic;

// In-memory cache with a 15-minute TTL to prevent spamming external search engines
interface CacheEntry {
  data: any[];
  timestamp: number;
}

const discoverCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

const getFallbackImage = (topic: string, index: number) => {
  const images = fallbackThumbnails[topic] || fallbackThumbnails.tech;
  return images[index % images.length];
};

export const GET = async (req: Request) => {
  try {
    const params = new URL(req.url).searchParams;

    const mode: 'normal' | 'preview' =
      (params.get('mode') as 'normal' | 'preview') || 'normal';
    const topic: Topic = (params.get('topic') as Topic) || 'tech';

    const selectedTopic = websitesForTopic[topic] || websitesForTopic.tech;
    const cacheKey = `${mode}_${topic}`;

    const cached = discoverCache.get(cacheKey);
    const now = Date.now();

    // If we have fresh data in the cache, return it right away
    if (cached && now - cached.timestamp < CACHE_TTL_MS && cached.data.length > 0) {
      return Response.json(
        {
          blogs: cached.data,
        },
        {
          status: 200,
        },
      );
    }

    let data: any[] = [];

    if (mode === 'normal') {
      const seenUrls = new Set<string>();

      // Select 2-3 balanced queries instead of mass querying
      const primaryQuery = selectedTopic.query[0];
      const secondaryQuery = selectedTopic.query[1] || selectedTopic.query[0];
      const randomLink =
        selectedTopic.links[
          Math.floor(Math.random() * selectedTopic.links.length)
        ];

      const queries = [
        primaryQuery,
        secondaryQuery,
        `site:${randomLink} ${primaryQuery}`,
      ];

      const searchPromises = queries.map(async (query) => {
        try {
          const res = await searchSearxng(query, {
            pageno: 1,
            language: 'en',
          });
          return res?.results || [];
        } catch {
          return [];
        }
      });

      const settledResults = await Promise.allSettled(searchPromises);

      const rawArticles = settledResults
        .filter(
          (result): result is PromiseFulfilledResult<any[]> =>
            result.status === 'fulfilled' && Array.isArray(result.value),
        )
        .flatMap((result) => result.value)
        .filter((item) => {
          const url = item?.url?.toLowerCase().trim();
          if (!url || seenUrls.has(url)) return false;
          seenUrls.add(url);
          return true;
        })
        .sort(() => Math.random() - 0.5);

      if (rawArticles.length > 0) {
        data = rawArticles.map((item, idx) => ({
          title: item.title,
          url: item.url,
          content: item.content || item.title,
          thumbnail:
            item.thumbnail ||
            item.thumbnail_src ||
            item.img_src ||
            getFallbackImage(topic, idx),
        }));
      } else if (cached && cached.data.length > 0) {
        // Use the previous cache if the current query returned empty results
        data = cached.data;
      }
    } else {
      try {
        const randomQuery =
          selectedTopic.query[
            Math.floor(Math.random() * selectedTopic.query.length)
          ];
        const res = await searchSearxng(randomQuery, {
          pageno: 1,
          language: 'en',
        }).catch(() => null);

        const rawResults = res?.results || [];

        if (rawResults.length > 0) {
          data = rawResults.map((item, idx) => ({
            title: item.title,
            url: item.url,
            content: item.content || item.title,
            thumbnail:
              item.thumbnail ||
              item.thumbnail_src ||
              item.img_src ||
              getFallbackImage(topic, idx),
          }));
        } else if (cached && cached.data.length > 0) {
          data = cached.data;
        }
      } catch (err) {
        console.error(`Preview search failed in discover route: ${err}`);
        data = cached?.data || [];
      }
    }

    // Save to cache if we have results
    if (data.length > 0) {
      discoverCache.set(cacheKey, {
        data,
        timestamp: now,
      });
    }

    return Response.json(
      {
        blogs: data,
      },
      {
        status: 200,
      },
    );
  } catch (err: any) {
    console.error(`An error occurred in discover route: ${err?.message || err}`);
    return Response.json(
      {
        blogs: [],
        message: err?.message || 'An error occurred while fetching discover items.',
      },
      {
        status: 200,
      },
    );
  }
};

export const OPTIONS = async () => {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
    },
  });
};

