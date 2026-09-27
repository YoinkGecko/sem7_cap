import { useEffect, useState, type ReactNode } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  ComposedChart,
} from 'recharts';
import { ArrowLeft } from 'lucide-react';
import { getStockAnalysis } from '@/services/api';
import type { AnalysisPeriod, StockAnalysisResponse } from '@/types/analysis';
import { Card, CardHeader, LoadingState, ErrorState } from '@/components/common/UI';
import { fmtCurrency, fmtDateTime, fmtLargeNumber, fmtPercent } from '@/utils/format';

const PERIODS: AnalysisPeriod[] = ['1M', '3M', '6M', '1Y', '3Y', '5Y'];

export function StockAnalysis() {
  const { symbol = '' } = useParams<{ symbol: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const period = (searchParams.get('period')?.toUpperCase() as AnalysisPeriod) || '1Y';
  const [data, setData] = useState<StockAnalysisResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (!symbol) return;
    setLoading(true);
    setError(null);
    try {
      setData(await getStockAnalysis(symbol, period));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load stock analysis.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [symbol, period]);

  const setPeriod = (next: AnalysisPeriod) => {
    setSearchParams({ period: next });
  };

  if (loading) return <div className="p-6"><LoadingState text="Building research report..." /></div>;
  if (error || !data) return <div className="p-6"><ErrorState message={error || 'No data'} onRetry={load} /></div>;

  const summaryCards = [
    { label: 'Return', value: fmtPercent(data.pricePerformance.percentageChange) },
    { label: 'Volatility (ann.)', value: fmtPercent(data.risk.annualizedVolatilityPct) },
    { label: 'Max Drawdown', value: fmtPercent(data.risk.maximumDrawdownPct) },
    { label: 'Sharpe', value: data.risk.sharpeRatio?.toFixed(2) ?? '--' },
    { label: 'Beta', value: data.risk.beta?.toFixed(2) ?? '--' },
    { label: 'RSI (14)', value: data.technical.current.rsi14?.toFixed(1) ?? '--' },
  ];

  return (
    <div className="space-y-6 p-6">
      <Link to={`/markets/${symbol}`} className="inline-flex items-center gap-1.5 text-sm text-neutral-400 hover:text-sky-400">
        <ArrowLeft className="h-4 w-4" />
        Back to {symbol}
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-100">{data.symbol}</h1>
          <p className="text-sm text-neutral-500">{data.assetName || data.symbol}</p>
          <p className="mt-1 text-xs text-neutral-600">
            Period {data.period} · Generated {fmtDateTime(data.generatedAt)}
            {data.cached ? ' · cached' : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-1">
          {PERIODS.map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`rounded px-3 py-1 text-xs font-medium ${
                period === p ? 'bg-sky-900/40 text-sky-400' : 'text-neutral-500 hover:bg-neutral-800'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {summaryCards.map((card) => (
          <Card key={card.label} className="p-4">
            <p className="text-xs text-neutral-500">{card.label}</p>
            <p className="mt-1 text-lg font-semibold text-neutral-100">{card.value}</p>
          </Card>
        ))}
      </div>

      <ChartCard title="Price & Moving Averages" subtitle="Close with SMA 20 / 50 / 200">
        <ResponsiveContainer width="100%" height={320}>
          <ComposedChart data={data.chartData.technicalSeries}>
            <CartesianGrid strokeDasharray="3 3" stroke="#262626" />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#737373' }} minTickGap={40} />
            <YAxis tick={{ fontSize: 10, fill: '#737373' }} domain={['auto', 'auto']} width={70} />
            <Tooltip contentStyle={tooltipStyle} />
            <Legend />
            <Line type="monotone" dataKey="close" stroke="#38bdf8" dot={false} strokeWidth={2} name="Close" />
            <Line type="monotone" dataKey="sma20" stroke="#a3e635" dot={false} strokeWidth={1.5} name="SMA 20" />
            <Line type="monotone" dataKey="sma50" stroke="#fbbf24" dot={false} strokeWidth={1.5} name="SMA 50" />
            <Line type="monotone" dataKey="sma200" stroke="#f87171" dot={false} strokeWidth={1.5} name="SMA 200" />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartCard>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <ChartCard title="Volume" subtitle="Daily volume">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data.chartData.volumeSeries}>
              <CartesianGrid strokeDasharray="3 3" stroke="#262626" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#737373' }} minTickGap={40} />
              <YAxis tick={{ fontSize: 10, fill: '#737373' }} width={70} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => fmtLargeNumber(Number(v))} />
              <Bar dataKey="volume" fill="#6366f1" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="RSI (14)" subtitle="Momentum oscillator">
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={data.chartData.rsiSeries}>
              <CartesianGrid strokeDasharray="3 3" stroke="#262626" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#737373' }} minTickGap={40} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#737373' }} width={40} />
              <Tooltip contentStyle={tooltipStyle} />
              <Line type="monotone" dataKey="rsi" stroke="#22d3ee" dot={false} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <ChartCard title="MACD" subtitle="MACD line, signal, histogram">
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={data.chartData.macdSeries}>
            <CartesianGrid strokeDasharray="3 3" stroke="#262626" />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#737373' }} minTickGap={40} />
            <YAxis tick={{ fontSize: 10, fill: '#737373' }} width={60} />
            <Tooltip contentStyle={tooltipStyle} />
            <Legend />
            <Bar dataKey="histogram" fill="#64748b" name="Histogram" />
            <Line type="monotone" dataKey="macd" stroke="#38bdf8" dot={false} name="MACD" />
            <Line type="monotone" dataKey="signal" stroke="#fbbf24" dot={false} name="Signal" />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartCard>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <ChartCard title="Drawdown" subtitle="Peak-to-trough decline">
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={data.chartData.drawdownSeries}>
              <CartesianGrid strokeDasharray="3 3" stroke="#262626" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#737373' }} minTickGap={40} />
              <YAxis tick={{ fontSize: 10, fill: '#737373' }} width={60} tickFormatter={(v) => `${(Number(v) * 100).toFixed(0)}%`} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => fmtPercent(Number(v) * 100)} />
              <Line type="monotone" dataKey="drawdown" stroke="#f87171" dot={false} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Cumulative Return" subtitle="Growth of $1 over the period">
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={data.chartData.returnsSeries}>
              <CartesianGrid strokeDasharray="3 3" stroke="#262626" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#737373' }} minTickGap={40} />
              <YAxis tick={{ fontSize: 10, fill: '#737373' }} width={60} tickFormatter={(v) => `${(Number(v) * 100).toFixed(0)}%`} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => fmtPercent(Number(v) * 100)} />
              <Line type="monotone" dataKey="cumulativeReturn" stroke="#34d399" dot={false} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <Card>
        <CardHeader title="Numerical Metrics" subtitle="Calculated on the server from Alpaca daily bars" />
        <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2 xl:grid-cols-3 text-sm">
          <MetricBlock title="Price Performance" rows={[
            ['Start', fmtCurrency(data.pricePerformance.startingPrice)],
            ['End', fmtCurrency(data.pricePerformance.endingPrice)],
            ['High', fmtCurrency(data.pricePerformance.highestPrice)],
            ['Low', fmtCurrency(data.pricePerformance.lowestPrice)],
            ['Avg Close', fmtCurrency(data.pricePerformance.averageClose)],
          ]} />
          <MetricBlock title="Returns & Risk" rows={[
            ['Ann. Return', fmtPercent(data.returns.annualizedReturnPct)],
            ['Avg Daily Return', fmtPercent(data.returns.averageDailyReturnPct)],
            ['Daily Vol', fmtPercent((data.risk.dailyVolatility ?? 0) * 100)],
            ['Ann. Vol', fmtPercent(data.risk.annualizedVolatilityPct)],
            ['Sharpe', data.risk.sharpeRatio?.toFixed(4) ?? '--'],
            ['Beta vs ' + data.risk.benchmark, data.risk.beta?.toFixed(4) ?? '--'],
          ]} />
          <MetricBlock title="Volume" rows={[
            ['Average', fmtLargeNumber(data.volume.average)],
            ['Latest', fmtLargeNumber(data.volume.latest)],
            ['Highest Day', `${data.volume.highestDate} (${fmtLargeNumber(data.volume.highest)})`],
            ['Relative to Avg', data.volume.relativeToAverage?.toFixed(2) ?? '--'],
          ]} />
        </div>
      </Card>

      <Card>
        <CardHeader title="AI Research Report" subtitle="Gemini explains the calculated metrics (no recomputation in the browser)" />
        <div className="space-y-4 p-4 text-sm text-neutral-300">
          {data.aiError && (
            <p className="rounded-md border border-amber-900/40 bg-amber-950/20 px-3 py-2 text-amber-200/90">{data.aiError}</p>
          )}
          {data.aiReport ? (
            <>
              <ReportSection title="Summary" body={data.aiReport.summary} />
              <ReportSection title="Price Analysis" body={data.aiReport.priceAnalysis} />
              <ReportSection title="Return Analysis" body={data.aiReport.returnAnalysis} />
              <ReportSection title="Risk Analysis" body={data.aiReport.riskAnalysis} />
              <ReportSection title="Technical Analysis" body={data.aiReport.technicalAnalysis} />
              <ReportSection title="Volume Analysis" body={data.aiReport.volumeAnalysis} />
              <ListSection title="Key Observations" items={data.aiReport.keyObservations} />
              <ListSection title="Limitations" items={data.aiReport.limitations} />
            </>
          ) : !data.aiError ? (
            <p className="text-neutral-500">AI report unavailable.</p>
          ) : null}
        </div>
      </Card>

      <Card>
        <CardHeader title="Methodology & Assumptions" />
        <div className="space-y-2 p-4 text-sm text-neutral-400">
          <p>Risk-free rate used for Sharpe: {data.methodology.riskFreeRate}</p>
          <p>Benchmark for beta: {data.methodology.benchmark} ({data.risk.betaObservationCount} aligned daily returns)</p>
          <p>Volatility annualization factor: √{data.methodology.tradingDaysForVolatilityAnnualization}</p>
          <p>{data.methodology.betaFormula}</p>
          <p>Sample calendar days: {data.methodology.calendarDaysInSample} · Daily bars: {data.methodology.barCount}</p>
        </div>
      </Card>
    </div>
  );
}

const tooltipStyle = {
  background: '#171717',
  border: '1px solid #404040',
  borderRadius: '6px',
  fontSize: '12px',
};

function ChartCard({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader title={title} subtitle={subtitle} />
      <div className="p-4">{children}</div>
    </Card>
  );
}

function MetricBlock({ title, rows }: { title: string; rows: [string, string][] }) {
  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">{title}</h3>
      <dl className="space-y-1">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-3">
            <dt className="text-neutral-500">{label}</dt>
            <dd className="text-neutral-200">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function ReportSection({ title, body }: { title: string; body: string }) {
  if (!body) return null;
  return (
    <div>
      <h3 className="mb-1 text-xs font-semibold uppercase text-neutral-500">{title}</h3>
      <p className="leading-relaxed text-neutral-300">{body}</p>
    </div>
  );
}

function ListSection({ title, items }: { title: string; items: string[] }) {
  if (!items?.length) return null;
  return (
    <div>
      <h3 className="mb-1 text-xs font-semibold uppercase text-neutral-500">{title}</h3>
      <ul className="list-disc space-y-1 pl-5 text-neutral-300">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
