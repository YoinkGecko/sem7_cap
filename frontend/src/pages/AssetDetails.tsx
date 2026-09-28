import { useCallback, useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, FileBarChart } from 'lucide-react';
import { getAsset, getSnapshot, getLatestQuote, getLatestTrade, getLatestBar } from '@/services/api';
import type { Asset, Snapshot, Quote, Trade, Bar } from '@/types/trading';
import { Card, CardHeader, LoadingState, ErrorState } from '@/components/common/UI';
import { PriceChart } from '@/components/market/PriceChart';
import { OrderTicket } from '@/components/orders/OrderTicket';
import { StockAutoTradingPanel } from '@/components/market/StockAutoTradingPanel';
import { NewsSection } from '@/components/market/NewsSection';
import { OptionsSection } from '@/components/market/OptionsSection';
import { fmtCurrency, fmtPercent, fmtLargeNumber, fmtInt, pctColor, toNum } from '@/utils/format';

const PRICE_POLL_MS = 5000;

export function AssetDetails() {
  const { symbol } = useParams<{ symbol: string }>();
  const [asset, setAsset] = useState<Asset | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [trade, setTrade] = useState<Trade | null>(null);
  const [bar, setBar] = useState<Bar | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshLiveQuotes = useCallback(async () => {
    if (!symbol) return;
    try {
      const [s, q, t, b] = await Promise.all([
        getSnapshot(symbol).catch(() => null),
        getLatestQuote(symbol).catch(() => null),
        getLatestTrade(symbol).catch(() => null),
        getLatestBar(symbol).catch(() => null),
      ]);
      if (s) setSnapshot(s);
      if (q) setQuote(q);
      if (t) setTrade(t);
      if (b) setBar(b);
    } catch {
      /* keep last known values on poll failure */
    }
  }, [symbol]);

  const fetch = async () => {
    if (!symbol) return;
    setLoading(true);
    setError(null);
    try {
      const [a, s, q, t, b] = await Promise.all([
        getAsset(symbol).catch(() => null),
        getSnapshot(symbol).catch(() => null),
        getLatestQuote(symbol).catch(() => null),
        getLatestTrade(symbol).catch(() => null),
        getLatestBar(symbol).catch(() => null),
      ]);
      setAsset(a);
      setSnapshot(s);
      setQuote(q);
      setTrade(t);
      setBar(b);
    } catch {
      setError('Unable to load asset data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetch();
  }, [symbol]);

  useEffect(() => {
    if (!symbol) return;
    const interval = setInterval(refreshLiveQuotes, PRICE_POLL_MS);
    return () => clearInterval(interval);
  }, [symbol, refreshLiveQuotes]);

  if (loading) return <div className="p-6"><LoadingState text="Loading asset data..." /></div>;
  if (error) return <div className="p-6"><ErrorState message={error} onRetry={fetch} /></div>;

  const price = toNum(trade?.p ?? trade?.price ?? snapshot?.latest_trade?.p ?? snapshot?.latest_trade?.price ?? snapshot?.price);
  const change = toNum(snapshot?.change ?? snapshot?.day_change);
  const changePct = toNum(snapshot?.change_pct ?? snapshot?.day_change_pct);
  const bid = toNum(quote?.bp ?? quote?.bid_price ?? snapshot?.latest_quote?.bp ?? snapshot?.latest_quote?.bid_price);
  const ask = toNum(quote?.ap ?? quote?.ask_price ?? snapshot?.latest_quote?.ap ?? snapshot?.latest_quote?.ask_price);
  const open = toNum(bar?.o ?? bar?.open ?? snapshot?.daily_bar?.o ?? snapshot?.daily_bar?.open);
  const high = toNum(bar?.h ?? bar?.high ?? snapshot?.daily_bar?.h ?? snapshot?.daily_bar?.high);
  const low = toNum(bar?.l ?? bar?.low ?? snapshot?.daily_bar?.l ?? snapshot?.daily_bar?.low);
  const volume = toNum(bar?.v ?? bar?.volume ?? snapshot?.daily_bar?.v ?? snapshot?.daily_bar?.volume);
  const prevClose = toNum(snapshot?.prev_daily_bar?.c ?? snapshot?.prev_daily_bar?.close);

  const stats = [
    { label: 'Bid', value: fmtCurrency(bid) },
    { label: 'Ask', value: fmtCurrency(ask) },
    { label: 'Open', value: fmtCurrency(open) },
    { label: 'High', value: fmtCurrency(high) },
    { label: 'Low', value: fmtCurrency(low) },
    { label: 'Volume', value: fmtLargeNumber(volume) },
    { label: 'Prev Close', value: fmtCurrency(prevClose) },
    { label: 'Bid Size', value: fmtInt(quote?.bs ?? quote?.bid_size) },
    { label: 'Ask Size', value: fmtInt(quote?.as ?? quote?.ask_size) },
  ];

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link to="/markets" className="inline-flex items-center gap-1.5 text-sm text-neutral-400 hover:text-sky-400">
          <ArrowLeft className="h-4 w-4" />
          Back to Markets
        </Link>
        <Link
          to={`/analysis/${symbol}`}
          className="inline-flex items-center gap-1.5 rounded-md border border-neutral-700 px-3 py-1.5 text-sm text-neutral-200 hover:border-sky-700 hover:text-sky-400"
        >
          <FileBarChart className="h-4 w-4" />
          Research Report
        </Link>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-neutral-100">{symbol}</h1>
            {asset?.exchange && (
              <span className="rounded border border-neutral-700 bg-neutral-800 px-2 py-0.5 text-xs text-neutral-400">
                {asset.exchange}
              </span>
            )}
          </div>
          <p className="text-sm text-neutral-500 mt-0.5">{asset?.name || symbol}</p>
        </div>
        <div className="text-right">
          <p className="text-3xl font-bold text-neutral-100">{fmtCurrency(price)}</p>
          <p className={`text-sm font-medium ${pctColor(change ?? changePct)}`}>
            {change !== undefined ? `${change >= 0 ? '+' : ''}${fmtCurrency(change)}` : '--'} ({fmtPercent(changePct)})
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader title="Price Chart" subtitle={`${symbol} · 1Y default · switch timeframe below`} />
            <div className="p-4">
              <PriceChart symbol={symbol!} defaultTimeframe="1Y" height={420} />
            </div>
          </Card>
        </div>
        <div className="lg:sticky lg:top-4 lg:self-start space-y-4">
          <OrderTicket symbol={symbol!} latestPrice={price} />
          <StockAutoTradingPanel symbol={symbol!} livePrice={price} />
        </div>
      </div>

      <Card>
        <CardHeader title="Market Statistics" />
        <div className="grid grid-cols-2 gap-4 p-4 sm:grid-cols-3 lg:grid-cols-5">
          {stats.map((s) => (
            <div key={s.label}>
              <p className="text-xs text-neutral-500">{s.label}</p>
              <p className="mt-1 text-sm font-medium text-neutral-200">{s.value}</p>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <NewsSection symbol={symbol!} />
        <OptionsSection symbol={symbol!} />
      </div>
    </div>
  );
}
