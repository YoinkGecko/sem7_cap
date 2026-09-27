import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getMostActives, getMovers, getMarketClock, type ScreenerItem, type MarketClock } from '@/services/api';
import { Card, CardHeader, LoadingState, ErrorState, EmptyState } from '@/components/common/UI';
import { fmtCurrency, fmtPercent, fmtLargeNumber, pctColor } from '@/utils/format';

export function MarketOverview() {
  const [actives, setActives] = useState<ScreenerItem[]>([]);
  const [movers, setMovers] = useState<ScreenerItem[]>([]);
  const [clock, setClock] = useState<MarketClock | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = async () => {
    setLoading(true);
    setError(null);
    try {
      const [a, m, c] = await Promise.all([
        getMostActives().catch(() => []),
        getMovers().catch(() => []),
        getMarketClock().catch(() => null),
      ]);
      setActives(normalizeScreener(a));
      setMovers(normalizeScreener(m));
      setClock(c);
    } catch {
      setError('Unable to load market overview.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetch(); }, []);

  if (loading) return <Card><CardHeader title="Market Overview" /><LoadingState /></Card>;
  if (error) return <Card><CardHeader title="Market Overview" /><ErrorState message={error} onRetry={fetch} /></Card>;

  return (
    <Card>
      <CardHeader
        title="Market Overview"
        subtitle={clock?.is_open ? 'Market Open' : 'Market Closed'}
      />
      <div className="grid grid-cols-1 gap-6 p-4 lg:grid-cols-2">
        <ScreenerTable title="Most Active" items={actives} />
        <ScreenerTable title="Top Movers" items={movers} />
      </div>
    </Card>
  );
}

function ScreenerTable({ title, items }: { title: string; items: ScreenerItem[] }) {
  return (
    <div>
      <h4 className="mb-2 text-xs font-semibold uppercase text-neutral-500">{title}</h4>
      {items.length === 0 ? (
        <EmptyState message="No data available" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-800 text-xs text-neutral-500">
                <th className="py-1.5 text-left font-medium">Symbol</th>
                <th className="py-1.5 text-right font-medium">Price</th>
                <th className="py-1.5 text-right font-medium">Change %</th>
                <th className="py-1.5 text-right font-medium">Volume</th>
              </tr>
            </thead>
            <tbody>
              {items.slice(0, 8).map((item, i) => {
                const symbol = item.symbol || '';
                const changePct = item.change_pct ?? item.change_percent ?? item.percent_change ?? item.day_change_pct;
                return (
                  <tr key={symbol + i} className="border-b border-neutral-800/50 hover:bg-neutral-800/40">
                    <td className="py-2">
                      <Link to={`/markets/${symbol}`} className="font-medium text-neutral-200 hover:text-sky-400">
                        {symbol}
                      </Link>
                    </td>
                    <td className="py-2 text-right text-neutral-300">{fmtCurrency(item.price ?? item.last_price)}</td>
                    <td className={`py-2 text-right ${pctColor(changePct)}`}>{fmtPercent(changePct)}</td>
                    <td className="py-2 text-right text-neutral-400">{fmtLargeNumber(item.volume)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
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
