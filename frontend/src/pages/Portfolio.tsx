import { useEffect, useState } from 'react';
import { getAccount, getPortfolio, type Account, type PortfolioHistory } from '@/services/api';
import { HoldingsTable } from '@/components/dashboard/HoldingsTable';
import { Card, CardHeader, LoadingState, ErrorState, EmptyState } from '@/components/common/UI';
import { fmtCurrency, fmtSignedCurrency, fmtPercent, toNum, pctColor } from '@/utils/format';
import { Briefcase, Wallet, DollarSign, TrendingUp } from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';

export function Portfolio() {
  const [account, setAccount] = useState<Account | null>(null);
  const [history, setHistory] = useState<PortfolioHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = async () => {
    setLoading(true);
    setError(null);
    try {
      const [a, h] = await Promise.all([
        getAccount(),
        getPortfolio().catch(() => null),
      ]);
      setAccount(a);
      setHistory(h);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load portfolio.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetch(); }, []);

  if (loading) return <div className="p-6"><LoadingState /></div>;
  if (error) return <div className="p-6"><ErrorState message={error} onRetry={fetch} /></div>;

  const equity = toNum(account?.equity);
  const buyingPower = toNum(account?.buying_power);
  const cash = toNum(account?.cash);
  const portfolioValue = toNum(account?.portfolio_value);
  const lastEquity = toNum(account?.last_equity);
  const todayPnL = equity !== undefined && lastEquity !== undefined ? equity - lastEquity : undefined;
  const todayPnLPct = todayPnL !== undefined && lastEquity ? (todayPnL / lastEquity) * 100 : undefined;

  const chartData = (() => {
    if (!history) return [];
    const ts = history.timestamp || [];
    const eq = history.equity || [];
    const len = Math.max(ts.length, eq.length);
    const data: { time: string; equity: number }[] = [];
    for (let i = 0; i < len; i++) {
      const t = ts[i];
      const e = toNum(eq[i]) ?? 0;
      data.push({
        time: t ? new Date(typeof t === 'number' ? t * 1000 : t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '',
        equity: e,
      });
    }
    return data;
  })();

  const longMarketValue = toNum(account?.long_market_value);
  const shortMarketValue = toNum(account?.short_market_value);

  const summaryCards = [
    { label: 'Portfolio Value', value: fmtCurrency(portfolioValue), icon: Briefcase, color: 'text-sky-400' },
    { label: "Today's P&L", value: fmtSignedCurrency(todayPnL), sub: fmtPercent(todayPnLPct), icon: TrendingUp, color: todayPnL !== undefined && todayPnL >= 0 ? 'text-emerald-400' : 'text-red-400' },
    { label: 'Buying Power', value: fmtCurrency(buyingPower), icon: Wallet, color: 'text-emerald-400' },
    { label: 'Cash', value: fmtCurrency(cash), icon: DollarSign, color: 'text-neutral-300' },
  ];

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-lg font-semibold text-neutral-100">Portfolio</h1>
        <p className="text-sm text-neutral-500 mt-0.5">Account holdings and performance</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {summaryCards.map((c) => {
          const Icon = c.icon;
          return (
            <Card key={c.label} className="p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-neutral-500">{c.label}</p>
                <Icon className={`h-4 w-4 ${c.color}`} />
              </div>
              <p className={`mt-2 text-xl font-bold ${c.color}`}>{c.value}</p>
              {c.sub && <p className={`text-xs ${pctColor(todayPnLPct)}`}>{c.sub}</p>}
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader title="Equity Curve" />
        <div className="p-4">
          {chartData.length === 0 ? (
            <EmptyState message="No portfolio history available" />
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="portGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0ea5e9" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#0ea5e9" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#262626" />
                <XAxis dataKey="time" tick={{ fontSize: 11, fill: '#737373' }} minTickGap={50} />
                <YAxis tick={{ fontSize: 11, fill: '#737373' }} tickFormatter={(v) => fmtCurrency(v, 0)} width={70} domain={['auto', 'auto']} />
                <Tooltip
                  contentStyle={{ background: '#171717', border: '1px solid #404040', borderRadius: '6px', fontSize: '12px' }}
                  formatter={(value) => [fmtCurrency(Number(value)), 'Equity']}
                />
                <Area type="monotone" dataKey="equity" stroke="#0ea5e9" strokeWidth={2} fill="url(#portGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>

      <HoldingsTable />

      <Card>
        <CardHeader title="Account Summary" subtitle="Position and margin details" />
        <div className="grid grid-cols-2 gap-4 p-4 sm:grid-cols-3 lg:grid-cols-4">
          <StatItem label="Equity" value={fmtCurrency(equity)} />
          <StatItem label="Long Market Value" value={fmtCurrency(longMarketValue)} />
          <StatItem label="Short Market Value" value={fmtCurrency(shortMarketValue)} />
          <StatItem label="Initial Margin" value={fmtCurrency(toNum(account?.initial_margin))} />
          <StatItem label="Maintenance Margin" value={fmtCurrency(toNum(account?.maintenance_margin))} />
          <StatItem label="Multiplier" value={account?.multiplier ? String(account.multiplier) : '--'} />
          <StatItem label="Status" value={account?.status || '--'} />
          <StatItem label="Currency" value={account?.currency || '--'} />
        </div>
      </Card>
    </div>
  );
}

function StatItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-neutral-500">{label}</p>
      <p className="mt-1 text-sm font-medium text-neutral-200">{value}</p>
    </div>
  );
}
