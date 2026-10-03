import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { AutoTradeAdvice } from '@/types/stockAutoSession';
import { Modal } from '@/components/common/Modal';
import { Badge, Spinner } from '@/components/common/UI';
import { fmtCurrency, fmtInt, fmtPercent } from '@/utils/format';

interface AutoTradeProposalModalProps {
  open: boolean;
  loading: boolean;
  advice: AutoTradeAdvice | null;
  symbol: string;
  onClose: () => void;
  onConfirmSuggested: () => void;
  onConfirmFullBudget: () => void;
  confirming: boolean;
}

export function AutoTradeProposalModal({
  open,
  loading,
  advice,
  symbol,
  onClose,
  onConfirmSuggested,
  onConfirmFullBudget,
  confirming,
}: AutoTradeProposalModalProps) {
  const [showAnalysis, setShowAnalysis] = useState(false);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Auto trade proposal"
      maxWidth="max-w-xl"
      footer={
        loading || !advice ? (
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-neutral-700 px-4 py-2 text-sm text-neutral-300 hover:bg-neutral-800"
          >
            Cancel
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={onClose}
              disabled={confirming}
              className="rounded-md border border-neutral-700 px-4 py-2 text-sm text-neutral-300 hover:bg-neutral-800 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirmFullBudget}
              disabled={confirming}
              className="rounded-md border border-violet-700 px-4 py-2 text-sm font-medium text-violet-200 hover:bg-violet-950 disabled:opacity-50"
            >
              {confirming ? <Spinner className="h-4 w-4" /> : `Buy full (${fmtInt(advice.maxQty)} sh)`}
            </button>
            <button
              type="button"
              onClick={onConfirmSuggested}
              disabled={confirming}
              className="rounded-md bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50"
            >
              {confirming ? (
                <Spinner className="h-4 w-4" />
              ) : (
                `OK — buy ${fmtInt(advice.suggestedQty)} shares`
              )}
            </button>
          </>
        )
      }
    >
      {loading && (
        <div className="flex items-center gap-3 py-6 text-sm text-neutral-400">
          <Spinner className="h-5 w-5 text-violet-400" />
          Fetching news, analyzing past behavior, sizing position…
        </div>
      )}

      {!loading && advice && (
        <div className="space-y-4 text-sm">
          <div className="rounded-md border border-violet-900/50 bg-violet-950/30 px-4 py-3">
            <p className="text-neutral-200">
              Auto trade will buy{' '}
              <span className="font-bold text-neutral-50">{fmtInt(advice.suggestedQty)}</span> shares of{' '}
              <span className="font-bold text-neutral-50">{symbol}</span> (~{' '}
              {fmtCurrency(advice.suggestedNotionalUsd)} at {fmtCurrency(advice.currentPrice)}/sh).
            </p>
            <p className="mt-2 text-neutral-400">{advice.reason}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {advice.confidence && <Badge color="blue">{advice.confidence} confidence</Badge>}
              {advice.source && (
                <Badge color="neutral">{advice.source === 'gemini' ? 'AI advisor' : 'Rule engine'}</Badge>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="rounded border border-neutral-800 bg-neutral-950/50 p-2">
              <p className="text-neutral-500">Max budget</p>
              <p className="font-medium text-neutral-200">
                {fmtInt(advice.maxQty)} sh · {fmtCurrency(advice.maxNotionalUsd)}
              </p>
            </div>
            <div className="rounded border border-neutral-800 bg-neutral-950/50 p-2">
              <p className="text-neutral-500">Suggested</p>
              <p className="font-medium text-neutral-200">
                {fmtInt(advice.suggestedQty)} sh · {fmtCurrency(advice.suggestedNotionalUsd)}
              </p>
            </div>
          </div>

          {advice.news?.summary && (
            <div>
              <p className="mb-1 text-xs font-medium text-neutral-500">News</p>
              <p className="text-neutral-300">{advice.news.summary}</p>
              {advice.news.notice && (
                <p className="mt-1 text-xs text-amber-500/90">{advice.news.notice}</p>
              )}
            </div>
          )}

          {advice.behavior?.summary && (
            <div>
              <p className="mb-1 text-xs font-medium text-neutral-500">
                Past behavior ({advice.behavior.period || '3M'})
              </p>
              <p className="text-neutral-300">{advice.behavior.summary}</p>
            </div>
          )}

          {advice.riskFlags && advice.riskFlags.length > 0 && (
            <ul className="list-disc pl-5 text-xs text-amber-200/90">
              {advice.riskFlags.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          )}

          <button
            type="button"
            onClick={() => setShowAnalysis((v) => !v)}
            className="flex w-full items-center justify-between rounded-md border border-neutral-800 px-3 py-2 text-left text-xs text-neutral-400 hover:bg-neutral-800/40"
          >
            <span>View agent analysis detail</span>
            {showAnalysis ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>

          {showAnalysis && (
            <div className="max-h-64 space-y-3 overflow-y-auto rounded-md border border-neutral-800 bg-neutral-950/60 p-3 text-xs">
              {advice.news?.headlines && advice.news.headlines.length > 0 && (
                <div>
                  <p className="mb-1 font-medium text-neutral-500">Recent headlines</p>
                  <ul className="space-y-2">
                    {advice.news.headlines.map((h, i) => (
                      <li key={i} className="text-neutral-300">
                        <span className="text-neutral-100">{h.headline}</span>
                        {h.summary && (
                          <p className="mt-0.5 text-neutral-500">{h.summary}</p>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {advice.analysisDetail && (
                <div>
                  <p className="mb-1 font-medium text-neutral-500">Quant snapshot</p>
                  <dl className="grid grid-cols-2 gap-x-2 gap-y-1 text-neutral-400">
                    {advice.analysisDetail.pricePerformance &&
                      typeof advice.analysisDetail.pricePerformance === 'object' && (
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
                    {advice.analysisDetail.risk &&
                      typeof advice.analysisDetail.risk === 'object' && (
                        <>
                          <dt>Max drawdown</dt>
                          <dd>
                            {fmtPercent(
                              (advice.analysisDetail.risk as { maximumDrawdownPct?: number })
                                .maximumDrawdownPct
                            )}
                          </dd>
                          <dt>Volatility</dt>
                          <dd>
                            {fmtPercent(
                              (advice.analysisDetail.risk as { annualizedVolatilityPct?: number })
                                .annualizedVolatilityPct
                            )}
                          </dd>
                        </>
                      )}
                  </dl>
                  {Array.isArray(
                    (advice.analysisDetail as { technicalObservations?: string[] }).technicalObservations
                  ) && (
                    <ul className="mt-2 list-disc pl-4 text-neutral-500">
                      {(
                        advice.analysisDetail as { technicalObservations: string[] }
                      ).technicalObservations.map((o) => (
                        <li key={o}>{o}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              <Link
                to={`/analysis/${symbol}`}
                className="inline-block text-sky-400 hover:text-sky-300"
                onClick={onClose}
              >
                Open full research report →
              </Link>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
