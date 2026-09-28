export type IntentWarningSeverity = 'high' | 'medium';

export interface IntentWarning {
  code: string;
  severity: IntentWarningSeverity;
  message: string;
  matchedExcerpt: string;
}

export interface IntentProcessedItem {
  itemId: string | null;
  contentType: string;
  source: string | null;
  symbol: string | null;
  url?: string;
  original: { title: string; body: string; length: number };
  sanitized: { title: string; body: string; length: number };
  warnings: IntentWarning[];
  riskScore: number;
  classification: string;
  safeForPlanner: boolean;
  processedAt: string;
}

export interface IntentBatchResponse {
  engine: 'intent';
  processedAt: string;
  items: IntentProcessedItem[];
  summary: {
    total: number;
    flagged: number;
    highRisk: number;
    safeForPlanner: number;
  };
  symbols?: string[];
  fetchNotice?: string | null;
}

export type PipelineEngineId = 'idle' | 'planner' | 'intent' | 'capbac' | 'execution';

export interface PipelineStatus {
  engine: PipelineEngineId;
  step: string;
}
