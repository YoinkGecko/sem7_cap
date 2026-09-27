import type { Bar, MarketClock, Quote, ScreenerItem, Snapshot, Trade } from '@/types/trading';
import { toNum } from '@/utils/format';

export function normalizeScreener(data: unknown): ScreenerItem[] {
  if (Array.isArray(data)) {
    return dedupeScreener(data.map(mapScreenerItem));
  }

  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    const combined: ScreenerItem[] = [];

    for (const key of ['most_actives', 'movers', 'data', 'results']) {
      if (Array.isArray(obj[key])) {
        combined.push(...(obj[key] as ScreenerItem[]).map(mapScreenerItem));
      }
    }
    if (Array.isArray(obj.gainers)) {
      combined.push(...(obj.gainers as ScreenerItem[]).map(mapScreenerItem));
    }
    if (Array.isArray(obj.losers)) {
      combined.push(...(obj.losers as ScreenerItem[]).map(mapScreenerItem));
    }

    if (combined.length) return dedupeScreener(combined);
  }

  return [];
}

function mapScreenerItem(item: ScreenerItem): ScreenerItem {
  return {
    ...item,
    symbol: item.symbol?.toUpperCase(),
    price: item.price ?? item.last_price,
    change: item.change ?? item.day_change,
    change_pct:
      item.change_pct ?? item.change_percent ?? item.percent_change ?? item.day_change_pct,
  };
}

function dedupeScreener(items: ScreenerItem[]): ScreenerItem[] {
  const bySymbol = new Map<string, ScreenerItem>();
  for (const item of items) {
    const sym = item.symbol?.toUpperCase();
    if (!sym) continue;
    const prev = bySymbol.get(sym);
    if (!prev) {
      bySymbol.set(sym, { ...item, symbol: sym });
      continue;
    }
    bySymbol.set(sym, {
      ...prev,
      ...item,
      symbol: sym,
      price: item.price ?? prev.price,
      change: item.change ?? prev.change,
      change_pct: item.change_pct ?? prev.change_pct,
      volume: item.volume ?? prev.volume,
      name: item.name ?? prev.name,
    });
  }
  return Array.from(bySymbol.values());
}

export function normalizeSnapshot(data: unknown): Snapshot {
  if (!data || typeof data !== 'object') {
    return {};
  }

  const raw = data as Record<string, unknown>;
  const latestTrade = pickTrade(raw.latestTrade ?? raw.latest_trade);
  const latestQuote = pickQuote(raw.latestQuote ?? raw.latest_quote);
  const dailyBar = pickBar(raw.dailyBar ?? raw.daily_bar);
  const prevDailyBar = pickBar(raw.prevDailyBar ?? raw.prev_daily_bar);
  const minuteBar = pickBar(raw.minuteBar ?? raw.minute_bar);

  const price = toNum(
    latestTrade?.p ??
      latestTrade?.price ??
      dailyBar?.c ??
      dailyBar?.close ??
      (typeof raw.price === 'string' || typeof raw.price === 'number' ? raw.price : undefined)
  );
  const prevClose = toNum(prevDailyBar?.c ?? prevDailyBar?.close);
  const current = toNum(dailyBar?.c ?? dailyBar?.close ?? price);

  let change: number | undefined;
  let changePct: number | undefined;
  if (current !== undefined && prevClose !== undefined) {
    change = current - prevClose;
    changePct = prevClose !== 0 ? (change / prevClose) * 100 : undefined;
  }

  return {
    symbol: typeof raw.symbol === 'string' ? raw.symbol : undefined,
    latest_trade: latestTrade ?? undefined,
    latest_quote: latestQuote ?? undefined,
    daily_bar: dailyBar ?? undefined,
    prev_daily_bar: prevDailyBar ?? undefined,
    minute_bar: minuteBar ?? undefined,
    price,
    change,
    change_pct: changePct,
    day_change: change,
    day_change_pct: changePct,
  };
}

export function normalizeLatestTrade(data: unknown): Trade | null {
  if (!data || typeof data !== 'object') return null;
  const obj = data as Record<string, unknown>;
  if (obj.trade && typeof obj.trade === 'object') return obj.trade as Trade;
  return obj as Trade;
}

export function normalizeLatestQuote(data: unknown): Quote | null {
  if (!data || typeof data !== 'object') return null;
  const obj = data as Record<string, unknown>;
  if (obj.quote && typeof obj.quote === 'object') return obj.quote as Quote;
  return obj as Quote;
}

export function normalizeLatestBar(data: unknown): Bar | null {
  if (!data || typeof data !== 'object') return null;
  const obj = data as Record<string, unknown>;
  if (obj.bar && typeof obj.bar === 'object') return obj.bar as Bar;
  return obj as Bar;
}

function pickTrade(value: unknown): Trade | null {
  return value && typeof value === 'object' ? (value as Trade) : null;
}

function pickQuote(value: unknown): Quote | null {
  return value && typeof value === 'object' ? (value as Quote) : null;
}

function pickBar(value: unknown): Bar | null {
  return value && typeof value === 'object' ? (value as Bar) : null;
}

export function screenerChangePct(item: ScreenerItem): number | string | undefined {
  return item.change_pct ?? item.change_percent ?? item.percent_change ?? item.day_change_pct;
}

export function screenerChange(item: ScreenerItem): number | string | undefined {
  return item.change ?? item.day_change;
}

export function screenerPrice(item: ScreenerItem): number | string | undefined {
  return item.price ?? item.last_price;
}

function toBool(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') return value;
  if (value === 'true' || value === 1) return true;
  if (value === 'false' || value === 0) return false;
  return undefined;
}

function inferMarketOpen(timestamp?: string, nextOpen?: string, nextClose?: string): boolean | undefined {
  if (!timestamp || !nextOpen || !nextClose) return undefined;

  const t = new Date(timestamp).getTime();
  const openT = new Date(nextOpen).getTime();
  const closeT = new Date(nextClose).getTime();

  if (!Number.isFinite(t) || !Number.isFinite(openT) || !Number.isFinite(closeT)) {
    return undefined;
  }

  if (openT > closeT) {
    return t < closeT;
  }

  return t >= openT && t < closeT;
}

export function normalizeMarketClock(data: unknown): MarketClock | null {
  if (!data || typeof data !== 'object') return null;

  const raw = data as Record<string, unknown>;
  const source =
    raw.clock && typeof raw.clock === 'object' ? (raw.clock as Record<string, unknown>) : raw;

  const timestamp = (source.timestamp ?? source.market_time) as string | undefined;
  const nextOpen = (source.next_open ?? source.nextOpen) as string | undefined;
  const nextClose = (source.next_close ?? source.nextClose) as string | undefined;

  let isOpen = toBool(source.is_open ?? source.isOpen);
  if (typeof isOpen !== 'boolean') {
    isOpen = inferMarketOpen(timestamp, nextOpen, nextClose);
  }

  return {
    timestamp,
    market_time: (source.market_time as string | undefined) ?? timestamp,
    next_open: nextOpen,
    next_close: nextClose,
    session: source.session as string | undefined,
    is_open: isOpen ?? false,
  };
}

export function marketStatusLabel(clock: MarketClock | null, loading?: boolean): string {
  if (loading) return 'Checking market status…';
  if (!clock) return 'Market status unavailable';
  return clock.is_open ? 'US market open (regular session)' : 'US market closed';
}

