import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

import { createPolicyRecord } from "../capbac/policyStore.js";
import { validateCapabilityPolicy } from "../capbac/validatePolicy.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "../../data");
const HISTORY_FILE = path.join(DATA_DIR, "automation-history.json");

const runs = new Map();
const journalByRun = new Map();
let loaded = false;

async function ensureLoaded() {
  if (loaded) return;
  loaded = true;
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const raw = await fs.readFile(HISTORY_FILE, "utf8");
    const data = JSON.parse(raw);
    if (data?.runs && typeof data.runs === "object") {
      for (const [id, run] of Object.entries(data.runs)) {
        runs.set(id, run);
        if (run?.capabilityPolicy && run?.policyId) {
          try {
            createPolicyRecord(
              validateCapabilityPolicy({
                ...run.capabilityPolicy,
                policyId: run.policyId,
              })
            );
          } catch {
            createPolicyRecord(run.capabilityPolicy);
          }
        }
      }
    }
    if (data?.journals && typeof data.journals === "object") {
      for (const [id, list] of Object.entries(data.journals)) {
        journalByRun.set(id, Array.isArray(list) ? list : []);
      }
    }
  } catch (error) {
    if (error?.code !== "ENOENT") {
      console.error("Failed to load automation history:", error.message);
    }
  }
}

async function persist() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const payload = {
    runs: Object.fromEntries(runs.entries()),
    journals: Object.fromEntries(journalByRun.entries()),
  };
  await fs.writeFile(HISTORY_FILE, JSON.stringify(payload, null, 2), "utf8");
}

function slimRecord(record) {
  if (!record?.broker) return record;
  const { broker, ...rest } = record;
  return {
    ...rest,
    brokerOrderId: rest.brokerOrderId || broker?.id || broker?.order_id,
    brokerStatus: broker?.status || broker?.order_status,
  };
}

export async function createAutomationRun(input) {
  await ensureLoaded();

  const automationRunId = input?.automationRunId || `auto-${Date.now()}`;
  const plan = input.plan || {};

  let capabilityPolicy = input.capabilityPolicy || null;
  if (capabilityPolicy) {
    capabilityPolicy = validateCapabilityPolicy({
      ...capabilityPolicy,
      policyId: input.policyId || capabilityPolicy.policyId,
    });
    createPolicyRecord(capabilityPolicy);
  }

  const run = {
    automationRunId,
    createdAt: new Date().toISOString(),
    status: "ready",
    policyId: capabilityPolicy?.policyId || input.policyId,
    capabilityPolicy,
    planId: plan.planId || null,
    strategySummary: plan.strategySummary || input.strategyName || "",
    userStrategy: plan.userStrategy || "",
    budget: plan.budget,
    symbols: plan.allowedSymbols || [],
    horizon: plan.horizon,
    plannerSource: input.plannerSource || null,
    plan,
    capbac: input.capbac,
    executionSummary: null,
    executedAt: null,
    sandbox: null,
  };

  runs.set(automationRunId, run);
  journalByRun.set(automationRunId, []);
  await persist();
  return run;
}

export async function getAutomationRun(automationRunId) {
  await ensureLoaded();
  return runs.get(automationRunId) || null;
}

export async function updateAutomationRun(automationRunId, patch, options = {}) {
  await ensureLoaded();
  const run = runs.get(automationRunId);
  if (!run) return null;
  const next = { ...run, ...patch };
  runs.set(automationRunId, next);
  if (options.deferPersist !== true) {
    await persist();
  }
  return next;
}

export async function listAutomationRuns() {
  await ensureLoaded();
  return Array.from(runs.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function appendExecutionRecord(automationRunId, record, options = {}) {
  await ensureLoaded();
  if (!journalByRun.has(automationRunId)) {
    journalByRun.set(automationRunId, []);
  }
  const slim = slimRecord(record);
  journalByRun.get(automationRunId).push(slim);
  if (options.deferPersist !== true) {
    await persist();
  }
  return slim;
}

export async function listExecutionRecords(automationRunId) {
  await ensureLoaded();
  const list = journalByRun.get(automationRunId) || [];
  return [...list].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

export async function getExecutionRecord(automationRunId, recordId) {
  await ensureLoaded();
  return (journalByRun.get(automationRunId) || []).find((r) => r.recordId === recordId) || null;
}

export async function patchExecutionRecord(automationRunId, recordId, patch, options = {}) {
  await ensureLoaded();
  const list = journalByRun.get(automationRunId) || [];
  const index = list.findIndex((r) => r.recordId === recordId);
  if (index === -1) return null;
  list[index] = slimRecord({
    ...list[index],
    ...patch,
    updatedAt: new Date().toISOString(),
  });
  journalByRun.set(automationRunId, list);
  if (options.deferPersist !== true) {
    await persist();
  }
  return list[index];
}

export async function flushAutomationPersistence() {
  await persist();
}

export async function getAutomationRunDetail(automationRunId) {
  const run = await getAutomationRun(automationRunId);
  if (!run) return null;
  const orders = await listExecutionRecords(automationRunId);
  return { run, orders };
}

export async function listAutomationHistorySummaries() {
  const all = await listAutomationRuns();
  return Promise.all(
    all.map(async (run) => {
      const orders = await listExecutionRecords(run.automationRunId);
      return {
        automationRunId: run.automationRunId,
        createdAt: run.createdAt,
        executedAt: run.executedAt,
        status: run.status,
        strategySummary: run.strategySummary,
        budget: run.budget,
        symbols: run.symbols,
        horizon: run.horizon,
        plannerSource: run.plannerSource,
        capbac: {
          approved: run.capbac?.summary?.approved ?? 0,
          denied: run.capbac?.summary?.denied ?? 0,
        },
        execution: run.executionSummary,
        sandbox: run.sandbox,
        orders: {
          total: orders.length,
          placed: orders.filter((o) => o.action === "place").length,
          canceled: orders.filter((o) => o.status === "canceled" || o.action === "cancel").length,
        },
      };
    })
  );
}
