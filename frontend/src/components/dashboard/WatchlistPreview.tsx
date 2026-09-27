import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getWatchlists, type Watchlist } from '@/services/api';
import { getSnapshot, type Snapshot } from '@/services/api';
import { Card, CardHeader, LoadingState, ErrorState, EmptyState } from '@/components/common/UI';
import { fmtCurrency, fmtPercent, pctColor } from '@/utils/format';
import { Star } from 'lucide-react';

export function WatchlistPreview() {
  const [watchlists, setWatchlists] = useState<Watchlist[]>([]);
  const [snapshots, setSnapshots] = useState<Record<string, Snapshot>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = async () => {
    setLoading(true);
    setError(null);
    try {
      const lists = await getWatchlists();
      setWatchlists(lists);
      const first = lists[0];
      if (first?.symbols?.length) {
        const results = await Promise.all(
          first.symbols.slice(0, 6).map((s) =>
            getSnapshot(s).then((snap) => [s, snap] as const).catch(() => [s, null] as const)
          )
        );
        const map: Record<string, Snapshot> = {};
        for (const [s, snap] of results) {
          if (snap) map[s] = snap;
        }
        setSnapshots(map);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load watchlists.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetch(); }, []);

  return (
    <Card>
      <CardHeader
        title="Watchlist Preview"
        subtitle={watchlists[0]?.name}
        action={
          <Link to="/watchlists" className="text-xs text-sky-400 hover:text-sky-300">
            View All
          </Link>
        }
      />
      <div className="p-4">
        {loading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState message={error} onRetry={fetch} />
        ) : watchlists.length === 0 ? (
          <EmptyState message="No watchlists yet" />
        ) : (
          <div className="space-y-1">
            {(watchlists[0]?.symbols || []).slice(0, 6).map((sym) => {
              const snap = snapshots[sym];
              const price = snap?.latest_trade?.p ?? snap?.latest_trade?.price ?? snap?.price;
              const change = snap?.change ?? snap?.day_change;
              const changePct = snap?.change_pct ?? snap?.day_change_pct;
              return (
                <Link
                  key={sym}
                  to={`/markets/${sym}`}
                  className="flex items-center justify-between rounded-md px-2 py-2 hover:bg-neutral-800/50"
                >
                  <div className="flex items-center gap-2">
                    <Star className="h-3.5 w-3.5 text-amber-500" />
                    <span className="text-sm font-medium text-neutral-200">{sym}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-neutral-300">{fmtCurrency(price)}</span>
                    <span className={`text-sm w-16 text-right ${pctColor(changePct ?? change)}`}>
                      {fmtPercent(changePct ?? change)}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </Card>
  );
}
