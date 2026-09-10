import searchImages from '@/lib/agents/media/image';
import ModelRegistry from '@/lib/models/registry';
import { ModelWithProvider } from '@/lib/models/types';

interface ImageSearchBody {
  query: string;
  chatHistory: any[];
  chatModel: ModelWithProvider;
}

export const POST = async (req: Request) => {
  try {
    const body: ImageSearchBody = await req.json();
    if (!body.chatModel?.key || !body.chatModel?.providerId) {
      return Response.json({ images: [] }, { status: 200 });
    }

    const registry = new ModelRegistry();

    const llm = await registry.loadChatModel(
      body.chatModel.providerId,
      body.chatModel.key,
    );

    const images = await searchImages(
      {
        chatHistory: body.chatHistory.map(([role, content]) => ({
          role: role === 'human' ? 'user' : 'assistant',
          content,
        })),
        query: body.query,
      },
      llm,
    );

    return Response.json({ images }, { status: 200 });
  } catch (err) {
    console.error('[Images API] Error occurred while searching images:', err);
    return Response.json(
      { message: 'An error occurred while searching images', images: [] },
      { status: 500 },
    );
  }
};
