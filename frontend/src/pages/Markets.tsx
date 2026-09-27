import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getMovers, getMostActives, type ScreenerItem } from '@/services/api';
import { Card, CardHeader, LoadingState, ErrorState, EmptyState } from '@/components/common/UI';
import { fmtCurrency, fmtPercent, fmtLargeNumber, pctColor } from '@/utils/format';
import { useDebounce } from '@/hooks/useDebounce';
import { Search } from 'lucide-react';

export function Markets() {
  const [movers, setMovers] = useState<ScreenerItem[]>([]);
  const [actives, setActives] = useState<ScreenerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 300);

  const fetch = async () => {
    setLoading(true);
    setError(null);
    try {
      const [m, a] = await Promise.all([
        getMovers().catch(() => []),
        getMostActives().catch(() => []),
      ]);
      setMovers(normalizeScreener(m));
      setActives(normalizeScreener(a));
    } catch {
      setError('Unable to load market data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetch(); }, []);

  const allItems = [...movers, ...actives];
  const filtered = debouncedQuery
    ? allItems.filter((item) => {
        const sym = (item.symbol || '').toLowerCase();
        const name = (item.name || '').toLowerCase();
        const q = debouncedQuery.toLowerCase();
        return sym.includes(q) || name.includes(q);
      })
    : allItems;

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-lg font-semibold text-neutral-100">Markets</h1>
        <p className="text-sm text-neutral-500 mt-0.5">Explore stocks, movers, and most active securities</p>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter by symbol or name..."
          className="w-full rounded-md border border-neutral-800 bg-neutral-900 py-2 pl-9 pr-3 text-sm text-neutral-200 placeholder-neutral-600 focus:border-sky-700 focus:outline-none"
        />
      </div>

      <Card>
        <CardHeader title="Stocks" subtitle={`${filtered.length} results`} />
        {loading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState message={error} onRetry={fetch} />
        ) : filtered.length === 0 ? (
          <EmptyState message="No matching stocks found" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-800 text-xs text-neutral-500">
                  <th className="px-4 py-2 text-left font-medium">Symbol</th>
                  <th className="px-4 py-2 text-left font-medium">Name</th>
                  <th className="px-4 py-2 text-right font-medium">Price</th>
                  <th className="px-4 py-2 text-right font-medium">Change</th>
                  <th className="px-4 py-2 text-right font-medium">Change %</th>
                  <th className="px-4 py-2 text-right font-medium">Volume</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item, i) => {
                  const symbol = item.symbol || '';
                  const changePct = item.change_pct ?? item.change_percent ?? item.percent_change ?? item.day_change_pct;
                  const change = item.change ?? item.day_change;
                  return (
                    <tr key={symbol + i} className="border-b border-neutral-800/50 hover:bg-neutral-800/40">
                      <td className="px-4 py-2.5">
                        <Link to={`/markets/${symbol}`} className="font-medium text-neutral-200 hover:text-sky-400">
                          {symbol}
                        </Link>
                      </td>
                      <td className="px-4 py-2.5 text-neutral-400 max-w-[200px] truncate">{item.name || '--'}</td>
                      <td className="px-4 py-2.5 text-right text-neutral-300">{fmtCurrency(item.price ?? item.last_price)}</td>
                      <td className={`px-4 py-2.5 text-right ${pctColor(change)}`}>{fmtCurrency(change)}</td>
                      <td className={`px-4 py-2.5 text-right ${pctColor(changePct)}`}>{fmtPercent(changePct)}</td>
                      <td className="px-4 py-2.5 text-right text-neutral-400">{fmtLargeNumber(item.volume)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function normalizeScreener(data: unknown): ScreenerItem[] {
  if (Array.isArray(data)) return data as ScreenerItem[];
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    for (const key of ['most_actives', 'movers', 'data', 'results']) {
      if (Array.isArray(obj[key])) return obj[key] as ScreenerItem[];
    }
  }
  return [];
}
