import type { AnalysisPeriod, StockAnalysisResponse } from '@/types/analysis';
import type { PlannerInput, PlannerResponse } from '@/types/planner';
import type { IntentBatchResponse } from '@/types/intent';
import type {
  CapabilityPolicyInput,
  CapbacEvaluatePlanResponse,
  CapbacPolicyResponse,
  DailyUsage,
} from '@/types/capbac';
import type { TradingPlan } from '@/types/planner';
import type {
  Account,
  Activity,
  PortfolioHistory,
  Order,
  CreateOrderRequest,
  ReplaceOrderRequest,
  Asset,
  Bar,
  Quote,
  Trade,
  Snapshot,
  ScreenerItem,
  MarketClock,
  MarketCalendar,
  NewsArticle,
  CorporateAction,
  ForexRate,
  OptionContract,
  Watchlist,
  CreateWatchlistRequest,
} from '@/types/trading';
import {
  normalizeLatestBar,
  normalizeLatestQuote,
  normalizeLatestTrade,
  normalizeScreener,
  normalizeSnapshot,
  normalizeMarketClock,
} from '@/utils/marketData';

export type {
  Account,
  Activity,
  PortfolioHistory,
  Order,
  OrderSide,
  OrderType,
  CreateOrderRequest,
  ReplaceOrderRequest,
  Asset,
  Bar,
  Quote,
  Trade,
  Snapshot,
  ScreenerItem,
  MarketClock,
  MarketCalendar,
  NewsArticle,
  CorporateAction,
  ForexRate,
  OptionContract,
  Watchlist,
  CreateWatchlistRequest,
} from '@/types/trading';

const DEFAULT_API_BASE = import.meta.env.DEV ? '/api' : 'http://localhost:3000/api';
const BASE_URL = (import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE).replace(/\/$/, '');

export class ApiClientError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  timeoutMs = 90000
): Promise<T> {
  let response: Response;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    response = await fetch(`${BASE_URL}${path}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new ApiClientError(`Request timed out after ${timeoutMs / 1000}s.`, 408);
    }
    throw new ApiClientError('Unable to connect to trading server.', 0);
  } finally {
    clearTimeout(timer);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  let body: unknown;
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    body = await response.json().catch(() => null);
  } else {
    body = await response.text().catch(() => null);
  }

  if (!response.ok) {
    let msg = `Request failed with status ${response.status}`;
    if (typeof body === 'string' && body) {
      msg = body;
    } else if (body && typeof body === 'object' && 'message' in body) {
      msg = String((body as Record<string, unknown>).message);
    } else if (body && typeof body === 'object' && 'error' in body) {
      msg = String((body as Record<string, unknown>).error);
    }
    throw new ApiClientError(msg, response.status);
  }

  return body as T;
}

function toQuery(params?: Record<string, unknown>): string {
  if (!params) return '';
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '');
  if (!entries.length) return '';
  return '?' + entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&');
}

function num(v: string | number | undefined | null): number | undefined {
  if (v === undefined || v === null || v === '') return undefined;
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isNaN(n) ? undefined : n;
}

// ============================================================
// Account
// ============================================================

export const getAccount = () => request<Account>('/account');
export const getAccountActivity = () => request<Activity[]>('/account/activity');
export const getPortfolio = () => request<PortfolioHistory>('/account/portfolio');

// ============================================================
// Orders
// ============================================================

export const getOrders = (status?: string) =>
  request<Order[]>(`/orders${toQuery({ status })}`);

export const getOrder = (id: string) => request<Order>(`/orders/${id}`);
export const getOrderByClientId = (clientOrderId: string) =>
  request<Order>(`/orders/client/${encodeURIComponent(clientOrderId)}`);

export const createOrder = (data: CreateOrderRequest) =>
  request<Order>('/orders', {
    method: 'POST',
    body: JSON.stringify({
      symbol: data.symbol,
      side: data.side,
      qty: data.qty,
      type: data.type,
      ...(data.limit_price !== undefined ? { limit_price: data.limit_price } : {}),
      ...(data.dry_run ? { dry_run: true } : {}),
      ...(data.client_order_id ? { client_order_id: data.client_order_id } : {}),
      ...(data.time_in_force ? { time_in_force: data.time_in_force } : {}),
    }),
  });

export const replaceOrder = (id: string, data: ReplaceOrderRequest) =>
  request<Order>(`/orders/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({
      ...(data.qty !== undefined ? { qty: data.qty } : {}),
      ...(data.limit_price !== undefined ? { limit_price: data.limit_price } : {}),
      ...(data.time_in_force ? { time_in_force: data.time_in_force } : {}),
    }),
  });

export const cancelOrder = (id: string) =>
  request<void>(`/orders/${encodeURIComponent(id)}`, { method: 'DELETE' });

export const cancelAllOrders = () => request<void>('/orders', { method: 'DELETE' });

// ============================================================
// Assets
// ============================================================

export const getAssets = () => request<Asset[] | { assets?: Asset[] }>('/assets');
export const getAsset = (symbol: string) =>
  request<Asset>(`/assets/${encodeURIComponent(symbol)}`);

// ============================================================
// Market Data
// ============================================================

export const getBars = (
  symbol: string,
  params?: { start?: string; end?: string; timeframe?: string; limit?: number }
) => request<Bar[] | { bars?: Bar[] }>(`/market/bars/${encodeURIComponent(symbol)}${toQuery(params as Record<string, unknown>)}`);

export const getQuotes = (symbol: string, params?: { start?: string }) =>
  request<Quote[] | { quotes?: Quote[] }>(`/market/quotes/${encodeURIComponent(symbol)}${toQuery(params as Record<string, unknown>)}`);

export const getTrades = (symbol: string, params?: { start?: string }) =>
  request<Trade[] | { trades?: Trade[] }>(`/market/trades/${encodeURIComponent(symbol)}${toQuery(params as Record<string, unknown>)}`);

export async function getLatestBar(symbol: string): Promise<Bar | null> {
  const data = await request<unknown>(`/market/latest-bar/${encodeURIComponent(symbol)}`);
  return normalizeLatestBar(data);
}

export async function getLatestQuote(symbol: string): Promise<Quote | null> {
  const data = await request<unknown>(`/market/latest-quote/${encodeURIComponent(symbol)}`);
  return normalizeLatestQuote(data);
}

export async function getLatestTrade(symbol: string): Promise<Trade | null> {
  const data = await request<unknown>(`/market/latest-trade/${encodeURIComponent(symbol)}`);
  return normalizeLatestTrade(data);
}

export async function getSnapshot(symbol: string): Promise<Snapshot> {
  const data = await request<unknown>(`/market/snapshot/${encodeURIComponent(symbol)}`);
  return normalizeSnapshot(data);
}

export async function getMostActives(): Promise<ScreenerItem[]> {
  const data = await request<unknown>(`/market/screener/most-actives`);
  return normalizeScreener(data);
}

export async function getMovers(): Promise<ScreenerItem[]> {
  const data = await request<unknown>(`/market/screener/movers`);
  return normalizeScreener(data);
}

export const getMarketClock = async () =>
  normalizeMarketClock(await request<unknown>('/market/clock'));
export const getMarketCalendar = () => request<MarketCalendar[] | { calendar?: MarketCalendar[] }>('/market/calendar');

export async function getNews(symbol: string): Promise<{
  articles: NewsArticle[];
  source?: string;
  model?: string;
  notice?: string;
  fallback?: string;
  stale?: boolean;
}> {
  const data = await request<unknown>(`/market/news/${encodeURIComponent(symbol)}`);
  const obj = data && typeof data === 'object' ? (data as Record<string, unknown>) : null;
  return {
    articles: normalizeNewsArticles(data),
    source: typeof obj?.source === 'string' ? obj.source : undefined,
    model: typeof obj?.model === 'string' ? obj.model : undefined,
    notice: typeof obj?.notice === 'string' ? obj.notice : undefined,
    fallback: typeof obj?.fallback === 'string' ? obj.fallback : undefined,
    stale: obj?.stale === true,
  };
}

function normalizeNewsArticles(data: unknown): NewsArticle[] {
  if (Array.isArray(data)) return data as NewsArticle[];
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    for (const key of ['news', 'data', 'results']) {
      if (Array.isArray(obj[key])) return obj[key] as NewsArticle[];
    }
  }
  return [];
}

export const getCorporateActions = (symbol: string, types?: string) =>
  request<CorporateAction[] | { corporate_actions?: CorporateAction[] }>(
    `/market/corporate-actions/${encodeURIComponent(symbol)}${toQuery({ types })}`
  );

export async function getStockAnalysis(symbol: string, period: AnalysisPeriod = '1Y') {
  return request<StockAnalysisResponse>(
    `/analysis/${encodeURIComponent(symbol)}${toQuery({ period })}`
  );
}

export const getForex = (pair?: string) =>
  request<ForexRate | ForexRate[] | { rates?: ForexRate[] }>(`/market/forex${toQuery({ pair })}`);

// ============================================================
// Options
// ============================================================

export const getOptionsChain = (symbol: string) =>
  request<OptionContract[] | { contracts?: OptionContract[] }>(`/market/options/chain/${encodeURIComponent(symbol)}`);

export const getOptionsSnapshot = (symbol: string) =>
  request<OptionContract[] | { snapshots?: OptionContract[] }>(`/market/options/snapshot/${encodeURIComponent(symbol)}`);

export const getOptionsLatestQuotes = (symbol: string) =>
  request<OptionContract[] | { quotes?: OptionContract[] }>(`/market/options/latest-quotes/${encodeURIComponent(symbol)}`);

// ============================================================
// Watchlists
// ============================================================

function normalizeWatchlist(watchlist: Watchlist): Watchlist {
  return {
    ...watchlist,
    symbols: Array.isArray(watchlist.symbols) ? watchlist.symbols : [],
  };
}

export async function getWatchlists(): Promise<Watchlist[]> {
  const data = await request<Watchlist[] | { watchlists?: Watchlist[] }>('/watchlists');
  const lists = Array.isArray(data) ? data : data.watchlists ?? [];
  return lists.map(normalizeWatchlist);
}

export async function createWatchlist(data: CreateWatchlistRequest): Promise<Watchlist> {
  const watchlist = await request<Watchlist>('/watchlists', {
    method: 'POST',
    body: JSON.stringify({ name: data.name, symbols: data.symbols || [] }),
  });
  return normalizeWatchlist(watchlist);
}

export async function getWatchlist(id: string): Promise<Watchlist> {
  const watchlist = await request<Watchlist>(`/watchlists/${encodeURIComponent(id)}`);
  return normalizeWatchlist(watchlist);
}

export async function addToWatchlist(id: string, symbol: string): Promise<Watchlist> {
  const watchlist = await request<Watchlist>(
    `/watchlists/${encodeURIComponent(id)}/${encodeURIComponent(symbol)}`,
    { method: 'POST' }
  );
  return normalizeWatchlist(watchlist);
}

export async function removeFromWatchlist(id: string, symbol: string): Promise<Watchlist> {
  const watchlist = await request<Watchlist>(
    `/watchlists/${encodeURIComponent(id)}/${encodeURIComponent(symbol)}`,
    { method: 'DELETE' }
  );
  return normalizeWatchlist(watchlist);
}

export const deleteWatchlist = (id: string) =>
  request<void>(`/watchlists/${encodeURIComponent(id)}`, { method: 'DELETE' });

// ============================================================
// Planner Agent
// ============================================================

export async function createTradingPlan(input: PlannerInput): Promise<PlannerResponse> {
  return request<PlannerResponse>('/planner/plan', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function ingestIntentNews(
  symbols: string[],
  limitPerSymbol = 5
): Promise<IntentBatchResponse> {
  return request<IntentBatchResponse>('/intent/ingest-news', {
    method: 'POST',
    body: JSON.stringify({ symbols, limitPerSymbol }),
  });
}

// ============================================================
// CapBAC Permission Engine
// ============================================================

export async function saveCapbacPolicy(input: CapabilityPolicyInput): Promise<CapbacPolicyResponse> {
  return request<CapbacPolicyResponse>('/capbac/policies', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function evaluateCapbacPlan(
  plan: TradingPlan,
  policyId: string,
  dailyUsage?: DailyUsage
): Promise<CapbacEvaluatePlanResponse> {
  return request<CapbacEvaluatePlanResponse>('/capbac/evaluate-plan', {
    method: 'POST',
    body: JSON.stringify({ policyId, plan, dailyUsage }),
  });
}

// ============================================================
// Helpers
// ============================================================

export { num };
