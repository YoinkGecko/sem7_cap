import { useEffect, useState } from 'react';
import { getOptionsChain, type OptionContract } from '@/services/api';
import { Card, CardHeader, LoadingState, ErrorState, EmptyState } from '@/components/common/UI';
import { fmtCurrency, fmtDate, toNum } from '@/utils/format';

export function OptionsSection({ symbol }: { symbol: string }) {
  const [contracts, setContracts] = useState<OptionContract[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getOptionsChain(symbol);
      setContracts(normalizeContracts(data));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load options data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetch(); }, [symbol]);

  return (
    <Card>
      <CardHeader title="Options Chain" subtitle={symbol} />
      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={fetch} />
      ) : contracts.length === 0 ? (
        <EmptyState message="No options data available" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-800 text-xs text-neutral-500">
                <th className="px-3 py-2 text-right font-medium">Strike</th>
                <th className="px-3 py-2 text-left font-medium">Expiration</th>
                <th className="px-3 py-2 text-right font-medium">Type</th>
                <th className="px-3 py-2 text-right font-medium">Bid</th>
                <th className="px-3 py-2 text-right font-medium">Ask</th>
                <th className="px-3 py-2 text-right font-medium">Last</th>
                <th className="px-3 py-2 text-right font-medium">Volume</th>
              </tr>
            </thead>
            <tbody>
              {contracts.slice(0, 30).map((c, i) => (
                <tr key={c.id || i} className="border-b border-neutral-800/50 hover:bg-neutral-800/40">
                  <td className="px-3 py-2 text-right text-neutral-200">{toNum(c.strike_price)?.toFixed(2) ?? '--'}</td>
                  <td className="px-3 py-2 text-left text-neutral-400">{fmtDate(c.expiration_date ?? c.expiration)}</td>
                  <td className="px-3 py-2 text-right">
                    <span className={c.type?.toLowerCase().includes('put') ? 'text-red-400' : 'text-emerald-400'}>
                      {c.type?.toUpperCase() ?? c.option_type?.toUpperCase() ?? '--'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right text-neutral-300">{fmtCurrency(c.bid)}</td>
                  <td className="px-3 py-2 text-right text-neutral-300">{fmtCurrency(c.ask)}</td>
                  <td className="px-3 py-2 text-right text-neutral-300">{fmtCurrency(c.last ?? c.close)}</td>
                  <td className="px-3 py-2 text-right text-neutral-400">{toNum(c.volume)?.toLocaleString() ?? '--'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function normalizeContracts(data: unknown): OptionContract[] {
  if (Array.isArray(data)) return data as OptionContract[];
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    for (const key of ['contracts', 'snapshots', 'quotes', 'data', 'results']) {
      if (Array.isArray(obj[key])) return obj[key] as OptionContract[];
    }
  }
  return [];
}
