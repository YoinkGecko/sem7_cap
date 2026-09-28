import { getGeminiModelCandidates, withGeminiModelFallback } from "../../config/gemini.js";
import { fetchWithTimeout } from "../../utils/fetchWithTimeout.js";
import { buildFallbackTradingPlan } from "./fallbackPlan.js";
import { anchorPlan, validatePlannerInput } from "./validateInput.js";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const PLANNER_PROVIDER = (process.env.PLANNER_PROVIDER || "auto").toLowerCase();
const PLANNER_GEMINI_TIMEOUT_MS = Number(process.env.PLANNER_GEMINI_TIMEOUT_MS) || 12000;
const PLANNER_GEMINI_MAX_MODELS = Number(process.env.PLANNER_GEMINI_MAX_MODELS) || 2;

const PLAN_JSON_SHAPE = `{
  "strategySummary": "string",
  "monitoring": ["string"],
  "entryConditions": ["string"],
  "exitConditions": ["string"],
  "budgetGuidance": {
    "totalBudget": number,
    "maxPerPositionUsd": number,
    "suggestedConcurrentPositions": number,
    "reserveCashPct": number,
    "notes": "string"
  },
  "candidateTrades": [
    {
      "symbol": "TICKER",
      "side": "buy|sell",
      "status": "conditional|watchlist",
      "rationale": "string",
      "suggestedNotionalUsd": number,
      "entryTriggers": ["string"],
      "exitTriggers": ["string"]
    }
  ],
  "noTradeDecision": {
    "shouldTrade": boolean,
    "conditions": ["string"],
    "action": "string"
  },
  "riskNotes": ["string"],
  "assumptions": ["string"]
}`;

function parseJsonObject(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1]?.trim() || text.trim();
  const match = candidate.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

function extractText(data) {
  const parts = data?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return "";
  return parts.map((p) => p.text || "").join("").trim();
}

async function callGemini(prompt, model) {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`;

  const response = await fetchWithTimeout(
    endpoint,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    },
    PLANNER_GEMINI_TIMEOUT_MS
  );

  const raw = await response.text();
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error("Invalid Gemini response.");
  }
  if (!response.ok) {
    throw new Error(data?.error?.message || `Gemini failed (${response.status})`);
  }
  return extractText(data);
}

function normalizePlan(parsed, input) {
  const fallback = buildFallbackTradingPlan(input);

  const candidateTrades = Array.isArray(parsed?.candidateTrades)
    ? parsed.candidateTrades
        .filter((t) => t && input.symbols.includes(String(t.symbol || "").toUpperCase()))
        .map((t) => ({
          symbol: String(t.symbol).toUpperCase(),
          side: t.side === "sell" ? "sell" : "buy",
          status: t.status === "watchlist" ? "watchlist" : "conditional",
          rationale: String(t.rationale || "Conditional opportunity."),
          suggestedNotionalUsd: clampNotional(Number(t.suggestedNotionalUsd), input.budget),
          entryTriggers: stringArray(t.entryTriggers, ["Strategy-aligned entry signal"]),
          exitTriggers: stringArray(t.exitTriggers, ["Stop-loss or horizon exit"]),
        }))
    : fallback.candidateTrades;

  const plan = {
    planId: `plan-${Date.now()}`,
    generatedAt: new Date().toISOString(),
    userStrategy: input.strategy,
    strategySummary: String(parsed?.strategySummary || fallback.strategySummary),
    budget: input.budget,
    currency: "USD",
    allowedSymbols: input.symbols,
    horizon: input.horizon,
    monitoring: stringArray(parsed?.monitoring, fallback.monitoring),
    entryConditions: stringArray(parsed?.entryConditions, fallback.entryConditions),
    exitConditions: stringArray(parsed?.exitConditions, fallback.exitConditions),
    budgetGuidance: {
      totalBudget: input.budget,
      maxPerPositionUsd: clampNotional(
        Number(parsed?.budgetGuidance?.maxPerPositionUsd),
        input.budget
      ) || fallback.budgetGuidance.maxPerPositionUsd,
      suggestedConcurrentPositions:
        Number(parsed?.budgetGuidance?.suggestedConcurrentPositions) ||
        fallback.budgetGuidance.suggestedConcurrentPositions,
      reserveCashPct:
        Number(parsed?.budgetGuidance?.reserveCashPct) || fallback.budgetGuidance.reserveCashPct,
      notes: String(parsed?.budgetGuidance?.notes || fallback.budgetGuidance.notes),
    },
    candidateTrades: candidateTrades.length ? candidateTrades : fallback.candidateTrades,
    noTradeDecision: {
      shouldTrade: Boolean(parsed?.noTradeDecision?.shouldTrade),
      conditions: stringArray(
        parsed?.noTradeDecision?.conditions,
        fallback.noTradeDecision.conditions
      ),
      action: String(parsed?.noTradeDecision?.action || fallback.noTradeDecision.action),
    },
    riskNotes: stringArray(parsed?.riskNotes, fallback.riskNotes),
    assumptions: stringArray(parsed?.assumptions, fallback.assumptions),
  };

  return anchorPlan(plan, input);
}

function stringArray(value, fallback) {
  if (!Array.isArray(value)) return fallback;
  const items = value.filter((v) => typeof v === "string" && v.trim()).map((v) => v.trim());
  return items.length ? items : fallback;
}

function clampNotional(value, budget) {
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.min(Math.round(value * 100) / 100, budget);
}

function buildPrompt(input) {
  return `You are the Planner Agent for a paper-trading platform.

Your job: convert the user's instructions into a structured trading PLAN.
You do NOT execute trades. You define how an execution agent should behave.

Hard constraints (must respect exactly):
- Allowed symbols ONLY: ${input.symbols.join(", ")}
- Budget USD: ${input.budget}
- Horizon: ${input.horizon}
- User strategy text: """${input.strategy}"""

Return ONLY valid JSON matching this schema:
${PLAN_JSON_SHAPE}

Requirements:
- Tailor monitoring, entry/exit rules, and candidate trades to the user's strategy wording.
- Include at least one candidate trade per allowed symbol OR explain via noTradeDecision.
- Include explicit no-trade conditions when opportunity quality is insufficient.
- Budget guidance must respect total budget ${input.budget}.
- Do not invent symbols outside the allowed list.
- No personalized investment advice; educational paper-trading tone.`;
}

export async function createTradingPlan(rawInput) {
  const input = validatePlannerInput(rawInput);

  const useGemini =
    PLANNER_PROVIDER !== "fallback" && Boolean(GEMINI_API_KEY) && PLANNER_PROVIDER !== "off";

  if (!useGemini) {
    return {
      plan: anchorPlan(buildFallbackTradingPlan(input), input),
      source: "fallback",
      model: null,
      plannerError: GEMINI_API_KEY
        ? "Planner using rule-based fallback (PLANNER_PROVIDER=fallback)."
        : "GEMINI_API_KEY not set; using rule-based planner.",
    };
  }

  try {
    const candidates = getGeminiModelCandidates("planner").slice(
      0,
      Math.max(1, PLANNER_GEMINI_MAX_MODELS)
    );

    const { result: text, model } = await withGeminiModelFallback(candidates, (candidateModel) =>
      callGemini(buildPrompt(input), candidateModel)
    );

    const parsed = parseJsonObject(text);
    if (!parsed) {
      throw new Error("Planner returned malformed JSON.");
    }

    return {
      plan: normalizePlan(parsed, input),
      source: "gemini",
      model,
      plannerError: null,
    };
  } catch (error) {
    return {
      plan: anchorPlan(buildFallbackTradingPlan(input), input),
      source: "fallback",
      model: null,
      plannerError: error.message,
    };
  }
}
