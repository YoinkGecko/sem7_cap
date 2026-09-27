import { useEffect, useState } from 'react';
import { getAccount, type Account } from '@/services/api';
import { Card, Skeleton } from '@/components/common/UI';
import { fmtCurrency, fmtSignedCurrency, toNum } from '@/utils/format';
import { Briefcase, Wallet, DollarSign, TrendingUp } from 'lucide-react';

export function AccountSummaryCards() {
  const [account, setAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAccount = async () => {
    setLoading(true);
    setError(null);
    try {
      setAccount(await getAccount());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load account data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAccount(); }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Card key={i} className="p-4">
            <Skeleton className="h-4 w-24 mb-3" />
            <Skeleton className="h-7 w-32" />
          </Card>
        ))}
      </div>
    );
  }

  if (error || !account) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Card key={i} className="p-4">
            <p className="text-xs text-red-400">{error || 'No data'}</p>
          </Card>
        ))}
      </div>
    );
  }

  const equity = toNum(account.equity);
  const buyingPower = toNum(account.buying_power);
  const cash = toNum(account.cash);
  const portfolioValue = toNum(account.portfolio_value);
  const lastEquity = toNum(account.last_equity);
  const todayPnL = equity !== undefined && lastEquity !== undefined ? equity - lastEquity : undefined;

  const cards = [
    { label: 'Portfolio Value', value: fmtCurrency(portfolioValue), icon: Briefcase, color: 'text-sky-400' },
    { label: 'Buying Power', value: fmtCurrency(buyingPower), icon: Wallet, color: 'text-emerald-400' },
    { label: 'Cash', value: fmtCurrency(cash), icon: DollarSign, color: 'text-neutral-300' },
    {
      label: "Today's P&L",
      value: fmtSignedCurrency(todayPnL),
      icon: TrendingUp,
      color: todayPnL !== undefined && todayPnL >= 0 ? 'text-emerald-400' : 'text-red-400',
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((c) => {
        const Icon = c.icon;
        return (
          <Card key={c.label} className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-neutral-500">{c.label}</p>
              <Icon className={`h-4 w-4 ${c.color}`} />
            </div>
            <p className={`mt-2 text-xl font-bold ${c.color}`}>{c.value}</p>
          </Card>
        );
      })}
    </div>
  );
}
