import { useState } from 'react';
import { Bot, LockKeyhole, Play, Shield, Sparkles, Zap, XCircle } from 'lucide-react';
import { Card, CardHeader, Badge, LoadingState, Spinner } from '@/components/common/UI';
import { useToast } from '@/components/common/Toast';
import { AutomationHistoryPanel } from '@/components/automation/AutomationHistoryPanel';
import {
  createTradingPlan,
  ingestIntentNews,
  saveCapbacPolicy,
  evaluateCapbacPlan,
  registerAutomationRun,
  executeAutomationRun,
  getAutomationOrders,
  cancelAutomationOrder,
} from '@/services/api';
import type { PlannerResponse, TradingHorizon } from '@/types/planner';
import type { IntentBatchResponse, PipelineStatus } from '@/types/intent';
import type { CapbacEvaluatePlanResponse } from '@/types/capbac';
import type { AutomationOrdersResponse } from '@/types/automation';

const DEFAULT_STRATEGY =
  'Find short-term opportunities based on momentum and important news. Prefer liquid names with clear trend confirmation.';

const ENGINE_META = {
  idle: { label: 'Ready', icon: Bot, accent: 'text-neutral-400' },
  planner: { label: 'Planner Agent', icon: Sparkles, accent: 'text-sky-400' },
  intent: { label: 'Intent Engine', icon: Shield, accent: 'text-emerald-400' },
  capbac: { label: 'CapBAC Permission Engine', icon: LockKeyhole, accent: 'text-violet-400' },
  execution: { label: 'Execution Engine', icon: Zap, accent: 'text-orange-400' },
} as const;

function defaultCapbacLimits(budgetNum: number) {
  const perTrade = Math.max(100, Math.round(budgetNum * 0.35));
  return {
    maxOrderValue: String(perTrade),
    maxPositionSize: String(perTrade),
    dailyTradeLimit: '10',
    dailySpendingLimit: String(budgetNum),
  };
}

function BulletList({ items }: { items: string[] }) {
  if (!items.length) return null;
  return (
    <ul className="list-disc space-y-1 pl-5 text-sm text-neutral-300">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

function PipelineBanner({ status, running }: { status: PipelineStatus; running: boolean }) {
  const meta = ENGINE_META[status.engine];
  const Icon = meta.icon;

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/80 px-4 py-3">
      <div className="flex items-center gap-2">
        {running ? <Spinner className={`h-4 w-4 ${meta.accent}`} /> : <Icon className={`h-4 w-4 ${meta.accent}`} />}
        <span className={`text-sm font-semibold ${meta.accent}`}>{meta.label}</span>
        {running && (
          <span className="text-xs text-neutral-500">running</span>
        )}
      </div>
      <p className="mt-1 text-sm text-neutral-400">{status.step}</p>
    </div>
  );
}

export function AutomatedTrading() {
  const { notify } = useToast();
  const [strategy, setStrategy] = useState(DEFAULT_STRATEGY);
  const [budget, setBudget] = useState('2000');
  const [symbols, setSymbols] = useState('AAPL, MSFT, NVDA, TSLA');
  const [horizon, setHorizon] = useState<TradingHorizon>('days');
  const capbacDefaults = defaultCapbacLimits(2000);
  const [maxOrderValue, setMaxOrderValue] = useState(capbacDefaults.maxOrderValue);
  const [maxPositionSize, setMaxPositionSize] = useState(capbacDefaults.maxPositionSize);
  const [dailyTradeLimit, setDailyTradeLimit] = useState(capbacDefaults.dailyTradeLimit);
  const [dailySpendingLimit, setDailySpendingLimit] = useState(capbacDefaults.dailySpendingLimit);
  const [allowShortSelling, setAllowShortSelling] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pipeline, setPipeline] = useState<PipelineStatus>({
    engine: 'idle',
    step: 'Configure inputs and run the pipeline (Planner → Intent → CapBAC).',
  });
  const [result, setResult] = useState<PlannerResponse | null>(null);
  const [intentResult, setIntentResult] = useState<IntentBatchResponse | null>(null);
  const [capbacResult, setCapbacResult] = useState<CapbacEvaluatePlanResponse | null>(null);
  const [automationRunId, setAutomationRunId] = useState<string | null>(null);
  const [executionLedger, setExecutionLedger] = useState<AutomationOrdersResponse | null>(null);
  const [executeLoading, setExecuteLoading] = useState(false);
  const [paperLive, setPaperLive] = useState(false);
  const [showJson, setShowJson] = useState(false);
  const [historyRefresh, setHistoryRefresh] = useState(0);

  async function refreshExecutionLedger(runId: string) {
    const ledger = await getAutomationOrders(runId);
    setExecutionLedger(ledger);
  }

  async function handleExecuteApproved(runId?: string) {
    const id = runId || automationRunId;
    if (!id) return;
    setExecuteLoading(true);
    setPipeline({
      engine: 'execution',
      step: paperLive
        ? 'Submitting CapBAC-approved proposals to paper broker…'
        : 'Sandbox dry-run: translating approved trades to orders (no broker submit)…',
    });
    try {
      await executeAutomationRun(id, !paperLive);
      await refreshExecutionLedger(id);
      setPipeline({
        engine: 'execution',
        step: 'Execution complete — see order ledger for this automation run id.',
      });
      setHistoryRefresh((n) => n + 1);
      notify('success', paperLive ? 'Orders submitted via Execution Engine.' : 'Sandbox execution logged.');
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'Execution failed.');
    } finally {
      setExecuteLoading(false);
    }
  }

  async function handleCancelExecutionRecord(recordId: string) {
    if (!automationRunId) return;
    try {
      await cancelAutomationOrder(automationRunId, recordId);
      await refreshExecutionLedger(automationRunId);
      setHistoryRefresh((n) => n + 1);
      notify('success', 'Order marked canceled.');
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'Cancel failed.');
    }
  }

  async function runFullPipeline(autoExecute: boolean) {
    const parsedBudget = Number(budget);
    const symbolList = symbols
      .split(/[\s,]+/)
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);

    if (!strategy.trim() || symbolList.length === 0 || !Number.isFinite(parsedBudget) || parsedBudget <= 0) {
      notify('error', 'Check strategy, budget, and symbols.');
      return;
    }

    setLoading(true);
    setResult(null);
    setIntentResult(null);
    setCapbacResult(null);
    setAutomationRunId(null);
    setExecutionLedger(null);

    try {
      setPipeline({ engine: 'planner', step: 'Validating strategy, budget, symbols, and horizon…' });
      await new Promise((r) => setTimeout(r, 0));

      setPipeline({ engine: 'planner', step: 'Generating structured trading plan…' });
      const payload = await createTradingPlan({
        strategy: strategy.trim(),
        budget: parsedBudget,
        symbols: symbolList,
        horizon,
      });
      setResult(payload);

      setPipeline({ engine: 'intent', step: 'Fetching news and filings text for allowed symbols…' });
      const intent = await ingestIntentNews(payload.plan.allowedSymbols, 5);
      setIntentResult(intent);

      setPipeline({ engine: 'capbac', step: 'Storing capability policy…' });
      const policyRes = await saveCapbacPolicy({
        allowedStocks: symbolList,
        maxOrderValueUsd: Number(maxOrderValue),
        maxPositionSizeUsd: Number(maxPositionSize),
        dailyTradeLimit: Number(dailyTradeLimit),
        dailySpendingLimitUsd: Number(dailySpendingLimit),
        allowShortSelling,
        strategyName: strategy.trim().slice(0, 80),
      });

      setPipeline({ engine: 'capbac', step: 'Checking each planner proposal against your capability policy…' });
      const gate = await evaluateCapbacPlan(payload.plan, policyRes.policy.policyId, {
        tradeCount: 0,
        spendingUsd: 0,
      });
      setCapbacResult(gate);

      const { run } = await registerAutomationRun({
        plan: payload.plan,
        capbac: gate,
        policyId: policyRes.policy.policyId,
        capabilityPolicy: policyRes.policy,
        plannerSource: payload.source,
        strategyName: strategy.trim().slice(0, 80),
      });
      setAutomationRunId(run.automationRunId);
      await refreshExecutionLedger(run.automationRunId);
      setHistoryRefresh((n) => n + 1);

      if (autoExecute) {
        setLoading(false);
        if (gate.summary.approved === 0) {
          notify('error', 'No CapBAC-approved trades to execute.');
          setPipeline({ engine: 'idle', step: 'Pipeline finished with zero approved trades.' });
          return;
        }
        await handleExecuteApproved(run.automationRunId);
        setPipeline({ engine: 'execution', step: `Auto Trade complete · run ${run.automationRunId}` });
        notify('success', 'Auto Trade finished (pipeline + execution).');
        return;
      }

      setPipeline({
        engine: 'capbac',
        step: `CapBAC complete · run ${run.automationRunId} · ${gate.summary.approved} approved.`,
      });
      notify('success', 'Pipeline ready for Execution Engine.');
    } catch (err) {
      setPipeline({ engine: 'idle', step: 'Pipeline stopped due to an error.' });
      notify('error', err instanceof Error ? err.message : 'Pipeline failed.');
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    await runFullPipeline(false);
  }

  async function handleAutoTrade() {
    await runFullPipeline(true);
  }

  const plan = result?.plan;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-sky-900/30 p-2">
          <Bot className="h-6 w-6 text-sky-400" />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-neutral-100">Automated Trading</h1>
          <p className="mt-0.5 max-w-2xl text-sm text-neutral-500">
            Planner → Intent → CapBAC → Execution. Only the sandboxed Execution Engine may call the broker API.
          </p>
        </div>
      </div>

      <PipelineBanner status={pipeline} running={loading || executeLoading} />

      <AutomationHistoryPanel refreshToken={historyRefresh} />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Planner inputs" subtitle="Strategy + budget + watchlist + horizon" />
          <form onSubmit={handleGenerate} className="space-y-4 p-4">
            <div>
              <label className="text-xs font-medium text-neutral-400">Trading strategy / objective</label>
              <textarea
                value={strategy}
                onChange={(e) => setStrategy(e.target.value)}
                rows={5}
                className="mt-1 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-sky-600 focus:outline-none"
                placeholder="Describe how the agent should find and evaluate trades…"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-xs font-medium text-neutral-400">Total budget (USD)</label>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  className="mt-1 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 focus:border-sky-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-neutral-400">Time horizon</label>
                <select
                  value={horizon}
                  onChange={(e) => setHorizon(e.target.value as TradingHorizon)}
                  className="mt-1 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 focus:border-sky-600 focus:outline-none"
                >
                  <option value="hours">Hours</option>
                  <option value="days">Days</option>
                  <option value="weeks">Weeks</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-neutral-400">Allowed symbols</label>
              <input
                value={symbols}
                onChange={(e) => setSymbols(e.target.value)}
                className="mt-1 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 focus:border-sky-600 focus:outline-none"
                placeholder="AAPL, MSFT, NVDA"
              />
              <p className="mt-1 text-xs text-neutral-500">Comma-separated tickers the agent may consider.</p>
            </div>
            <div className="rounded-md border border-neutral-800 bg-neutral-950/50 p-3 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-violet-400">CapBAC permissions</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-medium text-neutral-400">Max order value (USD)</label>
                  <input
                    type="number"
                    min={1}
                    value={maxOrderValue}
                    onChange={(e) => setMaxOrderValue(e.target.value)}
                    className="mt-1 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 focus:border-violet-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-neutral-400">Max position size (USD)</label>
                  <input
                    type="number"
                    min={1}
                    value={maxPositionSize}
                    onChange={(e) => setMaxPositionSize(e.target.value)}
                    className="mt-1 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 focus:border-violet-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-neutral-400">Daily trade limit</label>
                  <input
                    type="number"
                    min={1}
                    value={dailyTradeLimit}
                    onChange={(e) => setDailyTradeLimit(e.target.value)}
                    className="mt-1 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 focus:border-violet-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-neutral-400">Daily spending limit (USD)</label>
                  <input
                    type="number"
                    min={1}
                    value={dailySpendingLimit}
                    onChange={(e) => setDailySpendingLimit(e.target.value)}
                    className="mt-1 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 focus:border-violet-600 focus:outline-none"
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-neutral-300">
                <input
                  type="checkbox"
                  checked={allowShortSelling}
                  onChange={(e) => setAllowShortSelling(e.target.checked)}
                  className="rounded border-neutral-600 bg-neutral-950"
                />
                Allow short selling
              </label>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="submit"
                disabled={loading || executeLoading}
                className="inline-flex items-center justify-center gap-2 rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50"
              >
                <Sparkles className="h-4 w-4" />
                {loading ? 'Running…' : 'Run pipeline only'}
              </button>
              <button
                type="button"
                disabled={loading || executeLoading}
                onClick={handleAutoTrade}
                className="inline-flex items-center justify-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
              >
                <Play className="h-4 w-4" />
                {loading || executeLoading ? 'Auto trading…' : 'Auto Trade'}
              </button>
            </div>
            <p className="text-xs text-neutral-500">
              Auto Trade runs the full pipeline then executes approved symbols. Simulated sandbox by default; enable
              paper broker for real Alpaca paper orders. Keep the API server running on port 3000.
            </p>
          </form>
        </Card>

        <div className="space-y-6">
        <Card>
          <CardHeader
            title="Trading plan"
            subtitle={plan ? `Plan ${plan.planId}` : 'Run the pipeline to see output'}
            action={
              plan ? (
                <button
                  type="button"
                  onClick={() => setShowJson((v) => !v)}
                  className="text-xs text-sky-400 hover:text-sky-300"
                >
                  {showJson ? 'Hide JSON' : 'View JSON'}
                </button>
              ) : null
            }
          />
          <div className="p-4">
            {loading && !plan && pipeline.engine === 'planner' && (
              <LoadingState text="Planner is building your strategy…" />
            )}
            {loading && !plan && pipeline.engine === 'intent' && (
              <LoadingState text="Intent Engine is scanning external content…" />
            )}
            {loading && !plan && pipeline.engine === 'capbac' && (
              <LoadingState text="CapBAC is checking capability permissions…" />
            )}
            {loading && plan && (
              <p className="mb-4 text-xs text-amber-300/90">
                Pipeline still running ({pipeline.engine}) — partial results shown below.
              </p>
            )}
            {!loading && !plan && (
              <p className="text-sm text-neutral-500">
                Your structured plan will appear here: monitoring, entries, exits, budget rules, and candidate trades.
              </p>
            )}
            {plan && showJson && (
              <pre className="max-h-[520px] overflow-auto rounded-md bg-neutral-950 p-3 text-xs text-neutral-300">
                {JSON.stringify({ planner: result, intent: intentResult, capbac: capbacResult, automationRunId, executionLedger }, null, 2)}
              </pre>
            )}
            {plan && !showJson && (
              <div className="space-y-5">
                <div className="flex flex-wrap gap-2">
                  <Badge color="blue">{plan.horizon}</Badge>
                  <Badge>${plan.budget.toLocaleString()} budget</Badge>
                  <Badge>{plan.allowedSymbols.join(', ')}</Badge>
                  {result && (
                    <Badge color={result.source === 'gemini' ? 'green' : 'amber'}>
                      {result.source}
                      {result.model ? ` · ${result.model}` : ''}
                    </Badge>
                  )}
                </div>
                {result?.plannerError && (
                  <p className="rounded-md border border-amber-800/50 bg-amber-900/20 px-3 py-2 text-xs text-amber-300">
                    {result.plannerError}
                  </p>
                )}
                <section>
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Strategy</h4>
                  <p className="mt-1 text-sm text-neutral-200">{plan.strategySummary}</p>
                </section>
                <section>
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">What to monitor</h4>
                  <div className="mt-2">
                    <BulletList items={plan.monitoring} />
                  </div>
                </section>
                <section className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Entry conditions</h4>
                    <div className="mt-2">
                      <BulletList items={plan.entryConditions} />
                    </div>
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Exit conditions</h4>
                    <div className="mt-2">
                      <BulletList items={plan.exitConditions} />
                    </div>
                  </div>
                </section>
                <section>
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Budget guidance</h4>
                  <p className="mt-1 text-sm text-neutral-300">
                    Max ~${plan.budgetGuidance.maxPerPositionUsd.toLocaleString()} per position ·{' '}
                    {plan.budgetGuidance.suggestedConcurrentPositions} concurrent ·{' '}
                    {plan.budgetGuidance.reserveCashPct}% cash reserve
                  </p>
                  <p className="mt-1 text-sm text-neutral-400">{plan.budgetGuidance.notes}</p>
                </section>
                <section>
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Candidate trades</h4>
                  <div className="mt-2 space-y-3">
                    {plan.candidateTrades.map((t) => (
                      <div
                        key={t.symbol}
                        className="rounded-md border border-neutral-800 bg-neutral-950/80 px-3 py-2 text-sm"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-neutral-100">{t.symbol}</span>
                          <Badge color={t.side === 'buy' ? 'green' : 'red'}>{t.side}</Badge>
                          <Badge>{t.status}</Badge>
                          <span className="text-xs text-neutral-500">
                            ~${t.suggestedNotionalUsd.toLocaleString()}
                          </span>
                        </div>
                        <p className="mt-1 text-neutral-400">{t.rationale}</p>
                      </div>
                    ))}
                  </div>
                </section>
                <section>
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">No-trade decision</h4>
                  <p className="mt-1 text-sm text-neutral-300">{plan.noTradeDecision.action}</p>
                  <div className="mt-2">
                    <BulletList items={plan.noTradeDecision.conditions} />
                  </div>
                </section>
              </div>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Execution ledger"
            subtitle={
              automationRunId
                ? `Automation run ${automationRunId}`
                : 'Run the pipeline to get an automation id'
            }
          />
          <div className="p-4 space-y-4">
            {!automationRunId && (
              <p className="text-sm text-neutral-500">
                Orders placed or canceled for an automated run appear here, keyed by automation run id.
              </p>
            )}
            {automationRunId && (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge color="blue">{automationRunId}</Badge>
                  {executionLedger && (
                    <span className="text-xs text-neutral-500">
                      {executionLedger.summary.placed} placed · {executionLedger.summary.canceled} canceled ·{' '}
                      {executionLedger.summary.failed} failed
                    </span>
                  )}
                </div>
                <label className="flex items-center gap-2 text-sm text-neutral-300">
                  <input
                    type="checkbox"
                    checked={paperLive}
                    onChange={(e) => setPaperLive(e.target.checked)}
                    className="rounded border-neutral-600 bg-neutral-950"
                  />
                  Submit to paper broker (real Alpaca orders — leave unchecked for simulated sandbox buys)
                </label>
                <button
                  type="button"
                  disabled={executeLoading || !capbacResult?.summary.approved}
                  onClick={() => handleExecuteApproved()}
                  className="inline-flex items-center gap-2 rounded-md bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-500 disabled:opacity-50"
                >
                  <Zap className="h-4 w-4" />
                  Execute CapBAC-approved trades
                </button>
                {!executionLedger?.orders.length ? (
                  <p className="text-sm text-neutral-500">No execution records yet for this run.</p>
                ) : (
                  <div className="divide-y divide-neutral-800 rounded-md border border-neutral-800">
                    {executionLedger.orders.map((row) => (
                      <div key={row.recordId} className="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium text-neutral-100">{row.symbol}</span>
                            <Badge color={row.side === 'buy' ? 'green' : 'red'}>{row.side}</Badge>
                            <Badge>{row.action}</Badge>
                            <Badge color={row.status === 'canceled' || row.status === 'failed' ? 'red' : 'green'}>
                              {row.status}
                            </Badge>
                            {row.qty != null && (
                              <span className="text-xs text-neutral-500">qty {row.qty}</span>
                            )}
                          </div>
                          <p className="mt-1 text-xs text-neutral-500">
                            {row.clientOrderId || row.proposalId}
                            {row.brokerOrderId ? ` · broker ${row.brokerOrderId}` : ''}
                          </p>
                          {row.reason && <p className="mt-1 text-xs text-neutral-400">{row.reason}</p>}
                        </div>
                        {row.action === 'place' &&
                          row.status !== 'canceled' &&
                          row.status !== 'failed' && (
                            <button
                              type="button"
                              onClick={() => handleCancelExecutionRecord(row.recordId)}
                              className="inline-flex items-center gap-1 text-xs text-red-400 hover:text-red-300"
                            >
                              <XCircle className="h-3.5 w-3.5" />
                              Cancel
                            </button>
                          )}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </Card>
        </div>
      </div>

      {capbacResult && (
        <Card>
          <CardHeader
            title="CapBAC Permission Engine"
            subtitle={`${capbacResult.summary.approved} approved · ${capbacResult.summary.denied} denied · policy ${capbacResult.policyId}`}
          />
          <div className="divide-y divide-neutral-800">
            {capbacResult.results.map((row) => (
              <div key={row.proposalId} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-neutral-100">{row.symbol}</span>
                    <Badge color={row.side === 'buy' ? 'green' : 'red'}>{row.side}</Badge>
                    <span className="text-xs text-neutral-500">${row.notionalUsd.toLocaleString()}</span>
                  </div>
                  <p className="mt-1 text-sm text-neutral-400">{row.reason}</p>
                  {row.violations.length > 0 && (
                    <ul className="mt-2 space-y-1 text-xs text-amber-300">
                      {row.violations.map((v) => (
                        <li key={v.code}>
                          [{v.code}] {v.message}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <Badge color={row.decision === 'APPROVED' ? 'green' : 'red'}>{row.decision}</Badge>
              </div>
            ))}
          </div>
        </Card>
      )}

      {intentResult && (
        <Card>
          <CardHeader
            title="Intent Engine — sanitized external content"
            subtitle={`${intentResult.summary.flagged} flagged · ${intentResult.summary.safeForPlanner} safe for planner context`}
          />
          <div className="divide-y divide-neutral-800">
            {intentResult.fetchNotice && (
              <p className="px-4 py-3 text-sm text-amber-300">{intentResult.fetchNotice}</p>
            )}
            {intentResult.items.map((item) => (
              <div key={`${item.itemId}-${item.symbol}`} className="space-y-2 px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  {item.symbol && <Badge>{item.symbol}</Badge>}
                  <Badge color={item.safeForPlanner ? 'green' : 'amber'}>
                    {item.safeForPlanner ? 'cleared' : 'review'}
                  </Badge>
                  {item.riskScore > 0 && <Badge color="red">risk {item.riskScore}</Badge>}
                  <span className="text-xs text-neutral-500">{item.source}</span>
                </div>
                <p className="text-sm font-medium text-neutral-200">{item.sanitized.title}</p>
                {item.sanitized.body && item.sanitized.body !== item.sanitized.title && (
                  <p className="line-clamp-3 text-sm text-neutral-400">{item.sanitized.body}</p>
                )}
                {item.warnings.length > 0 && (
                  <ul className="space-y-1 text-xs text-amber-300">
                    {item.warnings.map((w) => (
                      <li key={`${w.code}-${w.matchedExcerpt}`}>
                        [{w.severity}] {w.message} — “{w.matchedExcerpt}”
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
