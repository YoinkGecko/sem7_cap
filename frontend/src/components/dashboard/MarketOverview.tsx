import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getMostActives, getMovers, getMarketClock, type ScreenerItem, type MarketClock } from '@/services/api';
import { Card, CardHeader, LoadingState, ErrorState, EmptyState } from '@/components/common/UI';
import { fmtCurrency, fmtPercent, fmtLargeNumber, pctColor } from '@/utils/format';
import { screenerChangePct, screenerPrice, marketStatusLabel } from '@/utils/marketData';

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
      setActives(a);
      setMovers(m);
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
        subtitle={marketStatusLabel(clock, loading)}
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
                const changePct = screenerChangePct(item);
                return (
                  <tr key={symbol + i} className="border-b border-neutral-800/50 hover:bg-neutral-800/40">
                    <td className="py-2">
                      <Link to={`/markets/${symbol}`} className="font-medium text-neutral-200 hover:text-sky-400">
                        {symbol}
                      </Link>
                    </td>
                    <td className="py-2 text-right text-neutral-300">{fmtCurrency(screenerPrice(item))}</td>
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
