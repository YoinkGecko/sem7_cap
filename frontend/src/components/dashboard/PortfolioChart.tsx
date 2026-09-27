import { useEffect, useMemo, useState } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { getPortfolio, type PortfolioHistory } from '@/services/api';
import { Card, CardHeader, LoadingState, ErrorState } from '@/components/common/UI';
import { fmtCurrency, fmtDateTime, toNum } from '@/utils/format';

export function PortfolioChart() {
  const [history, setHistory] = useState<PortfolioHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = async () => {
    setLoading(true);
    setError(null);
    try {
      setHistory(await getPortfolio());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load portfolio history.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetch(); }, []);

  const chartData = useMemo(() => {
    if (!history) return [];
    const ts = history.timestamp || [];
    const eq = history.equity || [];
    const len = Math.max(ts.length, eq.length);
    const data: { time: string; equity: number; pnl: number | undefined }[] = [];
    for (let i = 0; i < len; i++) {
      const t = ts[i];
      const e = toNum(eq[i]);
      const pnl = toNum(history.profit_loss?.[i]);
      data.push({
        time: t ? fmtDateTime(typeof t === 'number' ? new Date(t * 1000).toISOString() : String(t)) : '',
        equity: e ?? 0,
        pnl,
      });
    }
    return data;
  }, [history]);

  const lastEquity = chartData.length > 0 ? chartData[chartData.length - 1].equity : undefined;
  const firstEquity = chartData.length > 0 ? chartData[0].equity : undefined;
  const totalPnL = lastEquity !== undefined && firstEquity !== undefined ? lastEquity - firstEquity : undefined;

  return (
    <Card>
      <CardHeader
        title="Portfolio Performance"
        subtitle={totalPnL !== undefined ? `Total P&L: ${totalPnL >= 0 ? '+' : ''}${fmtCurrency(totalPnL)}` : undefined}
      />
      <div className="p-4">
        {loading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState message={error} onRetry={fetch} />
        ) : chartData.length === 0 ? (
          <p className="py-8 text-center text-sm text-neutral-500">No portfolio history available.</p>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0ea5e9" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#0ea5e9" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#262626" />
              <XAxis dataKey="time" tick={{ fontSize: 11, fill: '#737373' }} minTickGap={50} />
              <YAxis
                tick={{ fontSize: 11, fill: '#737373' }}
                domain={['auto', 'auto']}
                tickFormatter={(v) => fmtCurrency(v, 0)}
                width={70}
              />
              <Tooltip
                contentStyle={{
                  background: '#171717',
                  border: '1px solid #404040',
                  borderRadius: '6px',
                  fontSize: '12px',
                }}
                labelStyle={{ color: '#a3a3a3' }}
                formatter={(value) => [fmtCurrency(Number(value)), 'Equity']}
              />
              <Area
                type="monotone"
                dataKey="equity"
                stroke="#0ea5e9"
                strokeWidth={2}
                fill="url(#equityGrad)"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  );
}
