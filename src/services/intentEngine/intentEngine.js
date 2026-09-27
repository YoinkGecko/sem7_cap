import { findInjectionMatches } from "./injectionPatterns.js";

const REDACTED = "[redacted-untrusted-instruction]";

const ZERO_WIDTH = /[\u200B-\u200D\uFEFF]/g;
const CONTROL_CHARS = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;

const FINANCIAL_HINTS =
  /\b(revenue|earnings|eps|guidance|sec|filing|10-k|10-q|8-k|dividend|merger|acquisition|stock|shares|market|fed|inflation|guidance|outlook|forecast|analyst|upgrade|downgrade)\b/i;

export function normalizeUntrustedText(text) {
  if (typeof text !== "string") return "";
  return text
    .replace(ZERO_WIDTH, "")
    .replace(CONTROL_CHARS, "")
    .replace(/\r\n/g, "\n")
    .trim();
}

export function redactInjectionSpans(text, matches) {
  if (!matches.length) return text;

  let output = text;
  for (const match of [...matches].sort((a, b) => b.start - a.start)) {
    output = output.slice(0, match.start) + REDACTED + output.slice(match.end);
  }
  return output.replace(new RegExp(`(${REDACTED}\\s*){2,}`, "g"), `${REDACTED} `).trim();
}

export function processExternalContent(input) {
  const title = normalizeUntrustedText(input?.title || "");
  const body = normalizeUntrustedText(input?.body || input?.text || "");
  const combined = [title, body].filter(Boolean).join("\n\n");

  const titleMatches = findInjectionMatches(title);
  const bodyMatches = findInjectionMatches(body);
  const combinedMatches = findInjectionMatches(combined);

  const sanitizedTitle = redactInjectionSpans(title, titleMatches);
  const sanitizedBody = redactInjectionSpans(body, bodyMatches);

  const warnings = combinedMatches.map((m) => ({
    code: m.code,
    severity: m.severity,
    message: m.message,
    matchedExcerpt: m.matchedExcerpt,
  }));

  const highCount = warnings.filter((w) => w.severity === "high").length;
  const mediumCount = warnings.filter((w) => w.severity === "medium").length;
  const riskScore = Math.min(100, highCount * 35 + mediumCount * 15);

  const hasFinancialSignal = FINANCIAL_HINTS.test(combined);
  const classification =
    warnings.length === 0
      ? "financial_content"
      : hasFinancialSignal && highCount === 0
        ? "mixed_financial_with_low_risk_phrasing"
        : hasFinancialSignal
          ? "mixed_financial_with_injection"
          : "suspicious_non_financial";

  const safeForPlanner = highCount === 0 && riskScore < 40;

  return {
    itemId: input?.id || input?.itemId || null,
    contentType: input?.contentType || "unknown",
    source: input?.source || null,
    symbol: input?.symbol || null,
    url: input?.url || null,
    original: {
      title,
      body,
      length: combined.length,
    },
    sanitized: {
      title: sanitizedTitle,
      body: sanitizedBody,
      length: sanitizedTitle.length + sanitizedBody.length,
    },
    warnings,
    riskScore,
    classification,
    safeForPlanner,
    processedAt: new Date().toISOString(),
  };
}

export function processContentBatch(items) {
  const list = Array.isArray(items) ? items : [];
  const processed = list.map((item) => processExternalContent(item));

  const flagged = processed.filter((p) => p.warnings.length > 0).length;
  const highRisk = processed.filter((p) => p.riskScore >= 35).length;

  return {
    engine: "intent",
    processedAt: new Date().toISOString(),
    items: processed,
    summary: {
      total: processed.length,
      flagged,
      highRisk,
      safeForPlanner: processed.filter((p) => p.safeForPlanner).length,
    },
  };
}
