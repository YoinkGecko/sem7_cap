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
  entryQty?: number;
  agentAdvice?: AutoTradeAdvice | null;
}

export interface AutoTradeAdvice {
  symbol: string;
  generatedAt: string;
  currentPrice: number;
  budgetUsd: number;
  maxLossUsd?: number;
  profitMinUsd?: number;
  maxQty: number;
  maxNotionalUsd: number;
  suggestedQty: number;
  suggestedNotionalUsd: number;
  allocationPct?: number;
  confidence?: string;
  reason: string;
  source?: string;
  model?: string;
  news?: {
    notice?: string;
    summary?: string;
    headlines?: { headline: string; summary?: string; publishedAt?: string; source?: string }[];
  };
  behavior?: {
    period?: string;
    available?: boolean;
    summary?: string;
    percentageChange?: number | null;
    maximumDrawdownPct?: number | null;
    annualizedVolatilityPct?: number | null;
    technicalObservations?: string[];
  };
  riskFlags?: string[];
  analysisDetail?: Record<string, unknown> | null;
}

export interface StockAutoHistoryTrade {
  tradeIndex?: number;
  side: 'buy' | 'sell';
  qty: number;
  price?: number;
  at?: string;
  reason?: string;
  status?: string;
  brokerOrderId?: string;
}

export interface StockAutoHistorySession {
  sessionId: string;
  symbol: string;
  status: StockAutoSessionStatus;
  startedAt: string;
  stoppedAt?: string | null;
  stopReason?: string | null;
  budgetUsd: number;
  maxLossUsd: number;
  profitMinUsd: number;
  sharesBought: number;
  avgBuyPrice?: number | null;
  totalCost: number;
  finalPnL: number;
  tradeCount: number;
  trades: StockAutoHistoryTrade[];
}

export interface StockAutoHistoryResponse {
  symbol: string;
  sessionCount: number;
  totalFinalPnL: number;
  sessions: StockAutoHistorySession[];
}
