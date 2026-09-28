import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { createOrder, getPositions, type Position } from '@/services/api';
import { Card, CardHeader, LoadingState, ErrorState, EmptyState } from '@/components/common/UI';
import { ConfirmDialog, Modal } from '@/components/common/Modal';
import { useToast } from '@/components/common/Toast';
import { fmtCurrency, fmtPercent, fmtSignedCurrency, fmtInt, pctColor, toNum } from '@/utils/format';

function plpcDisplay(value: number | undefined): number | undefined {
  if (value === undefined) return undefined;
  return Math.abs(value) <= 1 ? value * 100 : value;
}

function positionQtyAbs(p: Position): number {
  const q = toNum(p.qty);
  return q !== undefined ? Math.abs(q) : 0;
}

function closeOrderSide(p: Position): 'buy' | 'sell' {
  const side = (p.side || 'long').toLowerCase();
  return side === 'short' ? 'buy' : 'sell';
}

export function HoldingsTable({ compact = false }: { compact?: boolean }) {
  const { notify } = useToast();
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sellPosition, setSellPosition] = useState<Position | null>(null);
  const [sellQty, setSellQty] = useState('');
  const [sellConfirmOpen, setSellConfirmOpen] = useState(false);
  const [selling, setSelling] = useState(false);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getPositions();
      setPositions(data.positions || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load holdings.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch();
    const interval = setInterval(fetch, 30000);
    return () => clearInterval(interval);
  }, [fetch]);

  const openSellModal = (p: Position) => {
    setSellPosition(p);
    setSellQty(String(positionQtyAbs(p)));
  };

  const closeSellModal = () => {
    if (selling) return;
    setSellPosition(null);
    setSellQty('');
    setSellConfirmOpen(false);
  };

  const sellQtyNum = sellPosition ? toNum(sellQty) : undefined;
  const sellMaxQty = sellPosition ? positionQtyAbs(sellPosition) : 0;
  const sellValid =
    sellPosition &&
    sellQtyNum !== undefined &&
    sellQtyNum > 0 &&
    sellQtyNum <= sellMaxQty + 1e-9;

  const submitSell = async () => {
    if (!sellPosition || !sellValid || !sellQtyNum) return;
    setSellConfirmOpen(false);
    setSelling(true);
    const side = closeOrderSide(sellPosition);
    const label = side === 'sell' ? 'Sell' : 'Buy to cover';
    try {
      await createOrder({
        symbol: sellPosition.symbol,
        side,
        qty: sellQtyNum,
        type: 'market',
      });
      notify('success', `${label} order for ${sellQtyNum} ${sellPosition.symbol} submitted.`);
      closeSellModal();
      await fetch();
    } catch (e) {
      notify('error', e instanceof Error ? e.message : 'Order failed.');
    } finally {
      setSelling(false);
    }
  };

  return (
    <Card>
      <CardHeader
        title="Holdings"
        subtitle="Open positions · price & unrealized P/L"
        action={
          !loading && !error ? (
            <button
              type="button"
              onClick={fetch}
              className="text-xs text-sky-400 hover:text-sky-300"
            >
              Refresh
            </button>
          ) : null
        }
      />
      <div className={compact ? 'p-3' : 'p-4'}>
        {loading && <LoadingState text="Loading positions…" />}
        {error && <ErrorState message={error} onRetry={fetch} />}
        {!loading && !error && positions.length === 0 && (
          <EmptyState message="No open stock positions in your paper account." />
        )}
        {!loading && !error && positions.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-800 text-xs text-neutral-500">
                  <th className="py-2 text-left font-medium">Symbol</th>
                  <th className="py-2 text-right font-medium">Qty</th>
                  <th className="py-2 text-right font-medium">Price</th>
                  <th className="py-2 text-right font-medium">Market value</th>
                  <th className="py-2 text-right font-medium">P/L</th>
                  <th className="py-2 text-right font-medium">P/L %</th>
                  <th className="py-2 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {positions.map((p) => {
                  const pl = toNum(p.unrealized_pl);
                  const plPct = plpcDisplay(toNum(p.unrealized_plpc));
                  const isShort = (p.side || 'long').toLowerCase() === 'short';
                  return (
                    <tr key={p.symbol} className="border-b border-neutral-800/60 hover:bg-neutral-800/30">
                      <td className="py-2.5">
                        <Link to={`/markets/${p.symbol}`} className="font-semibold text-neutral-100 hover:text-sky-400">
                          {p.symbol}
                        </Link>
                        {p.side && p.side !== 'long' && (
                          <span className="ml-2 text-xs text-neutral-500">{p.side}</span>
                        )}
                      </td>
                      <td className="py-2.5 text-right text-neutral-300">{fmtInt(p.qty)}</td>
                      <td className="py-2.5 text-right text-neutral-300">{fmtCurrency(p.current_price)}</td>
                      <td className="py-2.5 text-right text-neutral-300">{fmtCurrency(p.market_value)}</td>
                      <td className={`py-2.5 text-right font-medium ${pctColor(pl)}`}>
                        {fmtSignedCurrency(pl)}
                      </td>
                      <td className={`py-2.5 text-right ${pctColor(plPct)}`}>{fmtPercent(plPct)}</td>
                      <td className="py-2.5 text-right">
                        <button
                          type="button"
                          onClick={() => openSellModal(p)}
                          className="rounded-md bg-red-600/90 px-2.5 py-1 text-xs font-semibold text-white hover:bg-red-500"
                        >
                          {isShort ? 'Cover' : 'Sell'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        open={!!sellPosition}
        onClose={closeSellModal}
        title={
          sellPosition && (sellPosition.side || 'long').toLowerCase() === 'short'
            ? `Cover ${sellPosition.symbol}`
            : `Sell ${sellPosition?.symbol ?? ''}`
        }
        footer={
          <>
            <button
              type="button"
              onClick={closeSellModal}
              disabled={selling}
              className="rounded-md border border-neutral-700 px-4 py-2 text-sm text-neutral-300 hover:bg-neutral-800 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!sellValid || selling}
              onClick={() => setSellConfirmOpen(true)}
              className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Review order
            </button>
          </>
        }
      >
        {sellPosition && (
          <div className="space-y-3 text-sm">
            <p className="text-neutral-400">
              Market order at ~{fmtCurrency(sellPosition.current_price)} · max{' '}
              {fmtInt(sellMaxQty)} shares
            </p>
            <div>
              <label className="mb-1 block text-xs text-neutral-500">Quantity</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min={1}
                  max={sellMaxQty}
                  step="any"
                  value={sellQty}
                  onChange={(e) => setSellQty(e.target.value)}
                  className="w-full rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-neutral-200 focus:border-sky-700 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setSellQty(String(sellMaxQty))}
                  className="shrink-0 rounded-md border border-neutral-700 px-3 py-2 text-xs text-neutral-300 hover:bg-neutral-800"
                >
                  Max
                </button>
              </div>
              {sellQty !== '' && !sellValid && (
                <p className="mt-1 text-xs text-red-400">Enter a quantity up to {sellMaxQty}.</p>
              )}
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={sellConfirmOpen}
        title="Confirm sell order"
        confirmLabel={sellPosition && closeOrderSide(sellPosition) === 'buy' ? 'Cover position' : 'Sell shares'}
        danger
        onCancel={() => setSellConfirmOpen(false)}
        onConfirm={submitSell}
        message={
          sellPosition && sellQtyNum ? (
            <dl className="space-y-2">
              <div className="flex justify-between">
                <dt className="text-neutral-500">Symbol</dt>
                <dd className="text-neutral-100">{sellPosition.symbol}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-neutral-500">Side</dt>
                <dd className="text-neutral-100">{closeOrderSide(sellPosition).toUpperCase()}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-neutral-500">Quantity</dt>
                <dd className="text-neutral-100">{sellQtyNum}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-neutral-500">Type</dt>
                <dd className="text-neutral-100">MARKET</dd>
              </div>
            </dl>
          ) : null
        }
      />
    </Card>
  );
}
