import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Activity, Bot, Radio } from 'lucide-react';
import { getMultiStockAutoRun, listActiveStockAutoSessions } from '@/services/api';
import type { StockAutoSession } from '@/types/stockAutoSession';
import { PriceChart } from '@/components/market/PriceChart';
import { Badge, EmptyState, LoadingState, Spinner } from '@/components/common/UI';
import { fmtCurrency, fmtInt, fmtSignedCurrency, pctColor } from '@/utils/format';

const POLL_MS = 5000;

function progressToTarget(session: StockAutoSession) {
  const pl = session.runningPnL ?? 0;
  const profit = session.profitMinUsd ?? 1;
  const loss = session.maxLossUsd ?? 1;
  if (pl >= 0) return Math.min(100, (pl / profit) * 100);
  return Math.min(100, (Math.abs(pl) / loss) * 100);
}

function LiveStockCard({ session }: { session: StockAutoSession }) {
  const pl = session.runningPnL ?? 0;
  const toward = pl >= 0 ? 'profit' : 'loss';
  const pct = progressToTarget(session);

  return (
    <div className="flex flex-col rounded-lg border border-neutral-800 bg-neutral-900/40 overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-neutral-800 px-4 py-3">
        <div>
          <Link to={`/markets/${session.symbol}`} className="text-lg font-semibold text-sky-400 hover:text-sky-300">
            {session.symbol}
          </Link>
          <p className="mt-0.5 text-xs text-neutral-500">
            {fmtInt(session.sessionEntryQty)} sh @ {fmtCurrency(session.sessionEntryAvgPrice)} · target +$
            {session.profitMinUsd} / stop −${session.maxLossUsd}
          </p>
        </div>
        <div className="text-right">
          <div className={`text-sm font-semibold tabular-nums ${pctColor(pl)}`}>
            {fmtSignedCurrency(pl)}
          </div>
          <div className="text-xs text-neutral-500">{fmtCurrency(session.currentPrice)}</div>
        </div>
      </div>

      <div className="px-4 py-2">
        <div className="mb-1 flex justify-between text-[10px] uppercase tracking-wide text-neutral-500">
          <span>Agent monitoring</span>
          <span>{toward === 'profit' ? '→ profit' : '→ loss limit'}</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-neutral-800">
          <div
            className={`h-full transition-all ${toward === 'profit' ? 'bg-emerald-500' : 'bg-red-500'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        {session.lastEvaluation?.reason && (
          <p className="mt-2 text-xs text-neutral-400 line-clamp-2">{session.lastEvaluation.reason}</p>
        )}
      </div>

      <div className="px-2 pb-3">
        <PriceChart
          symbol={session.symbol}
          defaultTimeframe="1D"
          height={200}
          showTimeframeSelector={false}
        />
      </div>
    </div>
  );
}

export function LiveTrading() {
  const [searchParams] = useSearchParams();
  const runIdFilter = searchParams.get('runId');
  const [sessions, setSessions] = useState<StockAutoSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [runLabel, setRunLabel] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [{ sessions: active }, runPayload] = await Promise.all([
        listActiveStockAutoSessions(),
        runIdFilter ? getMultiStockAutoRun(runIdFilter).catch(() => null) : Promise.resolve(null),
      ]);

      let filtered = active;
      if (runPayload?.run) {
        const ids = new Set(
          runPayload.run.legs.map((l) => l.sessionId).filter(Boolean) as string[]
        );
        filtered = active.filter((s) => ids.has(s.sessionId));
        setRunLabel(runPayload.run.symbols.join(', '));
      } else {
        setRunLabel(null);
      }

      setSessions(filtered);
    } catch {
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, [runIdFilter]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  useEffect(() => {
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  const aggregatePnL = useMemo(
    () => sessions.reduce((sum, s) => sum + (s.runningPnL ?? 0), 0),
    [sessions]
  );

  const activity = useMemo(() => {
    const rows: { at: string; symbol: string; message: string }[] = [];
    for (const s of sessions) {
      for (const tick of s.tickLog || []) {
        rows.push({ at: tick.at, symbol: s.symbol, message: tick.message });
      }
      if (s.lastEvaluation?.reason) {
        rows.push({
          at: s.lastEvaluation.evaluatedAt || s.lastTickAt || '',
          symbol: s.symbol,
          message: s.lastEvaluation.reason,
        });
      }
    }
    return rows
      .filter((r) => r.at)
      .sort((a, b) => String(b.at).localeCompare(String(a.at)))
      .slice(0, 20);
  }, [sessions]);

  if (loading) return <LoadingState text="Loading live sessions…" />;

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Radio className="h-5 w-5 text-emerald-400" />
            <h1 className="text-lg font-semibold text-neutral-100">Live trading</h1>
            {sessions.length > 0 && (
              <Badge color="green">
                <span className="inline-flex items-center gap-1">
                  <Spinner className="h-3 w-3" /> Agent active
                </span>
              </Badge>
            )}
          </div>
          <p className="mt-1 text-sm text-neutral-500">
            Charts and P/L for every auto session the agent is monitoring (paper). Prices refresh with
            the server every ~5s; sells when profit or loss limits hit.
          </p>
          {runIdFilter && runLabel && (
            <p className="mt-1 text-xs text-violet-400">Filtered to multi run: {runLabel}</p>
          )}
        </div>
        <div className="text-right text-sm">
          <div className="text-neutral-500">{sessions.length} stocks monitored</div>
          <div className={`font-semibold tabular-nums ${pctColor(aggregatePnL)}`}>
            Combined P/L {fmtSignedCurrency(aggregatePnL)}
          </div>
          <Link
            to="/markets"
            className="mt-2 inline-block text-xs text-sky-400 hover:text-sky-300"
          >
            Start more on Markets →
          </Link>
        </div>
      </div>

      {sessions.length === 0 ? (
        <EmptyState message="No active auto sessions. Start single-stock auto on Chart & Trade or multi auto on Markets." />
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {sessions.map((session) => (
              <LiveStockCard key={session.sessionId} session={session} />
            ))}
          </div>

          <section className="rounded-lg border border-neutral-800 bg-neutral-950/60 p-4">
            <div className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
              <Activity className="h-4 w-4" />
              Agent activity feed
            </div>
            <ul className="max-h-48 space-y-2 overflow-y-auto text-xs">
              {activity.length === 0 && (
                <li className="text-neutral-500">Waiting for first tick…</li>
              )}
              {activity.map((row, i) => (
                <li key={`${row.at}-${row.symbol}-${i}`} className="flex gap-2 text-neutral-400">
                  <span className="shrink-0 text-neutral-600">
                    {row.at ? new Date(row.at).toLocaleTimeString() : '—'}
                  </span>
                  <span className="font-medium text-sky-500">{row.symbol}</span>
                  <span className="text-neutral-300">{row.message}</span>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}

      <div className="flex flex-wrap gap-3 text-xs text-neutral-500">
        <span className="inline-flex items-center gap-1">
          <Bot className="h-3.5 w-3.5" /> Each card = one auto session
        </span>
        <Link to="/automated-trading" className="text-neutral-400 hover:text-neutral-200">
          Pipeline auto trading (separate) →
        </Link>
      </div>
    </div>
  );
}
