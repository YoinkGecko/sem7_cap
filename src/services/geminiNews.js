const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash";
const USE_SEARCH = process.env.GEMINI_USE_SEARCH === "true";
const CACHE_TTL_MS =
  (Number.parseInt(process.env.GEMINI_NEWS_CACHE_MINUTES || "120", 10) || 120) *
  60 *
  1000;
const QUOTA_COOLDOWN_MS =
  (Number.parseInt(process.env.GEMINI_QUOTA_COOLDOWN_MINUTES || "180", 10) || 180) *
  60 *
  1000;

/** @type {Map<string, { expires: number, payload: unknown }>} */
const cache = new Map();
/** @type {Map<string, Promise<unknown>>} */
const inflight = new Map();

let quotaBlockedUntil = 0;

function buildPrompt(symbol) {
  const ticker = symbol.toUpperCase();
  return `List 5 recent news headlines about US stock ${ticker} (past 14 days).

Return ONLY JSON array:
[{"id":"1","headline":"...","summary":"1-2 sentences","source":"publisher","url":"","created_at":"ISO-8601"}]

Keep summaries factual and concise.`;
}

function extractText(data) {
  const parts = data?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return "";
  return parts.map((part) => part.text || "").join("").trim();
}

function parseNewsJson(text, ticker) {
  if (!text) return [];

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1]?.trim() || text.trim();
  const arrayMatch = candidate.match(/\[[\s\S]*\]/);
  if (!arrayMatch) return [];

  try {
    const parsed = JSON.parse(arrayMatch[0]);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => item && typeof item === "object")
      .map((item, index) => ({
        id: String(item.id || `${item.headline || "article"}-${index}`),
        headline: String(item.headline || item.title || "Untitled"),
        summary: item.summary ? String(item.summary) : undefined,
        source: item.source ? String(item.source) : "Gemini",
        url: item.url ? String(item.url) : undefined,
        created_at: item.created_at ? String(item.created_at) : undefined,
        symbols: [ticker],
      }));
  } catch {
    return [];
  }
}

async function callGemini(symbol) {
  const body = {
    contents: [{ parts: [{ text: buildPrompt(symbol) }] }],
  };

  if (USE_SEARCH) {
    body.tools = [{ google_search: {} }];
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const raw = await response.text();
  let data;

  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error("Gemini returned an invalid response.");
  }

  if (!response.ok) {
    const message =
      data?.error?.message ||
      raw ||
      `Gemini request failed with status ${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }

  return data;
}

export function isGeminiNewsConfigured() {
  return Boolean(GEMINI_API_KEY);
}

export function isQuotaError(error) {
  const message = (error?.message || "").toLowerCase();
  return (
    error?.status === 429 ||
    message.includes("quota") ||
    message.includes("rate limit") ||
    message.includes("resource exhausted")
  );
}

export function isGeminiTemporarilyDisabled() {
  return Date.now() < quotaBlockedUntil;
}

function markQuotaExceeded() {
  quotaBlockedUntil = Date.now() + QUOTA_COOLDOWN_MS;
}

function getCached(ticker, allowStale = false) {
  const entry = cache.get(ticker);
  if (!entry) return null;
  if (entry.expires > Date.now()) {
    return { ...entry.payload, cached: true };
  }
  if (allowStale) {
    return {
      ...entry.payload,
      cached: true,
      stale: true,
      notice: "Showing cached Gemini news while API quota recovers.",
    };
  }
  return null;
}

export async function fetchStockNewsFromGemini(symbol) {
  if (!GEMINI_API_KEY) {
    throw new Error(
      "GEMINI_API_KEY is not set. Add it to the server .env file (see .env.example)."
    );
  }

  const ticker = symbol.trim().toUpperCase();
  if (!ticker) {
    throw new Error("Symbol is required.");
  }

  if (isGeminiTemporarilyDisabled()) {
    const stale = getCached(ticker, true);
    if (stale) return stale;
    const error = new Error("Gemini quota cooldown active.");
    error.quota = true;
    throw error;
  }

  const fresh = getCached(ticker, false);
  if (fresh) return fresh;

  if (inflight.has(ticker)) {
    return inflight.get(ticker);
  }

  const request = (async () => {
    const data = await callGemini(ticker);
    const articles = parseNewsJson(extractText(data), ticker);

    const payload = {
      news: articles.slice(0, 8),
      source: "gemini",
      model: GEMINI_MODEL,
      symbol: ticker,
    };

    cache.set(ticker, { expires: Date.now() + CACHE_TTL_MS, payload });
    return payload;
  })();

  inflight.set(ticker, request);

  try {
    return await request;
  } catch (error) {
    if (isQuotaError(error)) {
      markQuotaExceeded();
      const stale = getCached(ticker, true);
      if (stale) return stale;
      error.quota = true;
    }
    throw error;
  } finally {
    inflight.delete(ticker);
  }
}
