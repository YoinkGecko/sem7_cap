export interface CapabilityPolicy {
  policyId: string;
  createdAt: string;
  strategyId?: string | null;
  strategyName?: string | null;
  allowedStocks: string[];
  maxOrderValueUsd: number;
  maxPositionSizeUsd: number;
  dailyTradeLimit: number;
  dailySpendingLimitUsd: number;
  allowShortSelling: boolean;
}

export interface CapabilityPolicyInput {
  allowedStocks: string[];
  maxOrderValueUsd: number;
  maxPositionSizeUsd: number;
  dailyTradeLimit: number;
  dailySpendingLimitUsd: number;
  allowShortSelling: boolean;
  strategyId?: string;
  strategyName?: string;
}

export interface DailyUsage {
  tradeCount: number;
  spendingUsd: number;
}

export type CapbacDecision = 'APPROVED' | 'DENIED';

export interface CapbacViolation {
  code: string;
  message: string;
}

export interface CapbacProposalResult {
  proposalId: string;
  symbol: string;
  side: 'buy' | 'sell';
  notionalUsd: number;
  decision: CapbacDecision;
  violations: CapbacViolation[];
  reason: string;
}

export interface CapbacEvaluatePlanResponse {
  engine: 'capbac';
  evaluatedAt: string;
  policyId: string;
  dailyUsageStart: DailyUsage;
  dailyUsageEnd: DailyUsage;
  results: CapbacProposalResult[];
  summary: {
    total: number;
    approved: number;
    denied: number;
  };
}

export interface CapbacPolicyResponse {
  policy: CapabilityPolicy;
}
