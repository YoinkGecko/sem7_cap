import { useEffect, useMemo, useState } from 'react';
import { Bot } from 'lucide-react';
import {
  previewMultiStockAutoRun,
  startMultiStockAutoRun,
  type StartMultiStockAutoRunRequest,
} from '@/services/api';
import type { MultiStockAutoPreview, MultiStockEntryMode } from '@/types/multiStockAuto';
import { Modal } from '@/components/common/Modal';
import { Badge, Spinner } from '@/components/common/UI';
import { useToast } from '@/components/common/Toast';
import { fmtCurrency, fmtInt, toNum } from '@/utils/format';

interface MultiStockAutoModalProps {
  open: boolean;
  symbols: string[];
  onClose: () => void;
  onStarted: (runId: string) => void;
}

const inputClass =
  'w-full min-w-0 rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm tabular-nums text-neutral-200';

export function MultiStockAutoModal({ open, symbols, onClose, onStarted }: MultiStockAutoModalProps) {
  const { notify } = useToast();
  const [totalBudget, setTotalBudget] = useState('50000');
  const [maxLoss, setMaxLoss] = useState('100');
  const [profitMin, setProfitMin] = useState('10');
  const [entryMode, setEntryMode] = useState<MultiStockEntryMode>('suggested');
  const [preview, setPreview] = useState<MultiStockAutoPreview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [starting, setStarting] = useState(false);

  const perStockSplit = useMemo(() => {
    const total = toNum(totalBudget);
    if (total === undefined || total <= 0 || symbols.length < 1) return null;
    return total / symbols.length;
  }, [totalBudget, symbols.length]);

  const buildRequest = (): StartMultiStockAutoRunRequest | null => {
    const totalBudgetUsd = toNum(totalBudget);
    const maxLossUsd = toNum(maxLoss);
    const profitMinUsd = toNum(profitMin);
    if (
      totalBudgetUsd === undefined ||
      totalBudgetUsd <= 0 ||
      maxLossUsd === undefined ||
      maxLossUsd <= 0 ||
      profitMinUsd === undefined ||
      profitMinUsd <= 0
    ) {
      return null;
    }
    return {
      symbols,
      totalBudgetUsd,
      maxLossUsd,
      profitMinUsd,
      entryMode,
      usePaperBroker: true,
    };
  };

  useEffect(() => {
    if (!open || symbols.length < 2) {
      setPreview(null);
      return;
    }

    const req = buildRequest();
    if (!req) return;

    let cancelled = false;
    setLoadingPreview(true);
    setPreview(null);
    previewMultiStockAutoRun(req)
      .then(({ preview: p }) => {
        if (!cancelled) setPreview(p);
      })
      .catch((e) => {
        if (!cancelled) notify('error', e instanceof Error ? e.message : 'Preview failed.');
      })
      .finally(() => {
        if (!cancelled) setLoadingPreview(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, symbols.join(','), totalBudget, maxLoss, profitMin, entryMode]);

  const handleStart = async () => {
    const req = buildRequest();
    if (!req) {
      notify('error', 'Enter valid total budget, max loss, and profit target.');
      return;
    }
    if (symbols.length < 2) {
      notify('error', 'Select at least 2 stocks.');
      return;
    }

    setStarting(true);
    try {
      const { run } = await startMultiStockAutoRun({
        ...req,
        legs: preview?.legs.map((l) => ({ symbol: l.symbol, advice: l.advice })),
      });
      notify('success', `Multi auto trade started for ${run.symbols.length} symbols.`);
      onStarted(run.runId);
    } catch (e) {
      notify('error', e instanceof Error ? e.message : 'Failed to start multi auto trade.');
    } finally {
      setStarting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Multi-stock auto trade"
      maxWidth="max-w-2xl"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={starting}
            className="rounded-md border border-neutral-700 px-4 py-2 text-sm text-neutral-300 hover:bg-neutral-800 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleStart}
            disabled={starting || loadingPreview || !preview || preview.readyCount < 1}
            className="inline-flex items-center gap-2 rounded-md bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50"
          >
            {starting ? <Spinner className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
            Start agent on {symbols.length} stocks
          </button>
        </>
      }
    >
      <div className="space-y-4 text-sm">
        <p className="text-neutral-400">
          One <span className="text-neutral-200">total budget</span> is split evenly across selected
          stocks. Each symbol gets its own analysis, sized entry within its slice, then profit/loss
          monitoring (paper).
        </p>

        <div className="flex flex-wrap gap-2">
          {symbols.map((sym) => (
            <Badge key={sym} color="blue">
              {sym}
            </Badge>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-3">
          <label className="block col-span-3 sm:col-span-1">
            <span className="text-xs text-neutral-500">Total budget ($)</span>
            <input
              className={inputClass}
              value={totalBudget}
              onChange={(e) => setTotalBudget(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="text-xs text-neutral-500">Max loss per stock ($)</span>
            <input className={inputClass} value={maxLoss} onChange={(e) => setMaxLoss(e.target.value)} />
          </label>
          <label className="block">
            <span className="text-xs text-neutral-500">Min profit per stock ($)</span>
            <input className={inputClass} value={profitMin} onChange={(e) => setProfitMin(e.target.value)} />
          </label>
        </div>

        {perStockSplit != null && symbols.length >= 2 && (
          <p className="text-xs text-neutral-500">
            Split: ~{fmtCurrency(perStockSplit)} per stock × {symbols.length} ={' '}
            {fmtCurrency(perStockSplit * symbols.length)} cap
          </p>
        )}

        <div className="flex flex-col gap-2 text-xs text-neutral-400">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              checked={entryMode === 'suggested'}
              onChange={() => setEntryMode('suggested')}
            />
            Agent suggested size within each slice (total spend usually below budget)
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" checked={entryMode === 'full'} onChange={() => setEntryMode('full')} />
            Full slice per stock (deploy up to the whole split on each symbol)
          </label>
        </div>

        {loadingPreview && (
          <div className="flex items-center gap-2 py-4 text-neutral-500">
            <Spinner className="h-4 w-4 text-violet-400" />
            Analyzing news and price history for each symbol…
          </div>
        )}

        {!loadingPreview && preview && (
          <>
            {preview.plannedDeploymentUsd != null && (
              <p className="text-xs text-violet-300/90">
                Planned deployment: {fmtCurrency(preview.plannedDeploymentUsd)} of{' '}
                {fmtCurrency(preview.config.totalBudgetUsd)} total budget
              </p>
            )}
            <div className="max-h-72 space-y-2 overflow-y-auto rounded-md border border-neutral-800 bg-neutral-950/50 p-3">
              {preview.legs.map((leg) => (
                <div
                  key={leg.symbol}
                  className="rounded border border-neutral-800/80 bg-neutral-900/40 px-3 py-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-sky-400">{leg.symbol}</span>
                    {leg.error ? (
                      <Badge color="red">Error</Badge>
                    ) : leg.advice ? (
                      <span className="text-xs text-neutral-300">
                        slice {fmtCurrency(leg.sliceBudgetUsd ?? leg.advice.budgetUsd)}
                        {' · '}
                        {entryMode === 'full'
                          ? `${fmtInt(leg.advice.maxQty)} sh (full slice)`
                          : `${fmtInt(leg.advice.suggestedQty)} sh suggested`}
                        {' · '}
                        {fmtCurrency(
                          entryMode === 'full'
                            ? leg.advice.maxNotionalUsd
                            : leg.advice.suggestedNotionalUsd
                        )}
                      </span>
                    ) : null}
                  </div>
                  {leg.advice?.reason && (
                    <p className="mt-1 text-xs text-neutral-500 line-clamp-2">{leg.advice.reason}</p>
                  )}
                  {leg.error && <p className="mt-1 text-xs text-red-400">{leg.error}</p>}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
