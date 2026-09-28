export interface AutomationRun {
  automationRunId: string;
  createdAt: string;
  status: string;
  policyId: string;
  planId: string | null;
  executionSummary?: {
    submitted: number;
    skipped: number;
    failed: number;
  } | null;
}

export interface ExecutionOrderRecord {
  recordId: string;
  automationRunId: string;
  timestamp: string;
  updatedAt?: string;
  action: 'place' | 'cancel' | 'skipped';
  status: string;
  proposalId?: string;
  symbol: string;
  side: 'buy' | 'sell';
  qty?: number;
  notionalUsd?: number;
  estimatedPrice?: number;
  clientOrderId?: string;
  brokerOrderId?: string | null;
  sandbox?: boolean;
  reason?: string;
}

export interface AutomationOrdersResponse {
  automationRunId: string;
  orders: ExecutionOrderRecord[];
  summary: {
    total: number;
    placed: number;
    canceled: number;
    failed: number;
  };
}

export interface ExecuteAutomationResponse {
  engine: 'execution';
  automationRunId: string;
  sandbox: boolean;
  executedAt: string;
  summary: {
    submitted: number;
    skipped: number;
    failed: number;
  };
  message?: string;
}

export interface AutomationHistorySummary {
  automationRunId: string;
  createdAt: string;
  executedAt?: string | null;
  status: string;
  strategySummary?: string;
  budget?: number;
  symbols?: string[];
  horizon?: string;
  plannerSource?: string | null;
  capbac: { approved: number; denied: number };
  execution?: { submitted: number; skipped: number; failed: number } | null;
  sandbox?: boolean | null;
  orders: { total: number; placed: number; canceled: number };
}

export interface AutomationRunDetail {
  run: AutomationRun & {
    plan?: unknown;
    capbac?: unknown;
    userStrategy?: string;
  };
  orders: ExecutionOrderRecord[];
}
