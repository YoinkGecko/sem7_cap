import { getGeminiModelCandidates, withGeminiModelFallback } from "../../config/gemini.js";
import { fetchWithTimeout } from "../../utils/fetchWithTimeout.js";
import { buildStockAnalysis } from "../analysis/engine.js";
import { fetchStockNews } from "../stockNews.js";
import { fetchSnapshotPrice } from "../execution/brokerGateway.js";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const ADVISOR_TIMEOUT_MS = Number(process.env.STOCK_AUTO_ADVISOR_TIMEOUT_MS) || 20000;

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

function summarizeNews(articles) {
  const list = (articles || []).slice(0, 8).map((a) => ({
    headline: a.headline || a.title || "",
    summary: (a.summary || a.description || "").slice(0, 280),
    publishedAt: a.created_at || a.published_at || a.updated_at,
    source: a.source || a.author,
  }));
  return list.filter((a) => a.headline);
}

const TECH_OBS_LABELS = {
  priceVsSma20: "Price vs SMA20",
  priceVsSma50: "Price vs SMA50",
  priceVsSma200: "Price vs SMA200",
  sma50VsSma200: "SMA50 vs SMA200",
  currentDrawdownPct: "Current drawdown",
  currentDrawdown: "Current drawdown",
};

function formatTechnicalObservations(observations, limit = 6) {
  if (!observations) return [];
  if (Array.isArray(observations)) {
    return observations.slice(0, limit).map(String);
  }
  if (typeof observations !== "object") return [];

  return Object.entries(observations)
    .filter(([, v]) => v != null && Number.isFinite(Number(v)))
    .slice(0, limit)
    .map(([key, raw]) => {
      const label = TECH_OBS_LABELS[key] || key;
      const n = Number(raw);
      if (key === "currentDrawdownPct") {
        return `${label}: ${n.toFixed(1)}%`;
      }
      if (key === "currentDrawdown") {
        return `${label}: ${(n * 100).toFixed(1)}%`;
      }
      if (key.includes("Vs") || key.includes("vs")) {
        return `${label}: ${(n * 100).toFixed(1)}%`;
      }
      return `${label}: ${n.toFixed(2)}`;
    });
}

function buildBehaviorSummary(analysis) {
  if (!analysis) {
    return {
      period: "3M",
      available: false,
      summary: "Historical analysis unavailable for this symbol.",
    };
  }

  const pp = analysis.pricePerformance || {};
  const risk = analysis.risk || {};
  const technicalObservations = formatTechnicalObservations(
    analysis.technical?.observations,
    5
  );

  return {
    period: analysis.period || "3M",
    available: true,
    startingPrice: pp.startingPrice,
    endingPrice: pp.endingPrice,
    percentageChange: pp.percentageChange,
    maximumDrawdownPct: risk.maximumDrawdownPct,
    annualizedVolatilityPct: risk.annualizedVolatilityPct,
    sharpeRatio: risk.sharpeRatio,
    technicalObservations,
    summary: [
      pp.percentageChange != null
        ? `Price ${pp.percentageChange >= 0 ? "up" : "down"} ${Math.abs(pp.percentageChange).toFixed(1)}% over ${analysis.period}.`
        : null,
      risk.maximumDrawdownPct != null
        ? `Max drawdown ${risk.maximumDrawdownPct.toFixed(1)}%.`
        : null,
      risk.annualizedVolatilityPct != null
        ? `Volatility ~${risk.annualizedVolatilityPct.toFixed(1)}% annualized.`
        : null,
    ]
      .filter(Boolean)
      .join(" "),
  };
}

function ruleBasedAdvice({ analysis, headlines, budgetUsd, maxQty }) {
  let allocationPct = 0.7;

  const chg = analysis?.pricePerformance?.percentageChange;
  const dd = analysis?.risk?.maximumDrawdownPct;
  const vol = analysis?.risk?.annualizedVolatilityPct;

  if (chg != null) {
    if (chg < -8) allocationPct -= 0.2;
    else if (chg < 0) allocationPct -= 0.1;
    else if (chg > 8) allocationPct += 0.1;
  }
  if (dd != null && dd < -12) allocationPct -= 0.15;
  if (vol != null && vol > 45) allocationPct -= 0.1;

  const blob = headlines.map((h) => `${h.headline} ${h.summary}`).join(" ").toLowerCase();
  if (/lawsuit|investigation|sec probe|downgrade|miss estimates|layoff|recall/.test(blob)) {
    allocationPct -= 0.15;
  }
  if (/beat estimates|upgrade|raises guidance|record revenue|partnership/.test(blob)) {
    allocationPct += 0.1;
  }

  allocationPct = Math.max(0.2, Math.min(1, allocationPct));
  const suggestedQty = Math.max(1, Math.floor(maxQty * allocationPct));

  const reason = `Rule-based sizing: deploy ~${Math.round(allocationPct * 100)}% of budget (${suggestedQty} of max ${maxQty} shares) after weighing recent price behavior and news tone.`;

  return {
    allocationPct,
    suggestedQty,
    confidence: "medium",
    reason,
    newsSummary: headlines.length
      ? `${headlines.length} recent headlines reviewed; tone mixed into sizing.`
      : "No recent headlines available; sizing uses price history only.",
    behaviorSummary: buildBehaviorSummary(analysis).summary,
    detailedReason: reason,
    source: "rules",
  };
}

async function geminiAdvice(context) {
  if (!GEMINI_API_KEY) return null;

  const prompt = `You are a paper-trading sizing advisor. Given budget and research, recommend share count for ONE initial buy (not recurring).

Return ONLY JSON:
{
  "allocationPct": number between 0.2 and 1,
  "confidence": "low"|"medium"|"high",
  "reason": "2-4 sentences for the trader",
  "newsSummary": "1-2 sentences",
  "behaviorSummary": "1-2 sentences on past price behavior",
  "riskFlags": ["string"]
}

Context:
${JSON.stringify(context, null, 2)}

Rules:
- allocationPct 1.0 = use full budget (max shares)
- Lower allocation if news risk or poor recent behavior
- Never recommend below 0.2 unless max shares is 1
- Be specific about why`;

  const candidates = getGeminiModelCandidates("planner").slice(0, 2);

  const { result } = await withGeminiModelFallback(candidates, async (modelName) => {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelName)}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`;
    const response = await fetchWithTimeout(
      endpoint,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      },
      ADVISOR_TIMEOUT_MS
    );
    const raw = await response.text();
    const data = JSON.parse(raw);
    if (!response.ok) {
      throw new Error(data?.error?.message || "Gemini advisor failed.");
    }
    const parsed = parseJsonObject(extractText(data));
    if (!parsed?.allocationPct) throw new Error("Advisor returned invalid JSON.");
    return { parsed, model: modelName };
  });

  return { ...result.parsed, source: "gemini", model: result.model };
}

export async function buildAutoTradeAdvice(input) {
  const symbol = String(input.symbol || "").trim().toUpperCase();
  const budgetUsd = Number(input.budgetUsd);
  const maxLossUsd = Number(input.maxLossUsd);
  const profitMinUsd = Number(input.profitMinUsd);

  if (!symbol) {
    const err = new Error("symbol is required.");
    err.status = 400;
    throw err;
  }
  if (!Number.isFinite(budgetUsd) || budgetUsd <= 0) {
    const err = new Error("budgetUsd must be positive.");
    err.status = 400;
    throw err;
  }

  const { price } = await fetchSnapshotPrice(symbol);
  const maxQty = Math.floor(budgetUsd / price);
  if (maxQty < 1) {
    const err = new Error(
      `Budget $${budgetUsd} cannot buy 1 share at $${price.toFixed(2)}.`
    );
    err.status = 400;
    throw err;
  }

  const [newsPayload, analysis] = await Promise.all([
    fetchStockNews(symbol).catch(() => ({ articles: [] })),
    buildStockAnalysis(symbol, "3M").catch(() => null),
  ]);

  const headlines = summarizeNews(newsPayload?.articles);
  const behavior = buildBehaviorSummary(analysis);

  const context = {
    symbol,
    budgetUsd,
    maxLossUsd,
    profitMinUsd,
    currentPrice: price,
    maxQty,
    maxNotionalUsd: maxQty * price,
    headlines,
    behavior,
  };

  let decision = ruleBasedAdvice({
    analysis,
    headlines,
    budgetUsd,
    maxQty,
  });

  try {
    const ai = await geminiAdvice(context);
    if (ai) {
      const pct = Math.max(0.2, Math.min(1, Number(ai.allocationPct)));
      decision = {
        allocationPct: pct,
        suggestedQty: Math.max(1, Math.min(maxQty, Math.floor(maxQty * pct))),
        confidence: ai.confidence || "medium",
        reason: ai.reason || decision.reason,
        newsSummary: ai.newsSummary || decision.newsSummary,
        behaviorSummary: ai.behaviorSummary || behavior.summary,
        riskFlags: Array.isArray(ai.riskFlags) ? ai.riskFlags : [],
        source: ai.source,
        model: ai.model,
      };
    }
  } catch {
    /* keep rule-based decision */
  }

  const suggestedQty = decision.suggestedQty;
  const suggestedNotionalUsd = suggestedQty * price;

  return {
    symbol,
    generatedAt: new Date().toISOString(),
    currentPrice: price,
    budgetUsd,
    maxLossUsd,
    profitMinUsd,
    maxQty,
    maxNotionalUsd: maxQty * price,
    suggestedQty,
    suggestedNotionalUsd,
    allocationPct: decision.allocationPct,
    confidence: decision.confidence,
    reason: decision.reason,
    source: decision.source,
    model: decision.model,
    news: {
      notice: newsPayload?.notice,
      headlines,
      summary: decision.newsSummary,
    },
    behavior,
    riskFlags: decision.riskFlags || [],
    analysisDetail: analysis
      ? {
          period: analysis.period,
          pricePerformance: analysis.pricePerformance,
          returns: {
            annualizedReturnPct: analysis.returns?.annualizedReturnPct,
            averageDailyReturnPct: analysis.returns?.averageDailyReturnPct,
          },
          risk: {
            maximumDrawdownPct: analysis.risk?.maximumDrawdownPct,
            annualizedVolatilityPct: analysis.risk?.annualizedVolatilityPct,
            sharpeRatio: analysis.risk?.sharpeRatio,
          },
          technicalObservations: formatTechnicalObservations(
            analysis.technical?.observations,
            6
          ),
        }
      : null,
  };
}
