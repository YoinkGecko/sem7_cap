import { useState } from 'react';
import { Bot, Shield, Sparkles } from 'lucide-react';
import { Card, CardHeader, Badge, LoadingState, Spinner } from '@/components/common/UI';
import { useToast } from '@/components/common/Toast';
import { createTradingPlan, ingestIntentNews } from '@/services/api';
import type { PlannerResponse, TradingHorizon } from '@/types/planner';
import type { IntentBatchResponse, PipelineStatus } from '@/types/intent';

const DEFAULT_STRATEGY =
  'Find short-term opportunities based on momentum and important news. Prefer liquid names with clear trend confirmation.';

const ENGINE_META = {
  idle: { label: 'Ready', icon: Bot, accent: 'text-neutral-400' },
  planner: { label: 'Planner Agent', icon: Sparkles, accent: 'text-sky-400' },
  intent: { label: 'Intent Engine', icon: Shield, accent: 'text-emerald-400' },
} as const;

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
  const [loading, setLoading] = useState(false);
  const [pipeline, setPipeline] = useState<PipelineStatus>({
    engine: 'idle',
    step: 'Configure inputs and run the pipeline (Planner → Intent Engine).',
  });
  const [result, setResult] = useState<PlannerResponse | null>(null);
  const [intentResult, setIntentResult] = useState<IntentBatchResponse | null>(null);
  const [showJson, setShowJson] = useState(false);

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
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

    try {
      setPipeline({ engine: 'planner', step: 'Validating strategy, budget, symbols, and horizon…' });
      await new Promise((r) => setTimeout(r, 0));

      setPipeline({ engine: 'planner', step: 'Generating structured trading plan (no orders placed)…' });
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

      setPipeline({
        engine: 'intent',
        step: `Sanitized ${intent.summary.total} articles · ${intent.summary.flagged} flagged · ${intent.summary.safeForPlanner} cleared for planner context.`,
      });
      notify('success', 'Planner and Intent Engine finished.');
    } catch (err) {
      setPipeline({ engine: 'idle', step: 'Pipeline stopped due to an error.' });
      notify('error', err instanceof Error ? err.message : 'Pipeline failed.');
    } finally {
      setLoading(false);
    }
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
            Planner builds the strategy. Intent Engine scans external news for injection attempts and returns
            sanitized content before it feeds downstream agents. Neither engine executes trades.
          </p>
        </div>
      </div>

      <PipelineBanner status={pipeline} running={loading} />

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
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50"
            >
              <Sparkles className="h-4 w-4" />
              {loading ? 'Running pipeline…' : 'Run Planner + Intent Engine'}
            </button>
          </form>
        </Card>

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
            {loading && pipeline.engine === 'planner' && (
              <LoadingState text="Planner is building your strategy…" />
            )}
            {loading && pipeline.engine === 'intent' && (
              <LoadingState text="Intent Engine is scanning external content…" />
            )}
            {!loading && !plan && (
              <p className="text-sm text-neutral-500">
                Your structured plan will appear here: monitoring, entries, exits, budget rules, and candidate trades.
              </p>
            )}
            {!loading && plan && showJson && (
              <pre className="max-h-[520px] overflow-auto rounded-md bg-neutral-950 p-3 text-xs text-neutral-300">
                {JSON.stringify({ planner: result, intent: intentResult }, null, 2)}
              </pre>
            )}
            {!loading && plan && !showJson && (
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
      </div>

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
