import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ChevronDown, ChevronUp, History, Radio } from 'lucide-react';
import { getMultiStockAutoRun, listMultiStockAutoRuns } from '@/services/api';
import type { MultiStockAutoLeg, MultiStockAutoRun } from '@/types/multiStockAuto';
import { Badge, LoadingState, Spinner } from '@/components/common/UI';
import { fmtCurrency, fmtInt, fmtPercent, fmtSignedCurrency, pctColor } from '@/utils/format';

function legBought(leg: MultiStockAutoLeg) {
  return Boolean(leg.sessionId && !leg.error);
}

function LegAnalysisPanel({ leg }: { leg: MultiStockAutoLeg }) {
  const [expanded, setExpanded] = useState(true);
  const advice = leg.advice;
  const session = leg.sessionSnapshot;

  if (leg.error && !advice) {
    return (
      <div className="rounded-lg border border-red-900/50 bg-red-950/20 p-4 text-sm text-red-200">
        {leg.symbol}: {leg.error}
      </div>
    );
  }

  const qty = session?.sessionEntryQty ?? leg.entryQty ?? advice?.suggestedQty;
  const reason = advice?.reason || session?.lastTrade?.reason || '—';

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-violet-900/40 bg-violet-950/20 p-4">
        <h2 className="text-base font-semibold text-neutral-100">{leg.symbol}</h2>
        <p className="mt-2 text-sm text-neutral-300">
          Agent bought{' '}
          <span className="font-semibold text-neutral-50">{fmtInt(qty)}</span> shares
          {session?.sessionTotalCost != null && (
            <>
              {' '}
              for ~{fmtCurrency(session.sessionTotalCost)}
            </>
          )}
          .
        </p>
        <p className="mt-2 text-sm text-neutral-400">{reason}</p>
        {session && (
          <div className="mt-3 flex flex-wrap gap-3 text-xs">
            <Badge color={session.status === 'RUNNING' ? 'green' : 'neutral'}>{session.status}</Badge>
            {session.runningPnL != null && (
              <span className={pctColor(session.runningPnL)}>
                P/L {fmtSignedCurrency(session.runningPnL)}
              </span>
            )}
            {session.currentPrice != null && (
              <span className="text-neutral-500">Last {fmtCurrency(session.currentPrice)}</span>
            )}
          </div>
        )}
      </div>

      {advice?.news?.summary && (
        <section className="rounded-md border border-neutral-800 p-3 text-sm">
          <h3 className="text-xs font-medium uppercase tracking-wide text-neutral-500">News</h3>
          <p className="mt-1 text-neutral-300">{advice.news.summary}</p>
        </section>
      )}

      {advice?.behavior?.summary && (
        <section className="rounded-md border border-neutral-800 p-3 text-sm">
          <h3 className="text-xs font-medium uppercase tracking-wide text-neutral-500">
            Past behavior ({advice.behavior.period || '3M'})
          </h3>
          <p className="mt-1 text-neutral-300">{advice.behavior.summary}</p>
        </section>
      )}

      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between rounded-md border border-neutral-800 px-3 py-2 text-left text-xs text-neutral-400 hover:bg-neutral-800/40"
      >
        Full analysis detail
        {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      {expanded && advice && (
        <div className="max-h-96 space-y-3 overflow-y-auto rounded-md border border-neutral-800 bg-neutral-950/60 p-3 text-xs">
          {advice.news?.headlines && advice.news.headlines.length > 0 && (
            <div>
              <p className="mb-1 font-medium text-neutral-500">Headlines</p>
              <ul className="space-y-2">
                {advice.news.headlines.map((h, i) => (
                  <li key={i} className="text-neutral-300">
                    <span className="text-neutral-100">{h.headline}</span>
                    {h.summary && <p className="mt-0.5 text-neutral-500">{h.summary}</p>}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {advice.analysisDetail && typeof advice.analysisDetail === 'object' && (
            <dl className="grid grid-cols-2 gap-x-2 gap-y-1 text-neutral-400">
              {'pricePerformance' in advice.analysisDetail &&
                typeof advice.analysisDetail.pricePerformance === 'object' &&
                advice.analysisDetail.pricePerformance !== null && (
                  <>
                    <dt>Period change</dt>
                    <dd>
                      {fmtPercent(
                        (advice.analysisDetail.pricePerformance as { percentageChange?: number })
                          .percentageChange
                      )}
                    </dd>
                  </>
                )}
              {'risk' in advice.analysisDetail &&
                typeof advice.analysisDetail.risk === 'object' &&
                advice.analysisDetail.risk !== null && (
                  <>
                    <dt>Max drawdown</dt>
                    <dd>
                      {fmtPercent(
                        (advice.analysisDetail.risk as { maximumDrawdownPct?: number })
                          .maximumDrawdownPct
                      )}
                    </dd>
                  </>
                )}
            </dl>
          )}
          <Link to={`/analysis/${leg.symbol}`} className="inline-block text-sky-400 hover:text-sky-300">
            Open full research report →
          </Link>
          <Link
            to={`/markets/${leg.symbol}`}
            className="ml-4 inline-block text-neutral-400 hover:text-neutral-200"
          >
            Chart &amp; trade →
          </Link>
        </div>
      )}
    </div>
  );
}

export function MultiStockAutoRunPage() {
  const { runId } = useParams<{ runId: string }>();
  const navigate = useNavigate();
  const [run, setRun] = useState<MultiStockAutoRun | null>(null);
  const [history, setHistory] = useState<MultiStockAutoRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSymbol, setActiveSymbol] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!runId) return;
    try {
      const [{ run: r }, { runs }] = await Promise.all([
        getMultiStockAutoRun(runId),
        listMultiStockAutoRuns(30),
      ]);
      setRun(r);
      setHistory(runs);
      const bought = r.legs.filter(legBought).map((l) => l.symbol);
      setActiveSymbol((prev) => {
        if (prev && bought.includes(prev)) return prev;
        return bought[0] || r.symbols[0] || null;
      });
    } catch {
      setRun(null);
    } finally {
      setLoading(false);
    }
  }, [runId]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  useEffect(() => {
    if (!runId || !run || run.summary.runningCount === 0) return;
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, [runId, run?.summary.runningCount, load]);

  const boughtLegs = useMemo(() => (run?.legs.filter(legBought) || []), [run]);
  const activeLeg = run?.legs.find((l) => l.symbol === activeSymbol) ?? null;

  if (loading) return <LoadingState text="Loading multi-stock auto run…" />;

  if (!run) {
    return (
      <div className="p-6 text-sm text-neutral-400">
        Run not found.{' '}
        <Link to="/markets" className="text-sky-400">
          Back to Markets
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
      <aside className="w-full shrink-0 border-b border-neutral-800 bg-neutral-950/80 lg:w-64 lg:border-b-0 lg:border-r">
        <div className="flex items-center gap-2 border-b border-neutral-800 px-4 py-3 text-xs font-medium uppercase tracking-wide text-neutral-500">
          <History className="h-3.5 w-3.5" />
          Past runs
        </div>
        <ul className="max-h-48 overflow-y-auto lg:max-h-[calc(100vh-8rem)]">
          {history.map((h) => (
            <li key={h.runId}>
              <button
                type="button"
                onClick={() => navigate(`/markets/multi-auto/${h.runId}`)}
                className={`w-full px-4 py-2.5 text-left text-xs hover:bg-neutral-800/50 ${
                  h.runId === run.runId ? 'bg-neutral-800/60 text-neutral-100' : 'text-neutral-400'
                }`}
              >
                <div className="font-medium">{new Date(h.createdAt).toLocaleString()}</div>
                <div className="mt-0.5 truncate">{h.symbols.join(', ')}</div>
                <div className="mt-1 text-neutral-500">
                  {h.summary.runningCount} running · P/L{' '}
                  {fmtSignedCurrency(h.summary.aggregatePnLUsd)}
                </div>
              </button>
            </li>
          ))}
        </ul>
        <Link
          to="/markets"
          className="block border-t border-neutral-800 px-4 py-3 text-xs text-sky-400 hover:text-sky-300"
        >
          ← Markets (select more stocks)
        </Link>
      </aside>

      <div className="min-w-0 flex-1 p-4 lg:p-6">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-neutral-100">Multi-stock auto agent</h1>
            <p className="text-sm text-neutral-500">
              Started {new Date(run.createdAt).toLocaleString()} · {run.status}
              {run.summary.runningCount > 0 && (
                <span className="ml-2 inline-flex items-center gap-1 text-violet-400">
                  <Spinner className="h-3 w-3" /> live
                </span>
              )}
            </p>
          </div>
          <div className="text-right text-xs text-neutral-400">
            {(run.config.totalBudgetUsd ?? run.summary.totalBudgetUsd) != null && (
              <div>
                Total budget {fmtCurrency(run.config.totalBudgetUsd ?? run.summary.totalBudgetUsd!)}
              </div>
            )}
            <div>Total entry ~{fmtCurrency(run.summary.totalEntryCostUsd)}</div>
            <div className={pctColor(run.summary.aggregatePnLUsd)}>
              Combined P/L {fmtSignedCurrency(run.summary.aggregatePnLUsd)}
            </div>
            {run.summary.runningCount > 0 && (
              <Link
                to={`/live-trading?runId=${run.runId}`}
                className="mt-2 inline-flex items-center gap-1 rounded-md border border-emerald-800/60 bg-emerald-950/30 px-3 py-1.5 text-xs font-medium text-emerald-300 hover:bg-emerald-950/50"
              >
                <Radio className="h-3.5 w-3.5" />
                Live trading
              </Link>
            )}
          </div>
        </div>

        <div className="sticky top-0 z-10 -mx-1 mb-4 overflow-x-auto border-b border-neutral-800 bg-neutral-950/95 px-1 pb-2 backdrop-blur">
          <p className="mb-2 text-xs font-medium text-neutral-500">Stocks agent bought / running</p>
          <div className="flex gap-2">
            {boughtLegs.length === 0 && (
              <span className="text-sm text-neutral-500">No successful entries in this run.</span>
            )}
            {boughtLegs.map((leg) => (
              <button
                key={leg.symbol}
                type="button"
                onClick={() => setActiveSymbol(leg.symbol)}
                className={`shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                  activeSymbol === leg.symbol
                    ? 'border-violet-600 bg-violet-950/60 text-violet-100'
                    : 'border-neutral-700 text-neutral-300 hover:border-neutral-500'
                }`}
              >
                {leg.symbol}
                {leg.sessionSnapshot?.sessionEntryQty != null && (
                  <span className="ml-1 text-xs font-normal text-neutral-400">
                    · {fmtInt(leg.sessionSnapshot.sessionEntryQty)} sh
                  </span>
                )}
              </button>
            ))}
            {run.legs
              .filter((l) => !legBought(l))
              .map((leg) => (
                <span
                  key={leg.symbol}
                  className="shrink-0 rounded-full border border-red-900/50 px-3 py-1.5 text-sm text-red-300/80"
                  title={leg.error || undefined}
                >
                  {leg.symbol} failed
                </span>
              ))}
          </div>
        </div>

        {activeLeg ? (
          <LegAnalysisPanel leg={activeLeg} />
        ) : (
          <p className="text-sm text-neutral-500">Select a symbol above to view analysis and fills.</p>
        )}
      </div>
    </div>
  );
}
