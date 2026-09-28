import { useCallback, useEffect, useState } from 'react';
import { Bot, Octagon, Play, AlertTriangle } from 'lucide-react';
import {
  getActiveStockAutoSession,
  getStockAutoSession,
  startStockAutoSession,
  stopStockAutoSession,
  type StockAutoSession,
} from '@/services/api';
import type { StockAutoStrategyType } from '@/types/stockAutoSession';
import { useToast } from '@/components/common/Toast';
import { Badge, Spinner } from '@/components/common/UI';
import { fmtCurrency, fmtPercent, fmtSignedCurrency, fmtInt, pctColor, toNum } from '@/utils/format';

const DEFAULT_INTERVAL_MS = 5000;

function statusBadge(status: StockAutoSession['status']) {
  if (status === 'RUNNING') return <Badge color="green">RUNNING</Badge>;
  if (status === 'LOSS_LIMIT_REACHED') return <Badge color="red">LOSS LIMIT</Badge>;
  return <Badge color="neutral">STOPPED</Badge>;
}

interface StockAutoTradingPanelProps {
  symbol: string;
  /** Header price from parent (optional); session also reports currentPrice */
  livePrice?: number;
}

export function StockAutoTradingPanel({ symbol, livePrice }: StockAutoTradingPanelProps) {
  const { notify } = useToast();
  const [budget, setBudget] = useState('10000');
  const [maxLoss, setMaxLoss] = useState('100');
  const [intervalSec, setIntervalSec] = useState('5');
  const [strategyType, setStrategyType] = useState<StockAutoStrategyType>('pullback_entry');
  const [session, setSession] = useState<StockAutoSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(true);

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

  const handleStart = async () => {
    const budgetUsd = toNum(budget);
    const maxLossUsd = toNum(maxLoss);
    const intervalMs = Math.max(3000, (toNum(intervalSec) ?? 5) * 1000);

    if (budgetUsd === undefined || budgetUsd <= 0) {
      notify('error', 'Enter a valid trading budget.');
      return;
    }
    if (maxLossUsd === undefined || maxLossUsd <= 0) {
      notify('error', 'Maximum loss is required — set a hard limit (e.g. 100).');
      return;
    }
    if (maxLossUsd > budgetUsd) {
      notify('error', 'Maximum loss should not exceed the trading budget.');
      return;
    }

    setLoading(true);
    try {
      const { session: s } = await startStockAutoSession(symbol, {
        budgetUsd,
        maxLossUsd,
        intervalMs,
        strategyType,
        usePaperBroker: true,
      });
      setSession(s);
      notify('success', `Auto trading started for ${symbol} (paper).`);
    } catch (e) {
      notify('error', e instanceof Error ? e.message : 'Failed to start session.');
    } finally {
      setLoading(false);
    }
  };

  const handleStop = async () => {
    if (!session?.sessionId) return;
    setLoading(true);
    try {
      const { session: s } = await stopStockAutoSession(session.sessionId);
      setSession(s);
      notify('success', 'Auto trading stopped.');
    } catch (e) {
      notify('error', e instanceof Error ? e.message : 'Failed to stop.');
    } finally {
      setLoading(false);
    }
  };

  const displayPrice = session?.currentPrice ?? livePrice;
  const runningPnL = session?.runningPnL ?? 0;
  const maxLossNum = session?.maxLossUsd ?? toNum(maxLoss);

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
        Monitors every {intervalSec}s on the server. Trades only when the strategy finds an opportunity. Alpaca paper orders.
      </p>

      {lossHit && (
        <div className="mb-3 flex gap-2 rounded-md border border-red-900/60 bg-red-950/40 px-3 py-2 text-xs text-red-200">
          <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" />
          <div>
            <p className="font-semibold">Loss limit reached</p>
            <p>{session?.stopReason || 'Session stopped and position closed.'}</p>
          </div>
        </div>
      )}

      {!running && (
        <div className="mb-4 space-y-3">
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
          <div>
            <label className="mb-1 block text-xs text-neutral-500">Maximum loss allowed (USD) — required</label>
            <input
              type="number"
              min={1}
              value={maxLoss}
              onChange={(e) => setMaxLoss(e.target.value)}
              disabled={loading}
              className="w-full rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-neutral-200"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-xs text-neutral-500">Monitor interval (sec)</label>
              <input
                type="number"
                min={3}
                value={intervalSec}
                onChange={(e) => setIntervalSec(e.target.value)}
                disabled={loading}
                className="w-full rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-neutral-200"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-neutral-500">Strategy</label>
              <select
                value={strategyType}
                onChange={(e) => setStrategyType(e.target.value as StockAutoStrategyType)}
                disabled={loading}
                className="w-full rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-neutral-200"
              >
                <option value="pullback_entry">Pullback / exit strength</option>
                <option value="momentum_breakout">Momentum breakout</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {(running || session) && (
        <dl className="mb-4 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
          <div>
            <dt className="text-neutral-500">Price</dt>
            <dd className="font-medium text-neutral-100">{fmtCurrency(displayPrice)}</dd>
          </div>
          <div>
            <dt className="text-neutral-500">Available budget</dt>
            <dd className="font-medium text-neutral-100">
              {fmtCurrency(session?.availableBudgetUsd ?? toNum(budget))}
            </dd>
          </div>
          <div>
            <dt className="text-neutral-500">Position</dt>
            <dd className="font-medium text-neutral-100">
              {session?.positionQty ? `${fmtInt(session.positionQty)} sh` : 'Flat'}
            </dd>
          </div>
          <div>
            <dt className="text-neutral-500">Running P/L</dt>
            <dd className={`font-semibold ${pctColor(runningPnL)}`}>{fmtSignedCurrency(runningPnL)}</dd>
          </div>
          <div>
            <dt className="text-neutral-500">Max loss</dt>
            <dd className="font-medium text-red-300">−{fmtCurrency(maxLossNum)}</dd>
          </div>
          <div>
            <dt className="text-neutral-500">Trades</dt>
            <dd className="font-medium text-neutral-100">{session?.tradeCount ?? 0}</dd>
          </div>
          <div className="col-span-2">
            <dt className="text-neutral-500">Last trade</dt>
            <dd className="text-neutral-300">
              {session?.lastTrade
                ? `${session.lastTrade.side?.toUpperCase()} ${fmtInt(session.lastTrade.qty)} @ ${fmtCurrency(session.lastTrade.price)}`
                : '—'}
            </dd>
          </div>
          {session?.dayChangePct != null && (
            <div className="col-span-2">
              <dt className="text-neutral-500">Day change</dt>
              <dd className={pctColor(session.dayChangePct)}>{fmtPercent(session.dayChangePct)}</dd>
            </div>
          )}
          {session?.lastProposal?.reason && running && (
            <div className="col-span-2">
              <dt className="text-neutral-500">Last evaluation</dt>
              <dd className="text-neutral-400">{session.lastProposal.reason}</dd>
            </div>
          )}
        </dl>
      )}

      <div className="flex gap-2">
        {!running ? (
          <button
            type="button"
            onClick={handleStart}
            disabled={loading || bootstrapping}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md bg-violet-600 py-2 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50"
          >
            {loading ? <Spinner className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            Start auto trading
          </button>
        ) : (
          <button
            type="button"
            onClick={handleStop}
            disabled={loading}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md bg-red-600 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-50"
          >
            {loading ? <Spinner className="h-4 w-4" /> : <Octagon className="h-4 w-4" />}
            Stop
          </button>
        )}
      </div>

      {session?.lastError && (
        <p className="mt-2 text-xs text-amber-400">Last error: {session.lastError}</p>
      )}
    </div>
  );
}
