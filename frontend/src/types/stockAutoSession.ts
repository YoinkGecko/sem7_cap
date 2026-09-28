export type StockAutoSessionStatus =
  | 'RUNNING'
  | 'STOPPED'
  | 'LOSS_LIMIT_REACHED'
  | 'PROFIT_TARGET_REACHED';

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
  profitMinUsd: number;
  intervalMs: number;
  usePaperBroker: boolean;
  startedAt: string;
  stoppedAt?: string | null;
  stopReason?: string | null;
  tradeCount: number;
  ticks: number;
  lastTickAt?: string | null;
  lastError?: string | null;
  currentPrice?: number | null;
  sessionEntryQty?: number;
  sessionEntryAvgPrice?: number | null;
  sessionTotalCost?: number;
  sessionMarketValue?: number;
  positionQty?: number;
  positionMarketValue?: number;
  positionAvgEntry?: number | null;
  runningPnL?: number;
  lastTrade?: StockAutoTradeRecord | null;
  lastEvaluation?: { action?: string | null; reason?: string; evaluatedAt?: string } | null;
  initialBuyComplete?: boolean;
  lossLimitTriggered?: boolean;
  profitTargetReached?: boolean;
  tickLog?: { at: string; message: string }[];
}

export interface StartStockAutoSessionRequest {
  budgetUsd: number;
  maxLossUsd: number;
  profitMinUsd: number;
  intervalMs?: number;
  usePaperBroker?: boolean;
}
