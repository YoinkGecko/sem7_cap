// ============================================================
// Account
// ============================================================

export interface Account {
  id?: string;
  account_number?: string;
  status?: string;
  currency?: string;
  cash?: string | number;
  cash_withdrawable?: string | number;
  buying_power?: string | number;
  portfolio_value?: string | number;
  equity?: string | number;
  last_equity?: string | number;
  long_market_value?: string | number;
  short_market_value?: string | number;
  initial_margin?: string | number;
  maintenance_margin?: string | number;
  last_maintenance_margin?: string | number;
  daytrading_buying_power?: string | number;
  regt_buying_power?: string | number;
  non_marginable_buying_power?: string | number;
  sma?: string | number;
  created_at?: string;
  trade_suspended_by_user?: boolean;
  pattern_day_trader?: boolean;
  trading_blocked?: boolean;
  transfers_blocked?: boolean;
  account_blocked?: boolean;
  shorting_enabled?: boolean;
  multiplier?: string | number;
  equity_multiplier?: string | number;
}

export interface Activity {
  id: string;
  account_id?: string;
  activity_type?: string;
  date?: string;
  net_amount?: string | number;
  symbol?: string;
  qty?: string | number;
  side?: string;
  price?: string | number;
  description?: string;
  status?: string;
}

export interface PortfolioPoint {
  timestamp?: string;
  equity?: string | number;
  profit_loss?: string | number;
  profit_loss_pct?: string | number;
  base_value?: string | number;
  time?: string;
}

export interface PortfolioHistory {
  timestamp?: string[] | number[];
  equity?: (string | number)[];
  profit_loss?: (string | number)[];
  profit_loss_pct?: (string | number)[];
  base_value?: (string | number)[];
  timeframe?: string;
}

export interface Position {
  symbol: string;
  qty?: number;
  side?: string;
  avg_entry_price?: number;
  current_price?: number;
  market_value?: number;
  cost_basis?: number;
  unrealized_pl?: number;
  /** Decimal fraction from Alpaca (e.g. 0.029 = 2.9%) */
  unrealized_plpc?: number;
  change_today?: number;
  unrealized_intraday_pl?: number;
}

export interface PositionsResponse {
  positions: Position[];
}

// ============================================================
// Orders
// ============================================================

export type OrderSide = 'buy' | 'sell';
export type OrderType = 'market' | 'limit' | 'stop' | 'stop_limit' | 'trailing_stop';
export type OrderStatus =
  | 'new'
  | 'partially_filled'
  | 'filled'
  | 'done_for_day'
  | 'canceled'
  | 'expired'
  | 'replaced'
  | 'pending_cancel'
  | 'pending_replace'
  | 'pending_new'
  | 'accepted'
  | 'pending_review'
  | 'rejected'
  | 'all';

export interface Order {
  id: string;
  client_order_id?: string;
  created_at?: string;
  updated_at?: string;
  submitted_at?: string;
  filled_at?: string;
  expired_at?: string;
  canceled_at?: string;
  failed_at?: string;
  replaced_at?: string;
  replaced_by?: string;
  replaces?: string;
  asset_id?: string;
  symbol: string;
  asset_class?: string;
  qty?: string | number;
  filled_qty?: string | number;
  filled_avg_price?: string | number;
  order_class?: string;
  order_type?: string;
  type?: string;
  side: OrderSide;
  status?: string;
  time_in_force?: string;
  limit_price?: string | number | null;
  stop_price?: string | number | null;
  extended_hours?: boolean;
  legs?: Order[];
  trail_percent?: string | number;
  trail_price?: string | number;
  hwm?: string | number;
}

export interface CreateOrderRequest {
  symbol: string;
  side: OrderSide;
  qty: number;
  type: OrderType;
  limit_price?: number;
  dry_run?: boolean;
  client_order_id?: string;
  time_in_force?: string;
}

export interface ReplaceOrderRequest {
  qty?: number;
  limit_price?: number;
  time_in_force?: string;
}

// ============================================================
// Assets
// ============================================================

export interface Asset {
  id?: string;
  symbol: string;
  name?: string;
  exchange?: string;
  asset_class?: string;
  status?: string;
  tradable?: boolean;
  marginable?: boolean;
  shortable?: boolean;
  easy_to_borrow?: boolean;
  fractionable?: boolean;
}

// ============================================================
// Market Data
// ============================================================

export interface Bar {
  t?: string | number;
  timestamp?: string | number;
  o?: string | number;
  open?: string | number;
  h?: string | number;
  high?: string | number;
  l?: string | number;
  low?: string | number;
  c?: string | number;
  close?: string | number;
  v?: string | number;
  volume?: string | number;
  vw?: string | number;
  n?: number;
}

export interface Quote {
  t?: string | number;
  timestamp?: string | number;
  bp?: string | number;
  bid_price?: string | number;
  bs?: string | number;
  bid_size?: string | number;
  ap?: string | number;
  ask_price?: string | number;
  as?: string | number;
  ask_size?: string | number;
  bx?: string;
  ax?: string;
  z?: string | number;
}

export interface Trade {
  t?: string | number;
  timestamp?: string | number;
  p?: string | number;
  price?: string | number;
  s?: string | number;
  size?: string | number;
  tks?: string;
  i?: string;
  z?: string | number;
}

export interface Snapshot {
  latest_trade?: Trade;
  latest_quote?: Quote;
  latest_bar?: Bar;
  minute_bar?: Bar;
  daily_bar?: Bar;
  prev_daily_bar?: Bar;
  change?: string | number;
  change_pct?: string | number;
  symbol?: string;
  price?: string | number;
  day_change?: string | number;
  day_change_pct?: string | number;
}

export interface ScreenerItem {
  symbol?: string;
  name?: string;
  price?: string | number;
  change?: string | number;
  change_pct?: string | number;
  volume?: string | number;
  trade_count?: string | number;
  last_price?: string | number;
  change_percent?: string | number;
  percent_change?: string | number;
  day_change?: string | number;
  day_change_pct?: string | number;
}

export interface MarketClock {
  timestamp?: string;
  is_open?: boolean;
  next_open?: string;
  next_close?: string;
  market_time?: string;
  session?: string;
}

export interface MarketCalendar {
  date?: string;
  open?: string;
  close?: string;
  session_open?: string;
  session_close?: string;
}

// ============================================================
// News
// ============================================================

export interface NewsArticle {
  id?: string;
  headline?: string;
  source?: string;
  summary?: string;
  author?: string;
  created_at?: string;
  updated_at?: string;
  url?: string;
  symbols?: string[];
  content?: string;
}

// ============================================================
// Corporate Actions & Forex
// ============================================================

export interface CorporateAction {
  id?: string;
  symbol?: string;
  type?: string;
  ex_date?: string;
  record_date?: string;
  payable_date?: string;
  cash?: string | number;
  ratio?: string;
  rate?: string | number;
  declaration_date?: string;
}

export interface ForexRate {
  pair?: string;
  bid?: string | number;
  ask?: string | number;
  last?: string | number;
  rate?: string | number;
  timestamp?: string;
}

// ============================================================
// Options
// ============================================================

export interface OptionContract {
  id?: string;
  symbol?: string;
  name?: string;
  strike_price?: string | number;
  expiration_date?: string;
  expiration?: string;
  type?: string;
  option_type?: string;
  underlying_symbol?: string;
  underlying?: string;
  style?: string;
  root?: string;
  size?: string | number;
  open_interest?: string | number;
  bid?: string | number;
  ask?: string | number;
  last?: string | number;
  close?: string | number;
  volume?: string | number;
  implied_volatility?: string | number;
  delta?: string | number;
  gamma?: string | number;
  theta?: string | number;
  vega?: string | number;
  open?: string | number;
  high?: string | number;
  low?: string | number;
  change?: string | number;
  change_pct?: string | number;
  percent_change?: string | number;
}

export interface OptionsChain {
  [key: string]: unknown;
}

// ============================================================
// Watchlists
// ============================================================

export interface Watchlist {
  id: string;
  name: string;
  symbols?: string[];
  account_id?: string;
  created_at?: string;
  updated_at?: string;
}

export interface CreateWatchlistRequest {
  name: string;
  symbols?: string[];
}

// ============================================================
// Generic API
// ============================================================

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
  [key: string]: unknown;
}

export interface ApiError {
  message: string;
  status?: number;
  details?: unknown;
}
