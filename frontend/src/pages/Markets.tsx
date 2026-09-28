import { useEffect, useMemo, useState, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getAsset,
  getMovers,
  getMostActives,
  getSnapshot,
  searchAssets,
  type Asset,
  type ScreenerItem,
} from '@/services/api';
import { FEATURED_EQUITY_SYMBOLS } from '@/constants/featuredSymbols';
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

function assetToScreenerItem(asset: Asset): ScreenerItem {
  return {
    symbol: asset.symbol?.toUpperCase(),
    name: asset.name,
  };
}

async function enrichWithSnapshots(items: ScreenerItem[]): Promise<ScreenerItem[]> {
  return Promise.all(
    items.map(async (item) => {
      if (!item.symbol) return item;
      const price = screenerPrice(item);
      const changePct = screenerChangePct(item);
      if (price != null && changePct != null && item.name) return item;

      try {
        const [snap, asset] = await Promise.all([
          price != null && changePct != null ? Promise.resolve(null) : getSnapshot(item.symbol),
          item.name ? Promise.resolve(null) : getAsset(item.symbol).catch(() => null),
        ]);
        return {
          ...item,
          name: item.name || asset?.name,
          price:
            price ??
            snap?.price ??
            toNum(snap?.latest_trade?.p ?? snap?.latest_trade?.price),
          change: screenerChange(item) ?? snap?.change ?? snap?.day_change,
          change_pct: changePct ?? snap?.change_pct ?? snap?.day_change_pct,
        };
      } catch {
        return item;
      }
    })
  );
}

async function loadFeaturedItems(existing: Set<string>): Promise<ScreenerItem[]> {
  const symbols = FEATURED_EQUITY_SYMBOLS.filter((sym) => !existing.has(sym));
  const rows = await Promise.all(
    symbols.map(async (symbol) => {
      try {
        const [asset, snap] = await Promise.all([
          getAsset(symbol).catch(() => null),
          getSnapshot(symbol).catch(() => null),
        ]);
        return {
          symbol,
          name: asset?.name,
          price: snap?.price ?? toNum(snap?.latest_trade?.p ?? snap?.latest_trade?.price),
          change: snap?.change ?? snap?.day_change,
          change_pct: snap?.change_pct ?? snap?.day_change_pct,
        } satisfies ScreenerItem;
      } catch {
        return { symbol, name: symbol } satisfies ScreenerItem;
      }
    })
  );
  return rows;
}

export function Markets() {
  const navigate = useNavigate();
  const [items, setItems] = useState<ScreenerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [catalogHits, setCatalogHits] = useState<ScreenerItem[]>([]);
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
      const existing = new Set(merged.map((i) => i.symbol?.toUpperCase()).filter(Boolean) as string[]);
      const featured = await loadFeaturedItems(existing);
      setItems(await enrichWithSnapshots(dedupeBySymbol([...merged, ...featured])));
    } catch {
      setError('Unable to load market data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetch();
  }, []);

  useEffect(() => {
    const q = debouncedQuery.trim();
    if (!q) {
      setCatalogHits([]);
      setSearchLoading(false);
      return;
    }

    let cancelled = false;
    setSearchLoading(true);
    searchAssets(q, 50)
      .then(async (assets) => {
        if (cancelled) return;
        const base = assets.map(assetToScreenerItem);
        setCatalogHits(await enrichWithSnapshots(base));
      })
      .catch(() => {
        if (!cancelled) setCatalogHits([]);
      })
      .finally(() => {
        if (!cancelled) setSearchLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery]);

  const filtered = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    if (!q) return items;

    const local = items.filter((item) => {
      const sym = (item.symbol || '').toLowerCase();
      const name = (item.name || '').toLowerCase();
      return sym.includes(q) || name.includes(q);
    });

    return dedupeBySymbol([...local, ...catalogHits]);
  }, [items, catalogHits, debouncedQuery]);

  const openSymbol = (symbol: string) => {
    if (!symbol) return;
    navigate(`/markets/${symbol.toUpperCase()}`);
  };

  const onSearchKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    const raw = query.trim();
    if (!raw) return;
    const ticker = raw.toUpperCase().replace(/\s+/g, '');
    if (/^[A-Z0-9.]{1,8}$/.test(ticker)) {
      openSymbol(ticker);
    } else if (filtered[0]?.symbol) {
      openSymbol(filtered[0].symbol);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-lg font-semibold text-neutral-100">Markets</h1>
        <p className="text-sm text-neutral-500 mt-0.5">
          Movers, featured large caps, and search across active US stocks. Click a row or press Enter to open chart &amp; trade.
        </p>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onSearchKeyDown}
          placeholder="Search MSFT, Tesla, symbol or company name…"
          className="w-full rounded-md border border-neutral-800 bg-neutral-900 py-2 pl-9 pr-3 text-sm text-neutral-200 placeholder-neutral-600 focus:border-sky-700 focus:outline-none"
        />
        {searchLoading && debouncedQuery.trim() && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-neutral-500">Searching…</span>
        )}
      </div>

      <Card>
        <CardHeader
          title="Stocks"
          subtitle={
            debouncedQuery.trim()
              ? `${filtered.length} matches · Enter to open ticker`
              : `${filtered.length} symbols · featured + movers + most active`
          }
        />
        {loading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState message={error} onRetry={fetch} />
        ) : filtered.length === 0 ? (
          <EmptyState message="No matching stocks. Try a symbol (e.g. MSFT) or company name." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-800 text-xs text-neutral-500">
                  <th className="px-4 py-2 text-left font-medium">Symbol</th>
                  <th className="px-4 py-2 text-left font-medium">Company</th>
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
                  const companyName = item.name && item.name !== symbol ? item.name : '—';
                  return (
                    <tr
                      key={symbol}
                      onClick={() => openSymbol(symbol)}
                      className="cursor-pointer border-b border-neutral-800/50 hover:bg-neutral-800/40"
                    >
                      <td className="px-4 py-2.5 font-medium text-sky-400">{symbol}</td>
                      <td className="px-4 py-2.5 text-neutral-300 max-w-xs truncate" title={companyName}>
                        {companyName}
                      </td>
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
