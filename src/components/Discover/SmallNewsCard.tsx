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

const SmallNewsCard = ({ item }: { item: Discover }) => (
  <Link
    href={`/?q=Summary: ${item.url}`}
    className="rounded-3xl overflow-hidden bg-light-secondary dark:bg-dark-secondary shadow-sm shadow-light-200/10 dark:shadow-black/25 group flex flex-col"
    target="_blank"
  >
    <div className="relative aspect-video overflow-hidden">
      <img
        className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-300"
        src={formatThumbnail(item.thumbnail)}
        alt={item.title}
        onError={(e) => {
          (e.target as HTMLImageElement).src =
            'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=800&q=80';
        }}
      />
    </div>
    <div className="p-4">
      <h3 className="font-semibold text-sm mb-2 leading-tight line-clamp-2 group-hover:text-cyan-500 dark:group-hover:text-cyan-300 transition duration-200">
        {item.title}
      </h3>
      <p className="text-black/60 dark:text-white/60 text-xs leading-relaxed line-clamp-2">
        {item.content}
      </p>
    </div>
  </Link>
);

export default SmallNewsCard;
