const journalByRun = new Map();

function runJournal(automationRunId) {
  if (!journalByRun.has(automationRunId)) {
    journalByRun.set(automationRunId, []);
  }
  return journalByRun.get(automationRunId);
}

export function appendExecutionRecord(automationRunId, record) {
  const list = runJournal(automationRunId);
  list.push(record);
  return record;
}

export function listExecutionRecords(automationRunId) {
  return [...runJournal(automationRunId)].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

export function getExecutionRecord(automationRunId, recordId) {
  return runJournal(automationRunId).find((r) => r.recordId === recordId) || null;
}

export function patchExecutionRecord(automationRunId, recordId, patch) {
  const list = runJournal(automationRunId);
  const index = list.findIndex((r) => r.recordId === recordId);
  if (index === -1) return null;
  list[index] = { ...list[index], ...patch, updatedAt: new Date().toISOString() };
  return list[index];
}
