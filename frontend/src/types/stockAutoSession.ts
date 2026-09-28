export type StockAutoSessionStatus = 'RUNNING' | 'STOPPED' | 'LOSS_LIMIT_REACHED';

export type StockAutoStrategyType = 'pullback_entry' | 'momentum_breakout';

export interface StockAutoTradeRecord {
  side: 'buy' | 'sell';
  qty: number;
  price?: number;
  at?: string;
  reason?: string;
  status?: string;
  brokerOrderId?: string;
}

export interface StockAutoSession {
  sessionId: string;
  symbol: string;
  status: StockAutoSessionStatus;
  budgetUsd: number;
  maxLossUsd: number;
  intervalMs: number;
  strategyType: StockAutoStrategyType;
  usePaperBroker: boolean;
  startedAt: string;
  stoppedAt?: string | null;
  stopReason?: string | null;
  tradeCount: number;
  ticks: number;
  lastTickAt?: string | null;
  lastError?: string | null;
  currentPrice?: number | null;
  dayChangePct?: number | null;
  availableBudgetUsd?: number;
  positionQty?: number;
  positionSide?: string;
  positionMarketValue?: number;
  positionAvgEntry?: number | null;
  runningPnL?: number;
  realizedPnL?: number;
  unrealizedPnL?: number;
  lastTrade?: StockAutoTradeRecord | null;
  lastProposal?: { action?: string | null; reason?: string; evaluatedAt?: string } | null;
  lossLimitTriggered?: boolean;
  tickLog?: { at: string; message: string }[];
}

export interface StartStockAutoSessionRequest {
  budgetUsd: number;
  maxLossUsd: number;
  intervalMs?: number;
  strategyType?: StockAutoStrategyType;
  usePaperBroker?: boolean;
}
