import { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, History } from 'lucide-react';
import { Badge, LoadingState } from '@/components/common/UI';
import { fmtCurrency, fmtDateTime } from '@/utils/format';
import { getAutomationHistory, getAutomationRunDetail } from '@/services/api';
import type { AutomationHistorySummary, AutomationRunDetail } from '@/types/automation';
import type { CapbacEvaluatePlanResponse } from '@/types/capbac';

interface AutomationHistoryPanelProps {
  refreshToken?: number;
}

export function AutomationHistoryPanel({ refreshToken = 0 }: AutomationHistoryPanelProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<AutomationHistorySummary[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<AutomationRunDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  async function loadHistory() {
    setLoading(true);
    try {
      const data = await getAutomationHistory();
      setHistory(data.history);
    } catch {
      setHistory([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open) loadHistory();
  }, [open, refreshToken]);

  async function toggleExpand(id: string) {
    if (expandedId === id) {
      setExpandedId(null);
      setDetail(null);
      return;
    }
    setExpandedId(id);
    setDetailLoading(true);
    try {
      const d = await getAutomationRunDetail(id);
      setDetail(d);
    } catch {
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }

  const capbacResults = (detail?.run?.capbac as CapbacEvaluatePlanResponse | undefined)?.results;

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/60">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-neutral-800/40"
      >
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-neutral-400" />
          <span className="text-sm font-semibold text-neutral-100">Previous automated trading runs</span>
          {!open && history.length > 0 && <Badge>{history.length}</Badge>}
        </div>
        {open ? (
          <ChevronDown className="h-4 w-4 text-neutral-500" />
        ) : (
          <ChevronRight className="h-4 w-4 text-neutral-500" />
        )}
      </button>

      {open && (
        <div className="border-t border-neutral-800 px-4 py-3">
          {loading && <LoadingState text="Loading history…" />}
          {!loading && history.length === 0 && (
            <p className="text-sm text-neutral-500">No automated runs yet. Use Auto Trade to create one.</p>
          )}
          {!loading && history.length > 0 && (
            <ul className="space-y-2">
              {history.map((item) => {
                const isExpanded = expandedId === item.automationRunId;
                return (
                  <li key={item.automationRunId} className="rounded-md border border-neutral-800 bg-neutral-950/50">
                    <button
                      type="button"
                      onClick={() => toggleExpand(item.automationRunId)}
                      className="flex w-full flex-col gap-1 px-3 py-2 text-left sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-mono text-sky-400">{item.automationRunId}</span>
                          <Badge>{item.status}</Badge>
                          {item.sandbox === false && <Badge color="amber">paper</Badge>}
                          {item.sandbox === true && <Badge color="blue">sandbox</Badge>}
                        </div>
                        <p className="mt-1 line-clamp-1 text-sm text-neutral-300">
                          {item.strategySummary || 'Automated strategy run'}
                        </p>
                        <p className="text-xs text-neutral-500">
                          {fmtDateTime(item.createdAt)}
                          {item.symbols?.length ? ` · ${item.symbols.join(', ')}` : ''}
                          {item.budget != null ? ` · ${fmtCurrency(item.budget, 0)}` : ''}
                        </p>
                      </div>
                      <div className="text-xs text-neutral-400">
                        CapBAC {item.capbac.approved}/{item.capbac.approved + item.capbac.denied} approved ·{' '}
                        {item.orders.placed} orders
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="border-t border-neutral-800 px-3 py-3 text-sm">
                        {detailLoading && <LoadingState text="Loading details…" />}
                        {!detailLoading && detail && detail.run.automationRunId === item.automationRunId && (
                          <div className="space-y-3">
                            <div className="grid gap-2 sm:grid-cols-2 text-xs text-neutral-400">
                              <p>
                                <span className="text-neutral-500">Horizon:</span> {item.horizon || '—'}
                              </p>
                              <p>
                                <span className="text-neutral-500">Planner:</span> {item.plannerSource || '—'}
                              </p>
                              <p>
                                <span className="text-neutral-500">Executed:</span>{' '}
                                {item.executedAt ? fmtDateTime(item.executedAt) : 'Not executed'}
                              </p>
                              <p>
                                <span className="text-neutral-500">Execution:</span>{' '}
                                {item.execution
                                  ? `${item.execution.submitted} submitted, ${item.execution.failed} failed`
                                  : '—'}
                              </p>
                            </div>
                            {detail.run.userStrategy && (
                              <p className="text-xs text-neutral-300">{detail.run.userStrategy}</p>
                            )}
                            <div>
                              <p className="text-xs font-semibold uppercase text-neutral-500">CapBAC results</p>
                              <ul className="mt-1 space-y-1">
                                {capbacResults?.map((r) => (
                                  <li key={r.proposalId} className="text-xs text-neutral-400">
                                    {r.symbol} {r.side} — {r.decision}
                                  </li>
                                ))}
                              </ul>
                            </div>
                            <div>
                              <p className="text-xs font-semibold uppercase text-neutral-500">Order ledger</p>
                              {detail.orders.length === 0 ? (
                                <p className="text-xs text-neutral-500">No orders recorded.</p>
                              ) : (
                                <ul className="mt-1 space-y-1">
                                  {detail.orders.map((o) => (
                                    <li key={o.recordId} className="text-xs text-neutral-300">
                                      {o.symbol} {o.side} · {o.action} · {o.status}
                                      {o.qty != null ? ` · qty ${o.qty}` : ''}
                                      {o.brokerOrderId ? ` · ${o.brokerOrderId}` : ''}
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
