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
import { getBars, type Bar } from '@/services/api';
import { LoadingState, ErrorState } from '@/components/common/UI';
import { fmtCurrency, fmtDateTime, toNum } from '@/utils/format';

type Timeframe = '1D' | '1W' | '1M' | '3M' | '6M' | '1Y';

const TIMEFRAME_PARAMS: Record<Timeframe, { timeframe?: string; start: string }> = {
  '1D': { timeframe: '5Min', start: daysAgo(1) },
  '1W': { timeframe: '1Hour', start: daysAgo(7) },
  '1M': { timeframe: '1Day', start: daysAgo(30) },
  '3M': { timeframe: '1Day', start: daysAgo(90) },
  '6M': { timeframe: '1Day', start: daysAgo(180) },
  '1Y': { timeframe: '1Day', start: daysAgo(365) },
};

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}

interface PriceChartProps {
  symbol: string;
  defaultTimeframe?: Timeframe;
  height?: number;
}

export function PriceChart({ symbol, defaultTimeframe = '1Y', height = 400 }: PriceChartProps) {
  const [timeframe, setTimeframe] = useState<Timeframe>(defaultTimeframe);
  const [bars, setBars] = useState<Bar[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = TIMEFRAME_PARAMS[timeframe];
      const data = await getBars(symbol, params);
      setBars(normalizeBars(data));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load price data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetch(); }, [symbol, timeframe]);

  const chartData = useMemo(() => {
    return bars.map((b) => {
      const t = b.t ?? b.timestamp;
      const iso =
        t === undefined || t === null
          ? ''
          : typeof t === 'number'
            ? new Date(t * 1000).toISOString()
            : String(t);
      const time = iso ? formatChartLabel(iso, timeframe) : '';
      return { time, price: toNum(b.c ?? b.close) ?? 0 };
    });
  }, [bars, timeframe]);

  return (
    <div>
      <div className="mb-3 flex items-center gap-1">
        {(['1D', '1W', '1M', '3M', '6M', '1Y'] as Timeframe[]).map((tf) => (
          <button
            key={tf}
            onClick={() => setTimeframe(tf)}
            className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
              timeframe === tf
                ? 'bg-sky-900/40 text-sky-400'
                : 'text-neutral-500 hover:bg-neutral-800 hover:text-neutral-300'
            }`}
          >
            {tf}
          </button>
        ))}
      </div>
      {loading ? (
        <LoadingState text="Loading price data..." />
      ) : error ? (
        <ErrorState message={error} onRetry={fetch} />
      ) : chartData.length === 0 ? (
        <p className="py-8 text-center text-sm text-neutral-500">No price data available.</p>
      ) : (
        <ResponsiveContainer width="100%" height={height}>
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity={0.25} />
                <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#262626" />
            <XAxis dataKey="time" tick={{ fontSize: 11, fill: '#737373' }} minTickGap={60} />
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
              formatter={(value) => [fmtCurrency(Number(value)), 'Price']}
            />
            <Area type="monotone" dataKey="price" stroke="#10b981" strokeWidth={2} fill="url(#priceGrad)" />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

function normalizeBars(data: unknown): Bar[] {
  if (Array.isArray(data)) return data as Bar[];
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    for (const key of ['bars', 'data', 'results']) {
      if (Array.isArray(obj[key])) return obj[key] as Bar[];
    }
  }
  return [];
}

function formatChartLabel(iso: string, timeframe: Timeframe): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return fmtDateTime(iso);
  if (timeframe === '1D' || timeframe === '1W') {
    return fmtDateTime(iso);
  }
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
