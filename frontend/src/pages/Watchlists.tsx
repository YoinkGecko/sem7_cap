import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  getWatchlists,
  createWatchlist,
  addToWatchlist,
  removeFromWatchlist,
  deleteWatchlist,
  getSnapshot,
  type Watchlist,
  type Snapshot,
} from '@/services/api';
import { Card, CardHeader, LoadingState, ErrorState, EmptyState } from '@/components/common/UI';
import { Modal, ConfirmDialog } from '@/components/common/Modal';
import { useToast } from '@/components/common/Toast';
import { fmtCurrency, fmtPercent, pctColor, toNum } from '@/utils/format';
import { Plus, X, Star, Trash2 } from 'lucide-react';

export function Watchlists() {
  const { notify } = useToast();
  const [watchlists, setWatchlists] = useState<Watchlist[]>([]);
  const [snapshots, setSnapshots] = useState<Record<string, Record<string, Snapshot>>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newSymbols, setNewSymbols] = useState('');
  const [addSymbol, setAddSymbol] = useState<Record<string, string>>({});
  const [deleteTarget, setDeleteTarget] = useState<Watchlist | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const lists = await getWatchlists();
      setWatchlists(lists);
      const snapMap: Record<string, Record<string, Snapshot>> = {};
      await Promise.all(
        lists.map(async (wl) => {
          snapMap[wl.id] = {};
          await Promise.all(
            (wl.symbols || []).map(async (s) => {
              try {
                snapMap[wl.id][s] = await getSnapshot(s);
              } catch { /* skip */ }
            })
          );
        })
      );
      setSnapshots(snapMap);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load watchlists.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const handleCreate = async () => {
    setSubmitting(true);
    try {
      const symbols = newSymbols
        .split(/[\s,\n]+/)
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean);
      await createWatchlist({ name: newName.trim(), symbols });
      notify('success', `Watchlist "${newName}" created.`);
      setCreateOpen(false);
      setNewName('');
      setNewSymbols('');
      fetch();
    } catch (e) {
      notify('error', e instanceof Error ? e.message : 'Failed to create watchlist.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAdd = async (wlId: string) => {
    const sym = (addSymbol[wlId] || '').trim().toUpperCase();
    if (!sym) return;
    setSubmitting(true);
    try {
      await addToWatchlist(wlId, sym);
      notify('success', `${sym} added to watchlist.`);
      setAddSymbol({ ...addSymbol, [wlId]: '' });
      fetch();
    } catch (e) {
      notify('error', e instanceof Error ? e.message : 'Failed to add symbol.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemove = async (wlId: string, sym: string) => {
    setSubmitting(true);
    try {
      await removeFromWatchlist(wlId, sym);
      notify('success', `${sym} removed.`);
      fetch();
    } catch (e) {
      notify('error', e instanceof Error ? e.message : 'Failed to remove symbol.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setSubmitting(true);
    try {
      await deleteWatchlist(deleteTarget.id);
      notify('success', `Watchlist "${deleteTarget.name}" deleted.`);
      setDeleteTarget(null);
      fetch();
    } catch (e) {
      notify('error', e instanceof Error ? e.message : 'Failed to delete watchlist.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="p-6"><LoadingState /></div>;
  if (error) return <div className="p-6"><ErrorState message={error} onRetry={fetch} /></div>;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-neutral-100">Watchlists</h1>
          <p className="text-sm text-neutral-500 mt-0.5">Track groups of securities you're interested in</p>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500"
        >
          <Plus className="h-4 w-4" />
          New Watchlist
        </button>
      </div>

      {watchlists.length === 0 ? (
        <Card><EmptyState message="No watchlists yet. Create one to get started." /></Card>
      ) : (
        watchlists.map((wl) => {
          const wlSnaps = snapshots[wl.id] || {};
          return (
            <Card key={wl.id}>
              <CardHeader
                title={wl.name}
                subtitle={`${wl.symbols?.length || 0} symbols`}
                action={
                  <button
                    onClick={() => setDeleteTarget(wl)}
                    className="rounded p-1 text-neutral-500 hover:bg-neutral-800 hover:text-red-400"
                    title="Delete watchlist"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                }
              />
              <div className="p-4">
                {!(wl.symbols?.length) ? (
                  <EmptyState message="No symbols in this watchlist" />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-neutral-800 text-xs text-neutral-500">
                          <th className="py-2 text-left font-medium">Symbol</th>
                          <th className="py-2 text-right font-medium">Price</th>
                          <th className="py-2 text-right font-medium">Change</th>
                          <th className="py-2 text-right font-medium">Change %</th>
                          <th className="py-2 text-right font-medium"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {wl.symbols.map((sym) => {
                          const snap = wlSnaps[sym];
                          const price = toNum(snap?.latest_trade?.p ?? snap?.latest_trade?.price ?? snap?.price);
                          const change = toNum(snap?.change ?? snap?.day_change);
                          const changePct = toNum(snap?.change_pct ?? snap?.day_change_pct);
                          return (
                            <tr key={sym} className="border-b border-neutral-800/50 hover:bg-neutral-800/40">
                              <td className="py-2.5">
                                <Link to={`/markets/${sym}`} className="flex items-center gap-2 font-medium text-neutral-200 hover:text-sky-400">
                                  <Star className="h-3.5 w-3.5 text-amber-500" />
                                  {sym}
                                </Link>
                              </td>
                              <td className="py-2.5 text-right text-neutral-300">{fmtCurrency(price)}</td>
                              <td className={`py-2.5 text-right ${pctColor(change)}`}>{fmtCurrency(change)}</td>
                              <td className={`py-2.5 text-right ${pctColor(changePct)}`}>{fmtPercent(changePct)}</td>
                              <td className="py-2.5 text-right">
                                <button
                                  onClick={() => handleRemove(wl.id, sym)}
                                  disabled={submitting}
                                  className="rounded p-1 text-neutral-500 hover:bg-neutral-700 hover:text-red-400"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                <div className="mt-3 flex gap-2">
                  <input
                    type="text"
                    value={addSymbol[wl.id] || ''}
                    onChange={(e) => setAddSymbol({ ...addSymbol, [wl.id]: e.target.value })}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(wl.id); }}
                    placeholder="Add symbol..."
                    className="flex-1 rounded-md border border-neutral-800 bg-neutral-950 px-3 py-1.5 text-sm text-neutral-200 placeholder-neutral-600 focus:border-sky-700 focus:outline-none"
                  />
                  <button
                    onClick={() => handleAdd(wl.id)}
                    disabled={submitting}
                    className="inline-flex items-center gap-1 rounded-md border border-neutral-700 px-3 py-1.5 text-sm text-neutral-300 hover:bg-neutral-800 disabled:opacity-50"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add
                  </button>
                </div>
              </div>
            </Card>
          );
        })
      )}

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="New Watchlist"
        footer={
          <>
            <button onClick={() => setCreateOpen(false)} className="rounded-md border border-neutral-700 px-4 py-2 text-sm text-neutral-300 hover:bg-neutral-800">Cancel</button>
            <button onClick={handleCreate} disabled={!newName.trim() || submitting} className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50">
              Create
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs text-neutral-500">Name</label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Tech Stocks"
              className="w-full rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-neutral-200 placeholder-neutral-600 focus:border-sky-700 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-neutral-500">Symbols (comma or space separated)</label>
            <input
              type="text"
              value={newSymbols}
              onChange={(e) => setNewSymbols(e.target.value)}
              placeholder="AAPL, MSFT, NVDA"
              className="w-full rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-neutral-200 placeholder-neutral-600 focus:border-sky-700 focus:outline-none"
            />
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Watchlist"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        danger
      />
    </div>
  );
}
