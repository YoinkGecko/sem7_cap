import { useState } from 'react';
import { createOrder, type OrderSide, type OrderType } from '@/services/api';
import { useToast } from '@/components/common/Toast';
import { Modal, ConfirmDialog } from '@/components/common/Modal';
import { fmtCurrency, toNum } from '@/utils/format';

interface OrderTicketProps {
  symbol: string;
  latestPrice?: number;
}

export function OrderTicket({ symbol, latestPrice }: OrderTicketProps) {
  const { notify } = useToast();
  const [side, setSide] = useState<OrderSide>('buy');
  const [type, setType] = useState<OrderType>('market');
  const [qty, setQty] = useState<string>('');
  const [limitPrice, setLimitPrice] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [previewData, setPreviewData] = useState<{ name: string; value: string }[] | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const qtyNum = toNum(qty);
  const limitNum = toNum(limitPrice);
  const canSubmit = qtyNum !== undefined && qtyNum > 0 && (type !== 'limit' || limitNum !== undefined);

  const handlePreview = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const result = await createOrder({
        symbol,
        side,
        qty: qtyNum!,
        type,
        ...(type === 'limit' && limitNum !== undefined ? { limit_price: limitNum } : {}),
        dry_run: true,
      });
      setPreviewData([
        { name: 'Symbol', value: symbol },
        { name: 'Side', value: side.toUpperCase() },
        { name: 'Quantity', value: String(qtyNum) },
        { name: 'Type', value: type.toUpperCase() },
        ...(type === 'limit' && limitNum !== undefined ? [{ name: 'Limit Price', value: fmtCurrency(limitNum) }] : []),
        { name: 'Estimated Cost', value: fmtCurrency(toNum(result?.limit_price ?? result?.filled_avg_price) ?? (qtyNum! * (limitNum ?? latestPrice ?? 0))) },
        { name: 'Status', value: 'Preview (dry run)' },
      ]);
    } catch (e) {
      notify('error', e instanceof Error ? e.message : 'Preview failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirm = async () => {
    setConfirmOpen(false);
    setSubmitting(true);
    try {
      await createOrder({
        symbol,
        side,
        qty: qtyNum!,
        type,
        ...(type === 'limit' && limitNum !== undefined ? { limit_price: limitNum } : {}),
      });
      notify('success', `${side.toUpperCase()} order for ${qtyNum} ${symbol} submitted.`);
      setQty('');
      setLimitPrice('');
    } catch (e) {
      notify('error', e instanceof Error ? e.message : 'Order failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
      <h3 className="mb-3 text-sm font-semibold text-neutral-100">Order Ticket</h3>

      <div className="mb-3 grid grid-cols-2 gap-2">
        <button
          onClick={() => setSide('buy')}
          className={`rounded-md py-2 text-sm font-semibold ${
            side === 'buy' ? 'bg-emerald-600 text-white' : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
          }`}
        >
          Buy
        </button>
        <button
          onClick={() => setSide('sell')}
          className={`rounded-md py-2 text-sm font-semibold ${
            side === 'sell' ? 'bg-red-600 text-white' : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
          }`}
        >
          Sell
        </button>
      </div>

      <div className="mb-3">
        <label className="mb-1 block text-xs text-neutral-500">Order Type</label>
        <select
          value={type}
          onChange={(e) => setType(e.target.value as OrderType)}
          className="w-full rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-neutral-200 focus:border-sky-700 focus:outline-none"
        >
          <option value="market">Market</option>
          <option value="limit">Limit</option>
        </select>
      </div>

      <div className="mb-3">
        <label className="mb-1 block text-xs text-neutral-500">Quantity</label>
        <input
          type="number"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          placeholder="0"
          className="w-full rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-neutral-200 placeholder-neutral-600 focus:border-sky-700 focus:outline-none"
        />
      </div>

      {type === 'limit' && (
        <div className="mb-3">
          <label className="mb-1 block text-xs text-neutral-500">Limit Price</label>
          <input
            type="number"
            value={limitPrice}
            onChange={(e) => setLimitPrice(e.target.value)}
            placeholder="0.00"
            className="w-full rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-neutral-200 placeholder-neutral-600 focus:border-sky-700 focus:outline-none"
          />
        </div>
      )}

      {latestPrice !== undefined && (
        <p className="mb-3 text-xs text-neutral-500">
          Last: <span className="text-neutral-300">{fmtCurrency(latestPrice)}</span>
        </p>
      )}

      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={handlePreview}
          disabled={!canSubmit || submitting}
          className="rounded-md border border-neutral-700 py-2 text-sm font-medium text-neutral-300 hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Preview
        </button>
        <button
          onClick={() => setConfirmOpen(true)}
          disabled={!canSubmit || submitting}
          className={`rounded-md py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 ${
            side === 'buy' ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-red-600 hover:bg-red-500'
          }`}
        >
          Place {side === 'buy' ? 'Buy' : 'Sell'} Order
        </button>
      </div>

      <Modal
        open={!!previewData}
        onClose={() => setPreviewData(null)}
        title="Order Preview"
        footer={
          <button
            onClick={() => setPreviewData(null)}
            className="rounded-md border border-neutral-700 px-4 py-2 text-sm text-neutral-300 hover:bg-neutral-800"
          >
            Close
          </button>
        }
      >
        <dl className="space-y-2">
          {previewData?.map((d) => (
            <div key={d.name} className="flex justify-between text-sm">
              <dt className="text-neutral-500">{d.name}</dt>
              <dd className="text-neutral-200">{d.value}</dd>
            </div>
          ))}
        </dl>
      </Modal>

      <ConfirmDialog
        open={confirmOpen}
        title="Review Order"
        confirmLabel="Confirm Order"
        onConfirm={handleConfirm}
        onCancel={() => setConfirmOpen(false)}
        message={
          <dl className="space-y-2">
            <div className="flex justify-between"><dt className="text-neutral-500">Symbol</dt><dd className="text-neutral-200">{symbol}</dd></div>
            <div className="flex justify-between"><dt className="text-neutral-500">Side</dt><dd className="text-neutral-200">{side.toUpperCase()}</dd></div>
            <div className="flex justify-between"><dt className="text-neutral-500">Quantity</dt><dd className="text-neutral-200">{qtyNum}</dd></div>
            <div className="flex justify-between"><dt className="text-neutral-500">Type</dt><dd className="text-neutral-200">{type.toUpperCase()}</dd></div>
            {type === 'limit' && limitNum !== undefined && (
              <div className="flex justify-between"><dt className="text-neutral-500">Limit Price</dt><dd className="text-neutral-200">{fmtCurrency(limitNum)}</dd></div>
            )}
          </dl>
        }
      />
    </div>
  );
}
