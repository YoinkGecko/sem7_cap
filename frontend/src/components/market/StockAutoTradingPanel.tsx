import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bot, Octagon, Play, AlertTriangle, TrendingUp } from 'lucide-react';
import {
  getActiveStockAutoSession,
  getStockAutoSession,
  startStockAutoSession,
  stopStockAutoSession,
  type StockAutoSession,
} from '@/services/api';
import { useToast } from '@/components/common/Toast';
import { Badge, Spinner } from '@/components/common/UI';
import { Modal } from '@/components/common/Modal';
import { fmtCurrency, fmtSignedCurrency, fmtInt, pctColor, toNum } from '@/utils/format';

const DEFAULT_INTERVAL_MS = 5000;

function statusBadge(status: StockAutoSession['status']) {
  if (status === 'RUNNING') return <Badge color="green">RUNNING</Badge>;
  if (status === 'LOSS_LIMIT_REACHED') return <Badge color="red">LOSS LIMIT</Badge>;
  if (status === 'PROFIT_TARGET_REACHED') return <Badge color="green">PROFIT HIT</Badge>;
  return <Badge color="neutral">STOPPED</Badge>;
}

interface StockAutoTradingPanelProps {
  symbol: string;
  livePrice?: number;
}

export function StockAutoTradingPanel({ symbol, livePrice }: StockAutoTradingPanelProps) {
  const { notify } = useToast();
  const [budget, setBudget] = useState('20000');
  const [maxLoss, setMaxLoss] = useState('100');
  const [profitMin, setProfitMin] = useState('10');
  const [intervalSec, setIntervalSec] = useState('5');
  const [session, setSession] = useState<StockAutoSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(true);
  const [stopConfirmOpen, setStopConfirmOpen] = useState(false);

  const refreshSession = useCallback(async (sessionId?: string) => {
    try {
      if (sessionId) {
        const { session: s } = await getStockAutoSession(sessionId);
        setSession(s);
        return;
      }
      const { session: active } = await getActiveStockAutoSession(symbol);
      setSession(active);
    } catch {
      /* ignore poll errors */
    }
  }, [symbol]);

  useEffect(() => {
    setBootstrapping(true);
    getActiveStockAutoSession(symbol)
      .then(({ session: active }) => setSession(active))
      .finally(() => setBootstrapping(false));
  }, [symbol]);

  useEffect(() => {
    if (!session || session.status !== 'RUNNING') return;
    const id = setInterval(() => refreshSession(session.sessionId), DEFAULT_INTERVAL_MS);
    return () => clearInterval(id);
  }, [session?.sessionId, session?.status, refreshSession]);

  const running = session?.status === 'RUNNING';
  const lossHit = session?.status === 'LOSS_LIMIT_REACHED';
  const profitHit = session?.status === 'PROFIT_TARGET_REACHED';

  const preview = useMemo(() => {
    const budgetUsd = toNum(budget);
    const price = session?.currentPrice ?? livePrice;
    if (budgetUsd === undefined || price === undefined || price <= 0) return null;
    const shares = Math.floor(budgetUsd / price);
    const totalCost = shares * price;
    return { shares, totalCost, price };
  }, [budget, session?.currentPrice, livePrice]);

  const handleStart = async () => {
    const budgetUsd = toNum(budget);
    const maxLossUsd = toNum(maxLoss);
    const profitMinUsd = toNum(profitMin);
    const intervalMs = Math.max(3000, (toNum(intervalSec) ?? 5) * 1000);

    if (budgetUsd === undefined || budgetUsd <= 0) {
      notify('error', 'Enter a valid trading budget.');
      return;
    }
    if (maxLossUsd === undefined || maxLossUsd <= 0) {
      notify('error', 'Maximum loss is required (e.g. 100).');
      return;
    }
    if (profitMinUsd === undefined || profitMinUsd <= 0) {
      notify('error', 'Minimum profit target is required (e.g. 10).');
      return;
    }

    setLoading(true);
    try {
      const { session: s } = await startStockAutoSession(symbol, {
        budgetUsd,
        maxLossUsd,
        profitMinUsd,
        intervalMs,
        usePaperBroker: true,
      });
      setSession(s);
      notify(
        'success',
        `Bought max shares for ${symbol}. Monitoring P/L every ${intervalSec}s.`
      );
    } catch (e) {
      notify('error', e instanceof Error ? e.message : 'Failed to start session.');
    } finally {
      setLoading(false);
    }
  };

  const handleStopChoice = async (sellPosition: boolean) => {
    if (!session?.sessionId) return;
    setStopConfirmOpen(false);
    setLoading(true);
    try {
      const { session: s } = await stopStockAutoSession(session.sessionId, {
        sellPosition,
        reason: sellPosition
          ? 'Stopped by user — sold session shares'
          : 'Stopped by user — kept shares',
      });
      setSession(s);
      notify(
        'success',
        sellPosition
          ? 'Auto trading stopped and session shares sold (paper).'
          : 'Auto trading stopped. Your shares were kept.'
      );
    } catch (e) {
      notify('error', e instanceof Error ? e.message : 'Failed to stop.');
    } finally {
      setLoading(false);
    }
  };

  const displayPrice = session?.currentPrice ?? livePrice;
  const runningPnL = session?.runningPnL ?? 0;
  const qty = session?.sessionEntryQty ?? session?.positionQty ?? preview?.shares ?? 0;
  const totalCost = session?.sessionTotalCost ?? preview?.totalCost;
  const marketValue =
    session?.sessionMarketValue ??
    (displayPrice && qty ? displayPrice * qty : undefined);

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-violet-400" />
          <h3 className="text-sm font-semibold text-neutral-100">Auto Trading</h3>
        </div>
        {bootstrapping ? (
          <Spinner className="h-4 w-4 text-neutral-500" />
        ) : session ? (
          statusBadge(session.status)
        ) : (
          <Badge color="neutral">IDLE</Badge>
        )}
      </div>

      <p className="mb-3 text-xs text-neutral-500">
        Start buys the <strong className="text-neutral-400">maximum whole shares</strong> for your budget, then
        monitors P/L every {intervalSec}s. Sells all when profit ≥ target or loss ≥ limit (Alpaca paper).
      </p>

      {lossHit && (
        <div className="mb-3 flex gap-2 rounded-md border border-red-900/60 bg-red-950/40 px-3 py-2 text-xs text-red-200">
          <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" />
          <div>
            <p className="font-semibold">Loss limit reached</p>
            <p>{session?.stopReason}</p>
          </div>
        </div>
      )}

      {profitHit && (
        <div className="mb-3 flex gap-2 rounded-md border border-emerald-900/60 bg-emerald-950/40 px-3 py-2 text-xs text-emerald-200">
          <TrendingUp className="h-4 w-4 shrink-0 text-emerald-400" />
          <div>
            <p className="font-semibold">Profit target reached</p>
            <p>{session?.stopReason}</p>
          </div>
        </div>
      )}

      <div className="mb-4 flex flex-col gap-4 sm:flex-row">
        {/* Left: position & P/L summary */}
        <div className="min-w-[10rem] flex-1 rounded-md border border-neutral-800 bg-neutral-950/80 p-3">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">Position</p>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-2">
              <dt className="text-neutral-500">Shares</dt>
              <dd className="font-semibold text-neutral-100">{qty ? fmtInt(qty) : '—'}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-neutral-500">Price</dt>
              <dd className="text-neutral-200">{fmtCurrency(displayPrice)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-neutral-500">Total cost</dt>
              <dd className="text-neutral-200">{fmtCurrency(totalCost)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-neutral-500">Market value</dt>
              <dd className="text-neutral-200">{fmtCurrency(marketValue)}</dd>
            </div>
            <div className="border-t border-neutral-800 pt-2 flex justify-between gap-2">
              <dt className="text-neutral-500">Current P/L</dt>
              <dd className={`text-base font-bold ${pctColor(runningPnL)}`}>
                {session ? fmtSignedCurrency(runningPnL) : '—'}
              </dd>
            </div>
          </dl>
          {!session && preview && preview.shares > 0 && (
            <p className="mt-2 text-xs text-neutral-600">
              Preview @ {fmtCurrency(preview.price)}: {fmtInt(preview.shares)} sh ≈ {fmtCurrency(preview.totalCost)}
            </p>
          )}
        </div>

        {/* Right: config / status */}
        <div className="flex-1 space-y-3">
          {!running && (
            <>
              <div>
                <label className="mb-1 block text-xs text-neutral-500">Trading budget (USD)</label>
                <input
                  type="number"
                  min={100}
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  disabled={loading}
                  className="w-full rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-neutral-200"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-xs text-neutral-500">Max loss ($)</label>
                  <input
                    type="number"
                    min={1}
                    value={maxLoss}
                    onChange={(e) => setMaxLoss(e.target.value)}
                    disabled={loading}
                    className="w-full rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-neutral-200"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-neutral-500">Min profit ($)</label>
                  <input
                    type="number"
                    min={1}
                    value={profitMin}
                    onChange={(e) => setProfitMin(e.target.value)}
                    disabled={loading}
                    className="w-full rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-neutral-200"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs text-neutral-500">Monitor every (sec)</label>
                <input
                  type="number"
                  min={3}
                  value={intervalSec}
                  onChange={(e) => setIntervalSec(e.target.value)}
                  disabled={loading}
                  className="w-full rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-neutral-200"
                />
              </div>
            </>
          )}

          {session && (
            <dl className="grid grid-cols-2 gap-x-2 gap-y-1 text-xs">
              <div>
                <dt className="text-neutral-500">Targets</dt>
                <dd className="text-neutral-300">
                  +{fmtCurrency(session.profitMinUsd ?? toNum(profitMin))} / −
                  {fmtCurrency(session.maxLossUsd ?? toNum(maxLoss))}
                </dd>
              </div>
              <div>
                <dt className="text-neutral-500">Trades</dt>
                <dd className="text-neutral-300">{session.tradeCount}</dd>
              </div>
              {session.lastEvaluation?.reason && (
                <div className="col-span-2">
                  <dt className="text-neutral-500">Last check</dt>
                  <dd className="text-neutral-400">{session.lastEvaluation.reason}</dd>
                </div>
              )}
            </dl>
          )}
        </div>
      </div>

      <div className="flex gap-2">
        {!running ? (
          <button
            type="button"
            onClick={handleStart}
            disabled={loading || bootstrapping}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md bg-violet-600 py-2 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50"
          >
            {loading ? <Spinner className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            Start — buy max &amp; monitor
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setStopConfirmOpen(true)}
            disabled={loading}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md bg-red-600 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-50"
          >
            {loading ? <Spinner className="h-4 w-4" /> : <Octagon className="h-4 w-4" />}
            Stop monitoring
          </button>
        )}
      </div>

      {session?.lastError && (
        <p className="mt-2 text-xs text-amber-400">Last error: {session.lastError}</p>
      )}

      <Modal
        open={stopConfirmOpen}
        onClose={() => setStopConfirmOpen(false)}
        title="Stop auto trading"
        footer={
          <>
            <button
              type="button"
              onClick={() => setStopConfirmOpen(false)}
              className="rounded-md border border-neutral-700 px-4 py-2 text-sm text-neutral-300 hover:bg-neutral-800"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => handleStopChoice(false)}
              className="rounded-md border border-neutral-600 px-4 py-2 text-sm font-medium text-neutral-200 hover:bg-neutral-800"
            >
              Stop — keep shares
            </button>
            <button
              type="button"
              onClick={() => handleStopChoice(true)}
              className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500"
            >
              Stop &amp; sell all
            </button>
          </>
        }
      >
        <p className="text-sm text-neutral-300">
          {qty > 0 ? (
            <>
              You hold <span className="font-semibold text-neutral-100">{fmtInt(qty)}</span> shares of{' '}
              <span className="font-semibold text-neutral-100">{symbol}</span> from this session (≈{' '}
              {fmtCurrency(marketValue)}). Sell them when stopping, or keep them in your paper account?
            </>
          ) : (
            <>Stop monitoring? There is no open session position to sell.</>
          )}
        </p>
        {qty > 0 && (
          <p className="mt-2 text-xs text-neutral-500">
            Current session P/L:{' '}
            <span className={pctColor(runningPnL)}>{fmtSignedCurrency(runningPnL)}</span>
          </p>
        )}
      </Modal>
    </div>
  );
}
