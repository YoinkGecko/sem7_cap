/** @see https://ai.google.dev/gemini-api/docs/models */
const PRIMARY_MODEL = "gemini-3.5-flash-lite";

const DEPRECATED_MODEL_ALIASES = {
  "gemini-2.5-flash-lite": PRIMARY_MODEL,
  "gemini-2.0-flash-lite": PRIMARY_MODEL,
  "gemini-2.5-flash": PRIMARY_MODEL,
  "gemini-2.0-flash": PRIMARY_MODEL,
};

export function normalizeGeminiModelName(name) {
  if (!name) return name;
  const trimmed = String(name).trim();
  return DEPRECATED_MODEL_ALIASES[trimmed] || trimmed;
}

export function getGeminiModelCandidates(preferredEnvKey) {
  const preferredRaw =
    (preferredEnvKey === "analysis"
      ? process.env.GEMINI_ANALYSIS_MODEL
      : null) ||
    (preferredEnvKey === "planner"
      ? process.env.GEMINI_PLANNER_MODEL
      : null) ||
    process.env.GEMINI_MODEL;

  const preferred = normalizeGeminiModelName(preferredRaw);

  const defaults = [PRIMARY_MODEL];

  const list = [preferred, ...defaults].filter(Boolean).map(normalizeGeminiModelName);
  return [...new Set(list)];
}

export function isModelAvailabilityError(message) {
  const text = (message || "").toLowerCase();
  return (
    text.includes("no longer available") ||
    text.includes("not found") ||
    text.includes("is not supported") ||
    text.includes("was not found") ||
    text.includes("timed out") ||
    text.includes("timeout") ||
    text.includes("abort") ||
    text.includes("high demand") ||
    text.includes("quota") ||
    text.includes("resource exhausted") ||
    text.includes("429") ||
    text.includes("503") ||
    text.includes("fetch failed") ||
    text.includes("network")
  );
}

export async function withGeminiModelFallback(candidates, invoke) {
  let lastError;

  for (const model of candidates) {
    const resolvedModel = normalizeGeminiModelName(model);
    try {
      return { result: await invoke(resolvedModel), model: resolvedModel };
    } catch (error) {
      lastError = error;
      if (!isModelAvailabilityError(error.message)) {
        throw error;
      }
    }
  }

  throw lastError || new Error("No Gemini model candidates succeeded.");
}
