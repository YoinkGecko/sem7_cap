const runs = new Map();

export function createAutomationRun(input) {
  const automationRunId = input?.automationRunId || `auto-${Date.now()}`;

  const run = {
    automationRunId,
    createdAt: new Date().toISOString(),
    status: "ready",
    policyId: input.policyId,
    planId: input.plan?.planId || null,
    plan: input.plan,
    capbac: input.capbac,
    executionSummary: null,
  };

  runs.set(automationRunId, run);
  return run;
}

export function getAutomationRun(automationRunId) {
  return runs.get(automationRunId) || null;
}

export function updateAutomationRun(automationRunId, patch) {
  const run = getAutomationRun(automationRunId);
  if (!run) return null;
  const next = { ...run, ...patch };
  runs.set(automationRunId, next);
  return next;
}

export function listAutomationRuns() {
  return Array.from(runs.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
