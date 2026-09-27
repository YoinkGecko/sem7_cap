export function getGeminiModelCandidates(preferredEnvKey) {
  const preferred =
    (preferredEnvKey === "analysis"
      ? process.env.GEMINI_ANALYSIS_MODEL
      : null) ||
    (preferredEnvKey === "planner"
      ? process.env.GEMINI_PLANNER_MODEL
      : null) ||
    process.env.GEMINI_MODEL;

  const defaults = ["gemini-3.5-flash-lite", "gemini-2.5-flash-lite", "gemini-2.0-flash-lite"];

  const list = [preferred, ...defaults].filter(Boolean);
  return [...new Set(list)];
}

export function isModelAvailabilityError(message) {
  const text = (message || "").toLowerCase();
  return (
    text.includes("no longer available") ||
    text.includes("not found") ||
    text.includes("is not supported") ||
    text.includes("was not found")
  );
}

export async function withGeminiModelFallback(candidates, invoke) {
  let lastError;

  for (const model of candidates) {
    try {
      return { result: await invoke(model), model };
    } catch (error) {
      lastError = error;
      if (!isModelAvailabilityError(error.message)) {
        throw error;
      }
    }
  }

  throw lastError || new Error("No Gemini model candidates succeeded.");
}
