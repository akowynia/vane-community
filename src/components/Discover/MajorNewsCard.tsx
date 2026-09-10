import { Discover } from '@/app/discover/page';
import Link from 'next/link';

const formatThumbnail = (thumbnail?: string): string => {
  if (!thumbnail) return '';
  try {
    const parsed = new URL(thumbnail);
    if (
      parsed.hostname.includes('bing.net') ||
      parsed.hostname.includes('bing.com')
    ) {
      const id = parsed.searchParams.get('id');
      if (id) {
        return `${parsed.origin}${parsed.pathname}?id=${id}`;
      }
    }
    return thumbnail;
  } catch {
    return thumbnail;
  }
};

const MajorNewsCard = ({
  item,
  isLeft = true,
}: {
  item: Discover;
  isLeft?: boolean;
}) => (
  <Link
    href={`/?q=Summary: ${item.url}`}
    className="w-full group flex flex-row items-stretch gap-6 h-60 py-3"
    target="_blank"
  >
    {isLeft ? (
      <>
        <div className="relative w-80 h-full overflow-hidden rounded-2xl flex-shrink-0">
          <img
            className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500"
            src={formatThumbnail(item.thumbnail)}
            alt={item.title}
            onError={(e) => {
              (e.target as HTMLImageElement).src =
                'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=800&q=80';
            }}
          />
        </div>
        <div className="flex flex-col justify-center flex-1 py-4">
          <h2 className="text-2xl font-semibold mb-3 leading-tight line-clamp-3 text-black dark:text-stone-100 group-hover:text-cyan-500 dark:group-hover:text-cyan-300 transition duration-200">
            {item.title}
          </h2>
          <p className="text-black/60 dark:text-white/60 text-base leading-relaxed line-clamp-4">
            {item.content}
          </p>
        </div>
      </>
    ) : (
      <>
        <div className="flex flex-col justify-center flex-1 py-4">
          <h2 className="text-2xl font-semibold mb-3 leading-tight line-clamp-3 text-black dark:text-stone-100 group-hover:text-cyan-500 dark:group-hover:text-cyan-300 transition duration-200">
            {item.title}
          </h2>
          <p className="text-black/60 dark:text-white/60 text-base leading-relaxed line-clamp-4">
            {item.content}
          </p>
        </div>
        <div className="relative w-80 h-full overflow-hidden rounded-2xl flex-shrink-0">
          <img
            className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500"
            src={formatThumbnail(item.thumbnail)}
            alt={item.title}
            onError={(e) => {
              (e.target as HTMLImageElement).src =
                'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=800&q=80';
            }}
          />
        </div>
      </>
    )}
  </Link>
);

export default MajorNewsCard;
