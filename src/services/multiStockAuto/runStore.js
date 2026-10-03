import { randomUUID } from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, "../../../data/multi-stock-auto-runs.json");

/** @type {Map<string, object>} */
const runs = new Map();

function loadFromDisk() {
  try {
    if (!fs.existsSync(DATA_FILE)) return;
    const raw = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    for (const run of raw?.runs || []) {
      if (run?.runId) runs.set(run.runId, run);
    }
  } catch {
    /* ignore */
  }
}

export function persistRunsToDisk() {
  try {
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      DATA_FILE,
      JSON.stringify({ runs: Array.from(runs.values()) }, null, 2)
    );
  } catch (e) {
    console.error("multi-stock-auto persist failed:", e.message);
  }
}

loadFromDisk();

export function createRunRecord(input) {
  const runId = randomUUID();
  const run = {
    runId,
    status: "PENDING",
    createdAt: new Date().toISOString(),
    completedAt: null,
    config: input.config,
    symbols: input.symbols,
    legs: input.legs,
    summary: {
      legCount: input.symbols.length,
      startedCount: 0,
      failedCount: 0,
      runningCount: 0,
      totalEntryCostUsd: 0,
      aggregatePnLUsd: 0,
    },
  };
  runs.set(runId, run);
  persistRunsToDisk();
  return run;
}

export function getRun(runId) {
  return runs.get(runId) || null;
}

export function updateRun(runId, patch) {
  const run = runs.get(runId);
  if (!run) return null;
  Object.assign(run, patch);
  runs.set(runId, run);
  persistRunsToDisk();
  return run;
}

export function listRuns(limit = 50) {
  return Array.from(runs.values())
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .slice(0, limit);
}
