import formatChatHistoryAsString from '@/lib/utils/formatHistory';
import { searchSearxng } from '@/lib/searxng';
import {
  videoSearchFewShots,
  videoSearchPrompt,
} from '@/lib/prompts/media/videos';
import { ChatTurnMessage } from '@/lib/types';
import BaseLLM from '@/lib/models/base/llm';
import z from 'zod';

type VideoSearchChainInput = {
  chatHistory: ChatTurnMessage[];
  query: string;
};

type VideoSearchResult = {
  img_src: string;
  url: string;
  title: string;
  iframe_src: string;
};

const searchVideos = async (
  input: VideoSearchChainInput,
  llm: BaseLLM<any>,
) => {
  const schema = z.object({
    query: z.string().describe('The video search query.'),
  });

  let searchQuery = input.query;
  try {
    const res = await llm.generateObject<typeof schema>({
      messages: [
        {
          role: 'system',
          content: videoSearchPrompt,
        },
        ...videoSearchFewShots,
        {
          role: 'user',
          content: `<conversation>\n${formatChatHistoryAsString(input.chatHistory)}\n</conversation>\n<follow_up>\n${input.query}\n</follow_up>`,
        },
      ],
      schema: schema,
    });
    if (res?.query && res.query.trim().length > 0) {
      searchQuery = res.query.trim();
    }
  } catch (err) {
    console.warn(
      `[searchVideos] LLM query generation failed, falling back to raw query "${input.query}":`,
      err,
    );
  }

  const searchRes = await searchSearxng(searchQuery, {
    engines: ['youtube'],
  });

  const videos: VideoSearchResult[] = [];

  searchRes.results.forEach((result) => {
    if (result.thumbnail && result.url && result.title && result.iframe_src) {
      videos.push({
        img_src: result.thumbnail,
        url: result.url,
        title: result.title,
        iframe_src: result.iframe_src.replace(
          /https?:\/\/(www\.)?youtube-nocookie\.com/g,
          'https://www.youtube.com',
        ),
      });
    }
  });

  return videos.slice(0, 10);
};

export default searchVideos;
