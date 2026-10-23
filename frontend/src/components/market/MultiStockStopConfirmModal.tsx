import { useMemo } from 'react';
import type { MultiStockAutoLeg } from '@/types/multiStockAuto';
import { Modal } from '@/components/common/Modal';
import { Spinner } from '@/components/common/UI';
import { fmtCurrency, fmtInt, fmtSignedCurrency, pctColor } from '@/utils/format';

function legPosition(leg: MultiStockAutoLeg) {
  const s = leg.sessionSnapshot;
  if (!s) return null;
  const qty = s.sessionEntryQty ?? s.positionQty ?? 0;
  if (qty <= 0 && s.status !== 'RUNNING') return null;
  const pl = s.runningPnL ?? s.finalPnL ?? 0;
  const marketValue =
    s.sessionMarketValue ??
    s.positionMarketValue ??
    (s.currentPrice && qty ? s.currentPrice * qty : undefined);
  return {
    symbol: leg.symbol,
    qty,
    status: s.status,
    marketValue,
    pl,
    cost: s.sessionTotalCost,
  };
}

interface MultiStockStopConfirmModalProps {
  open: boolean;
  legs: MultiStockAutoLeg[];
  stopping: boolean;
  onClose: () => void;
  onStopKeep: () => void;
  onStopSellAll: () => void;
}

export function MultiStockStopConfirmModal({
  open,
  legs,
  stopping,
  onClose,
  onStopKeep,
  onStopSellAll,
}: MultiStockStopConfirmModalProps) {
  const rows = useMemo(
    () =>
      legs
        .map(legPosition)
        .filter((r): r is NonNullable<typeof r> => r != null && r.qty > 0),
    [legs]
  );

  const combinedPl = rows.reduce((sum, r) => sum + r.pl, 0);
  const combinedValue = rows.reduce((sum, r) => sum + (r.marketValue ?? 0), 0);
  const hasOpen = rows.some((r) => r.status === 'RUNNING');

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Stop multi-stock agent"
      maxWidth="max-w-lg"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={stopping}
            className="rounded-md border border-neutral-700 px-4 py-2 text-sm text-neutral-300 hover:bg-neutral-800 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onStopKeep}
            disabled={stopping}
            className="rounded-md border border-neutral-600 px-4 py-2 text-sm font-medium text-neutral-200 hover:bg-neutral-800 disabled:opacity-50"
          >
            {stopping ? <Spinner className="h-4 w-4" /> : 'Stop — keep all shares'}
          </button>
          <button
            type="button"
            onClick={onStopSellAll}
            disabled={stopping || rows.length === 0}
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50"
          >
            {stopping ? <Spinner className="h-4 w-4" /> : 'Stop & sell all'}
          </button>
        </>
      }
    >
      <p className="text-sm text-neutral-300">
        {hasOpen
          ? 'Stop monitoring on every running session in this multi agent run. You can sell all session shares (paper) or keep them in your account.'
          : 'No open session positions to sell. You can still confirm stop to clear any remaining monitors.'}
      </p>

      {rows.length > 0 && (
        <div className="mt-4 overflow-hidden rounded-md border border-neutral-800">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-neutral-800 bg-neutral-900/80 text-neutral-500">
                <th className="px-3 py-2 text-left font-medium">Symbol</th>
                <th className="px-3 py-2 text-right font-medium">Shares</th>
                <th className="px-3 py-2 text-right font-medium">Value</th>
                <th className="px-3 py-2 text-right font-medium">P/L</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.symbol} className="border-b border-neutral-800/60">
                  <td className="px-3 py-2 font-medium text-sky-400">{row.symbol}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-neutral-200">
                    {fmtInt(row.qty)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-neutral-300">
                    {fmtCurrency(row.marketValue)}
                  </td>
                  <td className={`px-3 py-2 text-right font-medium tabular-nums ${pctColor(row.pl)}`}>
                    {fmtSignedCurrency(row.pl)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-neutral-900/50 text-neutral-200">
                <td className="px-3 py-2 font-medium" colSpan={2}>Combined</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmtCurrency(combinedValue)}</td>
                <td className={`px-3 py-2 text-right font-semibold tabular-nums ${pctColor(combinedPl)}`}>
                  {fmtSignedCurrency(combinedPl)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </Modal>
  );
}
