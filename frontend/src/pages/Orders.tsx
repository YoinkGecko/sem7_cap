import { useCallback, useEffect, useState } from 'react';
import { getOrders, cancelOrder, cancelAllOrders, replaceOrder, type Order } from '@/services/api';
import { Card, LoadingState, ErrorState, EmptyState, Badge } from '@/components/common/UI';
import { Modal, ConfirmDialog } from '@/components/common/Modal';
import { useToast } from '@/components/common/Toast';
import { fmtCurrency, fmtDateTime, fmtInt, toNum } from '@/utils/format';
import { Eye, X, Edit3 } from 'lucide-react';

type Tab = 'open' | 'all';

export function Orders() {
  const { notify } = useToast();
  const [tab, setTab] = useState<Tab>('open');
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewOrder, setViewOrder] = useState<Order | null>(null);
  const [editOrder, setEditOrder] = useState<Order | null>(null);
  const [editQty, setEditQty] = useState('');
  const [cancelTarget, setCancelTarget] = useState<Order | null>(null);
  const [cancelAllOpen, setCancelAllOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getOrders(tab === 'open' ? undefined : 'all');
      setOrders(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load orders.');
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => { fetch(); }, [fetch]);

  const handleCancel = async () => {
    if (!cancelTarget) return;
    setSubmitting(true);
    try {
      await cancelOrder(cancelTarget.id);
      notify('success', `Order ${cancelTarget.symbol} cancelled.`);
      setCancelTarget(null);
      fetch();
    } catch (e) {
      notify('error', e instanceof Error ? e.message : 'Failed to cancel order.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelAll = async () => {
    setCancelAllOpen(false);
    setSubmitting(true);
    try {
      await cancelAllOrders();
      notify('success', 'All orders cancelled.');
      fetch();
    } catch (e) {
      notify('error', e instanceof Error ? e.message : 'Failed to cancel all orders.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReplace = async () => {
    if (!editOrder) return;
    const qty = toNum(editQty);
    if (!qty) return;
    setSubmitting(true);
    try {
      await replaceOrder(editOrder.id, { qty });
      notify('success', `Order ${editOrder.symbol} updated.`);
      setEditOrder(null);
      fetch();
    } catch (e) {
      notify('error', e instanceof Error ? e.message : 'Failed to update order.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-neutral-100">Orders</h1>
          <p className="text-sm text-neutral-500 mt-0.5">Manage your open and historical orders</p>
        </div>
        <button
          onClick={() => setCancelAllOpen(true)}
          disabled={orders.length === 0 || submitting}
          className="rounded-md border border-red-800 px-4 py-2 text-sm font-medium text-red-400 hover:bg-red-900/30 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Cancel All
        </button>
      </div>

      <div className="flex gap-1 border-b border-neutral-800">
        {(['open', 'all'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize ${
              tab === t
                ? 'border-b-2 border-sky-500 text-sky-400'
                : 'text-neutral-500 hover:text-neutral-300'
            }`}
          >
            {t === 'open' ? 'Open Orders' : 'All Orders'}
          </button>
        ))}
      </div>

      <Card>
        {loading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState message={error} onRetry={fetch} />
        ) : orders.length === 0 ? (
          <EmptyState message={tab === 'open' ? 'No open orders' : 'No orders found'} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-800 text-xs text-neutral-500">
                  <th className="px-4 py-2 text-left font-medium">Symbol</th>
                  <th className="px-4 py-2 text-left font-medium">Side</th>
                  <th className="px-4 py-2 text-right font-medium">Qty</th>
                  <th className="px-4 py-2 text-left font-medium">Type</th>
                  <th className="px-4 py-2 text-right font-medium">Limit</th>
                  <th className="px-4 py-2 text-left font-medium">Status</th>
                  <th className="px-4 py-2 text-right font-medium">Filled</th>
                  <th className="px-4 py-2 text-left font-medium">Submitted</th>
                  <th className="px-4 py-2 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} className="border-b border-neutral-800/50 hover:bg-neutral-800/40">
                    <td className="px-4 py-2.5 font-medium text-neutral-200">{o.symbol}</td>
                    <td className="px-4 py-2.5">
                      <span className={o.side === 'buy' ? 'text-emerald-400' : 'text-red-400'}>
                        {o.side.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right text-neutral-300">{fmtInt(o.qty)}</td>
                    <td className="px-4 py-2.5 text-neutral-400">{(o.order_type ?? o.type)?.toUpperCase() ?? '--'}</td>
                    <td className="px-4 py-2.5 text-right text-neutral-300">{fmtCurrency(o.limit_price)}</td>
                    <td className="px-4 py-2.5">
                      <StatusBadge status={o.status} />
                    </td>
                    <td className="px-4 py-2.5 text-right text-neutral-300">{fmtInt(o.filled_qty)}</td>
                    <td className="px-4 py-2.5 text-neutral-500">{fmtDateTime(o.submitted_at ?? o.created_at)}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => setViewOrder(o)} className="rounded p-1 text-neutral-400 hover:bg-neutral-700 hover:text-sky-400" title="View">
                          <Eye className="h-4 w-4" />
                        </button>
                        <button onClick={() => { setEditOrder(o); setEditQty(String(o.qty ?? '')); }} className="rounded p-1 text-neutral-400 hover:bg-neutral-700 hover:text-amber-400" title="Edit">
                          <Edit3 className="h-4 w-4" />
                        </button>
                        <button onClick={() => setCancelTarget(o)} className="rounded p-1 text-neutral-400 hover:bg-neutral-700 hover:text-red-400" title="Cancel">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* View modal */}
      <Modal open={!!viewOrder} onClose={() => setViewOrder(null)} title="Order Details" maxWidth="max-w-lg">
        {viewOrder && (
          <dl className="space-y-2">
            <DetailRow label="Order ID" value={viewOrder.id} />
            <DetailRow label="Client Order ID" value={viewOrder.client_order_id || '--'} />
            <DetailRow label="Symbol" value={viewOrder.symbol} />
            <DetailRow label="Side" value={viewOrder.side.toUpperCase()} />
            <DetailRow label="Quantity" value={fmtInt(viewOrder.qty)} />
            <DetailRow label="Filled Qty" value={fmtInt(viewOrder.filled_qty)} />
            <DetailRow label="Filled Avg Price" value={fmtCurrency(toNum(viewOrder.filled_avg_price))} />
            <DetailRow label="Type" value={(viewOrder.order_type ?? viewOrder.type)?.toUpperCase() ?? '--'} />
            <DetailRow label="Limit Price" value={fmtCurrency(toNum(viewOrder.limit_price))} />
            <DetailRow label="Status" value={viewOrder.status ?? '--'} />
            <DetailRow label="Time in Force" value={viewOrder.time_in_force ?? '--'} />
            <DetailRow label="Submitted" value={fmtDateTime(viewOrder.submitted_at ?? viewOrder.created_at)} />
            <DetailRow label="Filled At" value={fmtDateTime(viewOrder.filled_at)} />
          </dl>
        )}
      </Modal>

      {/* Edit modal */}
      <Modal
        open={!!editOrder}
        onClose={() => setEditOrder(null)}
        title="Replace Order"
        footer={
          <>
            <button onClick={() => setEditOrder(null)} className="rounded-md border border-neutral-700 px-4 py-2 text-sm text-neutral-300 hover:bg-neutral-800">Cancel</button>
            <button onClick={handleReplace} disabled={submitting} className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50">
              Update
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-neutral-400">Update quantity for <span className="font-medium text-neutral-200">{editOrder?.symbol}</span></p>
          <div>
            <label className="mb-1 block text-xs text-neutral-500">New Quantity</label>
            <input
              type="number"
              value={editQty}
              onChange={(e) => setEditQty(e.target.value)}
              className="w-full rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-neutral-200 focus:border-sky-700 focus:outline-none"
            />
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!cancelTarget}
        title="Cancel Order"
        message={`Are you sure you want to cancel the ${cancelTarget?.side} order for ${cancelTarget?.qty} ${cancelTarget?.symbol}?`}
        confirmLabel="Cancel Order"
        onConfirm={handleCancel}
        onCancel={() => setCancelTarget(null)}
        danger
      />

      <ConfirmDialog
        open={cancelAllOpen}
        title="Cancel All Orders"
        message="This will cancel ALL open orders. This action cannot be undone."
        confirmLabel="Cancel All"
        onConfirm={handleCancelAll}
        onCancel={() => setCancelAllOpen(false)}
        danger
      />
    </div>
  );
}

function StatusBadge({ status }: { status?: string }) {
  if (!status) return <span className="text-neutral-500">--</span>;
  const map: Record<string, 'green' | 'red' | 'blue' | 'amber' | 'neutral'> = {
    filled: 'green',
    canceled: 'red',
    rejected: 'red',
    expired: 'red',
    new: 'blue',
    accepted: 'blue',
    partially_filled: 'amber',
    pending_new: 'amber',
    pending_cancel: 'amber',
    pending_replace: 'amber',
    replaced: 'neutral',
    done_for_day: 'neutral',
  };
  const color = map[status.toLowerCase()] || 'neutral';
  return <Badge color={color}>{status.replace(/_/g, ' ')}</Badge>;
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <dt className="text-neutral-500">{label}</dt>
      <dd className="text-neutral-200">{value}</dd>
    </div>
  );
}
