const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

function resolveGeminiModel() {
  return (
    process.env.GEMINI_ANALYSIS_MODEL ||
    process.env.GEMINI_MODEL ||
    "gemini-3.5-flash-lite"
  );
}

function extractText(data) {
  const parts = data?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return "";
  return parts.map((part) => part.text || "").join("").trim();
}

function parseReportJson(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1]?.trim() || text.trim();
  const objectMatch = candidate.match(/\{[\s\S]*\}/);
  if (!objectMatch) return null;

  try {
    const parsed = JSON.parse(objectMatch[0]);
    return {
      summary: stringOrEmpty(parsed.summary),
      priceAnalysis: stringOrEmpty(parsed.priceAnalysis),
      returnAnalysis: stringOrEmpty(parsed.returnAnalysis),
      riskAnalysis: stringOrEmpty(parsed.riskAnalysis),
      technicalAnalysis: stringOrEmpty(parsed.technicalAnalysis),
      volumeAnalysis: stringOrEmpty(parsed.volumeAnalysis),
      keyObservations: arrayOfStrings(parsed.keyObservations),
      limitations: arrayOfStrings(parsed.limitations),
    };
  } catch {
    return null;
  }
}

function stringOrEmpty(value) {
  return typeof value === "string" ? value : "";
}

function arrayOfStrings(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => typeof item === "string" && item.trim()).map((item) => item.trim());
}

export async function generateAnalysisReport(geminiInput) {
  if (!GEMINI_API_KEY) {
    return {
      aiReport: null,
      aiError: "AI report unavailable: GEMINI_API_KEY is not configured on the server.",
    };
  }

  const prompt = `You are generating a financial research report based ONLY on the supplied historical calculations.

Rules:
- Do not invent numbers.
- Do not create statistics that are not present in the supplied data.
- Do not predict future prices.
- Do not provide personalized investment advice.
- Distinguish historical facts, mathematical observations, and interpretation.
- Explain WHY the metrics matter, not just repeat them.

Return ONLY valid JSON with this shape:
{
  "summary": "...",
  "priceAnalysis": "...",
  "returnAnalysis": "...",
  "riskAnalysis": "...",
  "technicalAnalysis": "...",
  "volumeAnalysis": "...",
  "keyObservations": ["...", "..."],
  "limitations": ["...", "..."]
}

Supplied analysis data:
${JSON.stringify(geminiInput)}`;

  try {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(resolveGeminiModel())}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    });

    const raw = await response.text();
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      return { aiReport: null, aiError: "AI report temporarily unavailable: invalid Gemini response." };
    }

    if (!response.ok) {
      const message = data?.error?.message || `Gemini request failed with status ${response.status}`;
      return { aiReport: null, aiError: `AI report temporarily unavailable: ${message}` };
    }

    const parsed = parseReportJson(extractText(data));
    if (!parsed || !parsed.summary) {
      return { aiReport: null, aiError: "AI report temporarily unavailable: malformed Gemini JSON." };
    }

    return { aiReport: parsed, aiError: null };
  } catch (error) {
    return {
      aiReport: null,
      aiError: `AI report temporarily unavailable: ${error.message}`,
    };
  }
}
