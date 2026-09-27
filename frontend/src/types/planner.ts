export type TradingHorizon = 'hours' | 'days' | 'weeks';

export interface PlannerInput {
  strategy: string;
  budget: number;
  symbols: string[];
  horizon: TradingHorizon;
}

export interface BudgetGuidance {
  totalBudget: number;
  maxPerPositionUsd: number;
  suggestedConcurrentPositions: number;
  reserveCashPct: number;
  notes: string;
}

export interface CandidateTrade {
  symbol: string;
  side: 'buy' | 'sell';
  status: 'conditional' | 'watchlist';
  rationale: string;
  suggestedNotionalUsd: number;
  entryTriggers: string[];
  exitTriggers: string[];
}

export interface NoTradeDecision {
  shouldTrade: boolean;
  conditions: string[];
  action: string;
}

export interface TradingPlan {
  planId: string;
  generatedAt: string;
  userStrategy: string;
  strategySummary: string;
  budget: number;
  currency: string;
  allowedSymbols: string[];
  horizon: TradingHorizon;
  monitoring: string[];
  entryConditions: string[];
  exitConditions: string[];
  budgetGuidance: BudgetGuidance;
  candidateTrades: CandidateTrade[];
  noTradeDecision: NoTradeDecision;
  riskNotes: string[];
  assumptions: string[];
}

export interface PlannerResponse {
  plan: TradingPlan;
  source: 'gemini' | 'fallback';
  model: string | null;
  plannerError: string | null;
}
