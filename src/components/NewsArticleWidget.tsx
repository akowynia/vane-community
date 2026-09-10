import { useEffect, useState } from 'react';
import { useTranslation } from '@/lib/i18n';
import { MoreVertical, Newspaper } from 'lucide-react';

interface Article {
  title: string;
  content: string;
  url: string;
  thumbnail: string;
}

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

const NewsArticleWidget = () => {
  const { t } = useTranslation();
  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchNews = () => {
    setLoading(true);
    setError(false);
    fetch('/api/discover?mode=preview')
      .then((res) => res.json())
      .then((data) => {
        const articles = (data.blogs || []).filter((a: Article) => a.thumbnail);
        if (articles.length > 0) {
          setArticle(articles[Math.floor(Math.random() * articles.length)]);
        }
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchNews();
  }, []);

  return (
    <div className="bg-light-secondary/90 dark:bg-[#161412]/85 backdrop-blur-md rounded-2xl border border-light-200 dark:border-[#28221b] shadow-lg shadow-black/20 hover:border-light-300 dark:hover:border-[#3d342a] p-4 flex flex-col justify-between w-full h-[128px] transition duration-200">
      {loading ? (
        <div className="animate-pulse flex flex-col justify-between h-full">
          <div className="flex flex-row items-center justify-between">
            <div className="h-3 w-20 rounded bg-light-200 dark:bg-[#25201a]" />
            <div className="h-3 w-3 rounded-full bg-light-200 dark:bg-[#25201a]" />
          </div>
          <div className="space-y-2 my-1">
            <div className="h-3.5 w-full rounded bg-light-200 dark:bg-[#25201a]" />
            <div className="h-3.5 w-4/5 rounded bg-light-200 dark:bg-[#25201a]" />
          </div>
          <div className="flex flex-row justify-between pt-1 border-t border-light-200/50 dark:border-[#28221b]/60">
            <div className="h-3 w-16 rounded bg-light-200 dark:bg-[#25201a]" />
          </div>
        </div>
      ) : error ? (
        <div className="flex flex-col justify-between h-full">
          <div className="flex flex-row items-center justify-between text-xs text-black/60 dark:text-stone-400 font-medium">
            <span>Local news</span>
            <button onClick={fetchNews} className="text-black/40 dark:text-stone-500 hover:text-black dark:hover:text-stone-300 transition">
              <MoreVertical size={14} />
            </button>
          </div>
          <div className="w-full text-xs text-red-400 my-auto">{t('widgets.couldNotLoadNews')}</div>
        </div>
      ) : article ? (
        <a
          href={`/?q=${encodeURIComponent(t('widgets.summaryPrefix', { url: article.url }))}`}
          className="flex flex-col justify-between h-full group"
        >
          <div className="flex flex-row items-center justify-between text-xs text-black/60 dark:text-stone-400 font-medium">
            <span>Local news</span>
            <span
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                fetchNews();
              }}
              title="Refresh news"
              className="text-black/40 dark:text-stone-500 hover:text-black dark:hover:text-stone-300 transition cursor-pointer p-0.5"
            >
              <MoreVertical size={14} />
            </span>
          </div>
          <div className="flex flex-row items-center space-x-3 my-0.5 overflow-hidden">
            {article.thumbnail && (
              <div className="relative w-11 h-11 min-w-11 max-w-11 rounded-lg overflow-hidden shrink-0 border border-light-200/50 dark:border-[#28221b]">
                <img
                  className="object-cover w-full h-full bg-light-200 dark:bg-[#25201a] group-hover:scale-105 transition-transform duration-300"
                  src={formatThumbnail(article.thumbnail)}
                  alt={article.title}
                  onError={(e) => {
                    (e.target as HTMLImageElement).src =
                      'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=800&q=80';
                  }}
                />
              </div>
            )}
            <div className="font-medium text-xs sm:text-[13px] text-black/85 dark:text-stone-200 leading-snug line-clamp-2 group-hover:text-black dark:group-hover:text-[#e5b780] transition-colors">
              {article.title}
            </div>
          </div>
          <div className="flex flex-row justify-between w-full pt-2 border-t border-light-200/50 dark:border-[#28221b]/60 text-[11px] text-black/50 dark:text-stone-400 font-medium">
            <span className="truncate max-w-[180px]">{article.content || 'Top news story'}</span>
            <span className="shrink-0">{t('widgets.now')}</span>
          </div>
        </a>
      ) : null}
    </div>
  );
};

export default NewsArticleWidget;
