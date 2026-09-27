import { useEffect, useState } from 'react';
import { getNews, type NewsArticle } from '@/services/api';
import { Card, CardHeader, LoadingState, ErrorState, EmptyState } from '@/components/common/UI';
import { fmtDateTime } from '@/utils/format';
import { ExternalLink } from 'lucide-react';

export function NewsSection({ symbol }: { symbol: string }) {
  const [news, setNews] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getNews(symbol);
      setNews(normalizeNews(data));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load news.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetch(); }, [symbol]);

  return (
    <Card>
      <CardHeader title="News" subtitle={symbol} />
      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={fetch} />
      ) : news.length === 0 ? (
        <EmptyState message="No news available" />
      ) : (
        <div className="divide-y divide-neutral-800">
          {news.slice(0, 10).map((article, i) => (
            <div key={article.id || i} className="p-4 hover:bg-neutral-800/30">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <h4 className="text-sm font-medium text-neutral-200">{article.headline || 'Untitled'}</h4>
                  {article.summary && (
                    <p className="mt-1 text-xs text-neutral-500 line-clamp-2">{article.summary}</p>
                  )}
                  <div className="mt-1.5 flex items-center gap-2 text-xs text-neutral-600">
                    {article.source && <span>{article.source}</span>}
                    {article.created_at && <span>· {fmtDateTime(article.created_at)}</span>}
                  </div>
                </div>
                {article.url && (
                  <a href={article.url} target="_blank" rel="noopener noreferrer" className="text-neutral-500 hover:text-sky-400">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function normalizeNews(data: unknown): NewsArticle[] {
  if (Array.isArray(data)) return data as NewsArticle[];
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    for (const key of ['news', 'data', 'results']) {
      if (Array.isArray(obj[key])) return obj[key] as NewsArticle[];
    }
  }
  return [];
}
