import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, ChevronUp, History } from 'lucide-react';
import { getStockAutoHistory } from '@/services/api';
import type { StockAutoHistorySession } from '@/types/stockAutoSession';
import { LoadingState, EmptyState } from '@/components/common/UI';
import { fmtCurrency, fmtDateTime, fmtSignedCurrency, fmtInt, pctColor } from '@/utils/format';

const OPEN_KEY = 'stockAutoHistoryPanelOpen';

function readStoredOpen(symbol: string): boolean {
  try {
    const raw = localStorage.getItem(`${OPEN_KEY}:${symbol}`);
    if (raw === '0') return false;
    if (raw === '1') return true;
  } catch {
    /* ignore */
  }
  return true;
}

function statusLabel(status: StockAutoHistorySession['status']) {
  switch (status) {
    case 'RUNNING':
      return 'Running';
    case 'PROFIT_TARGET_REACHED':
      return 'Profit hit';
    case 'LOSS_LIMIT_REACHED':
      return 'Loss limit';
    default:
      return 'Stopped';
  }
}

interface StockAutoTradingHistoryPanelProps {
  symbol: string;
  refreshToken?: number;
}

export function StockAutoTradingHistoryPanel({ symbol, refreshToken = 0 }: StockAutoTradingHistoryPanelProps) {
  const [open, setOpen] = useState(() => readStoredOpen(symbol));
  const [data, setData] = useState<Awaited<ReturnType<typeof getStockAutoHistory>> | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await getStockAutoHistory(symbol));
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [symbol]);

  useEffect(() => {
    setOpen(readStoredOpen(symbol));
  }, [symbol]);

  useEffect(() => {
    getStockAutoHistory(symbol)
      .then(setData)
      .catch(() => setData(null));
  }, [symbol, refreshToken]);

  useEffect(() => {
    if (!open) return;
    load();
  }, [load, refreshToken, open]);

  useEffect(() => {
    if (!open) return;
    const id = setInterval(load, 12000);
    return () => clearInterval(id);
  }, [load, open]);

  const toggleContent = () => {
    setOpen((v) => {
      const next = !v;
      try {
        localStorage.setItem(`${OPEN_KEY}:${symbol}`, next ? '1' : '0');
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900">
      <div className="flex items-center justify-between gap-2 border-b border-neutral-800 px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <History className="h-4 w-4 shrink-0 text-neutral-400" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-neutral-100">Auto trade history</p>
            {!open && data && data.sessionCount > 0 && (
              <p className="truncate text-[11px] text-neutral-500">
                {data.sessionCount} sessions ·{' '}
                <span className={pctColor(data.totalFinalPnL)}>
                  {fmtSignedCurrency(data.totalFinalPnL)} closed P/L
                </span>
              </p>
            )}
            {open && <p className="truncate text-[11px] text-neutral-500">{symbol}</p>}
          </div>
        </div>
        <button
          type="button"
          title={open ? 'Collapse history' : 'Expand history'}
          aria-label={open ? 'Collapse history' : 'Expand history'}
          onClick={toggleContent}
          className="rounded p-1.5 text-neutral-500 hover:bg-neutral-800 hover:text-neutral-200"
        >
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>

      {open && (
        <div className="max-h-[420px] overflow-y-auto p-3">
          <div className="mb-2 flex justify-end">
            <button type="button" onClick={load} className="text-xs text-sky-400 hover:text-sky-300">
              Refresh
            </button>
          </div>
          {loading && !data && <LoadingState text="Loading history…" />}
          {!loading && (!data || data.sessions.length === 0) && (
            <EmptyState message="No auto-trading sessions yet for this symbol." />
          )}
          {data && data.sessions.length > 0 && (
            <>
              <div className="mb-3 rounded-md border border-neutral-800 bg-neutral-950/60 px-3 py-2 text-xs">
                <div className="flex justify-between text-neutral-500">
                  <span>Sessions</span>
                  <span className="text-neutral-300">{data.sessionCount}</span>
                </div>
                <div className="mt-1 flex justify-between">
                  <span className="text-neutral-500">Total closed P/L</span>
                  <span className={`font-semibold ${pctColor(data.totalFinalPnL)}`}>
                    {fmtSignedCurrency(data.totalFinalPnL)}
                  </span>
                </div>
              </div>

              <ul className="space-y-2">
                {data.sessions.map((session) => {
                  const rowOpen = expandedId === session.sessionId;
                  return (
                    <li
                      key={session.sessionId}
                      className="rounded-md border border-neutral-800 bg-neutral-900/50"
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedId(rowOpen ? null : session.sessionId)
                        }
                        className="flex w-full items-start gap-2 px-3 py-2.5 text-left hover:bg-neutral-800/40"
                      >
                        {rowOpen ? (
                          <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-neutral-500" />
                        ) : (
                          <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-neutral-500" />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs text-neutral-500">
                              {fmtDateTime(session.startedAt)}
                            </span>
                            <span
                              className={`text-sm font-semibold ${pctColor(session.finalPnL)}`}
                            >
                              {fmtSignedCurrency(session.finalPnL)}
                            </span>
                          </div>
                          <p className="mt-0.5 text-xs text-neutral-400">
                            {statusLabel(session.status)} · {fmtInt(session.sharesBought)} sh @{' '}
                            {fmtCurrency(session.avgBuyPrice)} · cost {fmtCurrency(session.totalCost)}
                          </p>
                        </div>
                      </button>

                      {rowOpen && (
                        <div className="border-t border-neutral-800 px-3 pb-3 pt-2 text-xs">
                          <dl className="mb-2 grid grid-cols-2 gap-x-2 gap-y-1 text-neutral-500 sm:grid-cols-2">
                            <div>Budget {fmtCurrency(session.budgetUsd)}</div>
                            <div>
                              Target +{fmtCurrency(session.profitMinUsd)} / −
                              {fmtCurrency(session.maxLossUsd)}
                            </div>
                          </dl>
                          {session.stopReason && (
                            <p className="mb-2 text-neutral-500">{session.stopReason}</p>
                          )}
                          <p className="mb-1 font-medium text-neutral-400">Trades</p>
                          <ul className="space-y-1.5">
                            {session.trades.map((t) => (
                              <li
                                key={`${t.tradeIndex}-${t.at}`}
                                className="rounded border border-neutral-800/80 bg-neutral-950/50 px-2 py-1.5"
                              >
                                <div className="flex justify-between">
                                  <span
                                    className={
                                      t.side === 'buy' ? 'text-emerald-400' : 'text-red-400'
                                    }
                                  >
                                    {t.side.toUpperCase()} {fmtInt(t.qty)}
                                  </span>
                                  <span className="text-neutral-300">{fmtCurrency(t.price)}</span>
                                </div>
                                <p className="mt-0.5 text-neutral-600">
                                  {fmtDateTime(t.at)} · {t.reason || t.status}
                                </p>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}
