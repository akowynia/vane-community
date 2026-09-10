import handleVideoSearch from '@/lib/agents/media/video';
import ModelRegistry from '@/lib/models/registry';
import { ModelWithProvider } from '@/lib/models/types';

interface VideoSearchBody {
  query: string;
  chatHistory: any[];
  chatModel: ModelWithProvider;
}

export const POST = async (req: Request) => {
  try {
    const body: VideoSearchBody = await req.json();
    if (!body.chatModel?.key || !body.chatModel?.providerId) {
      return Response.json({ videos: [] }, { status: 200 });
    }

    const registry = new ModelRegistry();

    const llm = await registry.loadChatModel(
      body.chatModel.providerId,
      body.chatModel.key,
    );

    const videos = await handleVideoSearch(
      {
        chatHistory: body.chatHistory.map(([role, content]) => ({
          role: role === 'human' ? 'user' : 'assistant',
          content,
        })),
        query: body.query,
      },
      llm,
    );

    return Response.json({ videos }, { status: 200 });
  } catch (err) {
    console.error('[Videos API] Error occurred while searching videos:', err);
    return Response.json(
      { message: 'An error occurred while searching videos', videos: [] },
      { status: 500 },
    );
  }
};
