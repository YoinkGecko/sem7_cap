import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMovers, getMostActives, getSnapshot, type ScreenerItem } from '@/services/api';
import { Card, CardHeader, LoadingState, ErrorState, EmptyState } from '@/components/common/UI';
import { fmtCurrency, fmtPercent, fmtLargeNumber, pctColor, toNum } from '@/utils/format';
import { screenerChange, screenerChangePct, screenerPrice } from '@/utils/marketData';
import { useDebounce } from '@/hooks/useDebounce';
import { Search, LineChart } from 'lucide-react';

function dedupeBySymbol(items: ScreenerItem[]): ScreenerItem[] {
  const map = new Map<string, ScreenerItem>();
  for (const item of items) {
    const sym = item.symbol?.toUpperCase();
    if (!sym) continue;
    const prev = map.get(sym);
    map.set(sym, prev ? { ...prev, ...item, symbol: sym } : { ...item, symbol: sym });
  }
  return Array.from(map.values());
}

async function enrichWithSnapshots(items: ScreenerItem[]): Promise<ScreenerItem[]> {
  return Promise.all(
    items.map(async (item) => {
      if (!item.symbol) return item;
      const price = screenerPrice(item);
      const changePct = screenerChangePct(item);
      if (price != null && changePct != null) return item;

      try {
        const snap = await getSnapshot(item.symbol);
        return {
          ...item,
          price: price ?? snap.price ?? toNum(snap.latest_trade?.p ?? snap.latest_trade?.price),
          change: screenerChange(item) ?? snap.change ?? snap.day_change,
          change_pct: changePct ?? snap.change_pct ?? snap.day_change_pct,
        };
      } catch {
        return item;
      }
    })
  );
}

export function Markets() {
  const navigate = useNavigate();
  const [items, setItems] = useState<ScreenerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 300);

  const fetch = async () => {
    setLoading(true);
    setError(null);
    try {
      const [movers, actives] = await Promise.all([
        getMovers().catch(() => [] as ScreenerItem[]),
        getMostActives().catch(() => [] as ScreenerItem[]),
      ]);
      const merged = dedupeBySymbol([...movers, ...actives]);
      setItems(await enrichWithSnapshots(merged));
    } catch {
      setError('Unable to load market data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetch();
  }, []);

  const filtered = useMemo(() => {
    if (!debouncedQuery) return items;
    const q = debouncedQuery.toLowerCase();
    return items.filter((item) => {
      const sym = (item.symbol || '').toLowerCase();
      const name = (item.name || '').toLowerCase();
      return sym.includes(q) || name.includes(q);
    });
  }, [items, debouncedQuery]);

  const openSymbol = (symbol: string) => {
    if (!symbol) return;
    navigate(`/markets/${symbol}`);
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-lg font-semibold text-neutral-100">Markets</h1>
        <p className="text-sm text-neutral-500 mt-0.5">
          Explore stocks, movers, and most active securities. Click a row to open the chart and trade.
        </p>
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
        <CardHeader title="Stocks" subtitle={`${filtered.length} results · select a symbol for 1Y chart & trading`} />
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
                  <th className="px-4 py-2 text-right font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => {
                  const symbol = item.symbol || '';
                  const changePct = screenerChangePct(item);
                  const change = screenerChange(item);
                  const price = screenerPrice(item);
                  return (
                    <tr
                      key={symbol}
                      onClick={() => openSymbol(symbol)}
                      className="cursor-pointer border-b border-neutral-800/50 hover:bg-neutral-800/40"
                    >
                      <td className="px-4 py-2.5 font-medium text-sky-400">{symbol}</td>
                      <td className="px-4 py-2.5 text-neutral-400 max-w-[200px] truncate">{item.name || symbol}</td>
                      <td className="px-4 py-2.5 text-right text-neutral-300">{fmtCurrency(price)}</td>
                      <td className={`px-4 py-2.5 text-right ${pctColor(change)}`}>{fmtCurrency(change)}</td>
                      <td className={`px-4 py-2.5 text-right ${pctColor(changePct)}`}>{fmtPercent(changePct)}</td>
                      <td className="px-4 py-2.5 text-right text-neutral-400">{fmtLargeNumber(item.volume)}</td>
                      <td className="px-4 py-2.5 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openSymbol(symbol);
                          }}
                          className="inline-flex items-center gap-1 rounded-md border border-neutral-700 px-2.5 py-1 text-xs font-medium text-neutral-200 hover:border-sky-700 hover:text-sky-400"
                        >
                          <LineChart className="h-3.5 w-3.5" />
                          Chart &amp; Trade
                        </button>
                      </td>
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
