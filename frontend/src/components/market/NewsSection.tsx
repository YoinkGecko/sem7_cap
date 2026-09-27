import { useEffect, useState } from 'react';
import { getNews, type NewsArticle } from '@/services/api';
import { Card, CardHeader, LoadingState, ErrorState, EmptyState } from '@/components/common/UI';
import { fmtDateTime } from '@/utils/format';
import { ExternalLink, Sparkles } from 'lucide-react';

export function NewsSection({ symbol }: { symbol: string }) {
  const [news, setNews] = useState<NewsArticle[]>([]);
  const [source, setSource] = useState<string | undefined>();
  const [model, setModel] = useState<string | undefined>();
  const [notice, setNotice] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getNews(symbol);
      setNews(data.articles);
      setSource(data.source);
      setModel(data.model);
      setNotice(data.notice || (data.stale ? 'Showing cached Gemini headlines.' : undefined));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load news.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetch();
  }, [symbol]);

  const subtitle =
    source === 'gemini'
      ? `${symbol} · Google Gemini${model ? ` (${model})` : ''}`
      : source === 'alpaca'
        ? `${symbol} · Alpaca market news`
        : symbol;

  return (
    <Card>
      <CardHeader title="News" subtitle={subtitle} />
      {loading ? (
        <LoadingState text="Loading news..." />
      ) : error ? (
        <ErrorState message={error} onRetry={fetch} />
      ) : news.length === 0 ? (
        <EmptyState message="No news available for this symbol" />
      ) : (
        <div>
          {notice && (
            <div className="border-b border-amber-900/40 bg-amber-950/20 px-4 py-2 text-xs text-amber-200/90">
              {notice}
            </div>
          )}
          {source === 'gemini' && !notice && (
            <div className="flex items-center gap-2 border-b border-neutral-800 px-4 py-2 text-xs text-neutral-500">
              <Sparkles className="h-3.5 w-3.5 text-sky-400" />
              AI-generated summaries from recent web coverage. Verify links before trading decisions.
            </div>
          )}
          <div className="divide-y divide-neutral-800">
            {news.slice(0, 10).map((article, i) => (
              <div key={article.id || i} className="p-4 hover:bg-neutral-800/30">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <h4 className="text-sm font-medium text-neutral-200">{article.headline || 'Untitled'}</h4>
                    {article.summary && (
                      <p className="mt-1 text-xs text-neutral-500 line-clamp-3">{article.summary}</p>
                    )}
                    <div className="mt-1.5 flex items-center gap-2 text-xs text-neutral-600">
                      {article.source && <span>{article.source}</span>}
                      {article.created_at && <span>· {fmtDateTime(article.created_at)}</span>}
                    </div>
                  </div>
                  {article.url && (
                    <a
                      href={article.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-neutral-500 hover:text-sky-400"
                      title="Open source"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
