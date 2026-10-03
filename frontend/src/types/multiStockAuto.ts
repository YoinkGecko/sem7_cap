import type { AutoTradeAdvice, StockAutoSession } from './stockAutoSession';

export type MultiStockEntryMode = 'suggested' | 'full';

export interface MultiStockAutoRunConfig {
  totalBudgetUsd: number;
  /** Equal split: totalBudgetUsd / symbolCount */
  budgetUsdPerSymbol: number;
  budgetAllocations?: number[];
  symbolCount?: number;
  maxLossUsd: number;
  profitMinUsd: number;
  intervalMs?: number;
  entryMode: MultiStockEntryMode;
  usePaperBroker?: boolean;
}

export interface MultiStockAutoLeg {
  symbol: string;
  sliceBudgetUsd?: number;
  sessionId?: string | null;
  status: string;
  liveStatus?: string | null;
  entryQty?: number | null;
  entryMode?: MultiStockEntryMode;
  error?: string | null;
  advice?: AutoTradeAdvice | null;
  sessionSnapshot?: StockAutoSession | null;
}

export interface MultiStockAutoRunSummary {
  legCount: number;
  startedCount: number;
  failedCount: number;
  runningCount: number;
  totalEntryCostUsd: number;
  aggregatePnLUsd: number;
  totalBudgetUsd?: number | null;
}

export interface MultiStockAutoRun {
  runId: string;
  status: string;
  createdAt: string;
  completedAt?: string | null;
  config: MultiStockAutoRunConfig;
  symbols: string[];
  legs: MultiStockAutoLeg[];
  summary: MultiStockAutoRunSummary;
}

export interface MultiStockAutoPreviewLeg {
  symbol: string;
  status: string;
  sliceBudgetUsd?: number;
  advice: AutoTradeAdvice | null;
  error: string | null;
}

export interface MultiStockAutoPreview {
  symbols: string[];
  config: MultiStockAutoRunConfig;
  legs: MultiStockAutoPreviewLeg[];
  readyCount: number;
  plannedDeploymentUsd?: number;
}

export interface StartMultiStockAutoRunRequest {
  symbols: string[];
  totalBudgetUsd: number;
  maxLossUsd: number;
  profitMinUsd: number;
  intervalMs?: number;
  entryMode?: MultiStockEntryMode;
  usePaperBroker?: boolean;
  legs?: { symbol: string; advice?: AutoTradeAdvice | null }[];
}
