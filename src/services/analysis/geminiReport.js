import {
  getGeminiModelCandidates,
  withGeminiModelFallback,
} from "../../config/gemini.js";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const PASS_DELAY_MS = Number.parseInt(process.env.GEMINI_ANALYSIS_PASS_DELAY_MS || "800", 10) || 800;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractText(data) {
  const parts = data?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return "";
  return parts.map((part) => part.text || "").join("").trim();
}

function parseJsonObject(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1]?.trim() || text.trim();
  const objectMatch = candidate.match(/\{[\s\S]*\}/);
  if (!objectMatch) return null;
  try {
    return JSON.parse(objectMatch[0]);
  } catch {
    return null;
  }
}

function stringOrEmpty(value) {
  return typeof value === "string" ? value.trim() : "";
}

function arrayOfStrings(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => typeof item === "string" && item.trim()).map((item) => item.trim());
}

const BASE_RULES = `Rules:
- Use ONLY numbers and facts from the supplied JSON data.
- Do not invent statistics, prices, dates, or events.
- Do not predict future prices or give personalized investment advice.
- Explain why the metrics matter; connect price, risk, and technical readings.
- Write in clear professional equity-research prose.`;

function compactInput(geminiInput) {
  return JSON.stringify(geminiInput);
}

async function callGemini(prompt, model) {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`;

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
    throw new Error("Invalid Gemini response.");
  }

  if (!response.ok) {
    throw new Error(data?.error?.message || `Gemini failed (${response.status})`);
  }

  return extractText(data);
}

async function runPass(title, prompt, geminiInput, model) {
  const fullPrompt = `${BASE_RULES}

Task: ${title}
Target length: about 350–500 words for text fields in this pass (deep, paragraph-style analysis).

Return ONLY valid JSON (no markdown outside JSON).

${prompt}

Data:
${compactInput(geminiInput)}`;

  const text = await callGemini(fullPrompt, model);
  const parsed = parseJsonObject(text);
  if (!parsed) {
    throw new Error(`Could not parse JSON for pass: ${title}`);
  }
  return parsed;
}

function sliceInput(geminiInput, keys) {
  const out = { symbol: geminiInput.symbol, period: geminiInput.period };
  for (const key of keys) {
    if (geminiInput[key] !== undefined) out[key] = geminiInput[key];
  }
  return out;
}

function countWords(report) {
  const text = Object.values(report)
    .flatMap((value) => (Array.isArray(value) ? value : [value]))
    .filter((value) => typeof value === "string")
    .join(" ");
  return text.split(/\s+/).filter(Boolean).length;
}

function mergeReportParts(parts) {
  const merged = {
    summary: "",
    investmentThesis: "",
    priceAnalysis: "",
    priceDrivers: "",
    returnAnalysis: "",
    riskAnalysis: "",
    drawdownAnalysis: "",
    technicalAnalysis: "",
    momentumSignals: "",
    volumeAnalysis: "",
    benchmarkContext: "",
    conclusion: "",
    keyObservations: [],
    limitations: [],
  };

  for (const part of parts) {
    merged.summary = merged.summary || stringOrEmpty(part.summary);
    merged.investmentThesis = merged.investmentThesis || stringOrEmpty(part.investmentThesis);
    merged.priceAnalysis = [merged.priceAnalysis, stringOrEmpty(part.priceAnalysis), stringOrEmpty(part.priceTrend)]
      .filter(Boolean)
      .join("\n\n");
    merged.priceDrivers = [merged.priceDrivers, stringOrEmpty(part.priceDrivers), stringOrEmpty(part.supportResistance)]
      .filter(Boolean)
      .join("\n\n");
    merged.returnAnalysis = [merged.returnAnalysis, stringOrEmpty(part.returnAnalysis), stringOrEmpty(part.returnProfile)]
      .filter(Boolean)
      .join("\n\n");
    merged.riskAnalysis = [merged.riskAnalysis, stringOrEmpty(part.riskAnalysis), stringOrEmpty(part.volatilityAnalysis)]
      .filter(Boolean)
      .join("\n\n");
    merged.drawdownAnalysis = [merged.drawdownAnalysis, stringOrEmpty(part.drawdownAnalysis)]
      .filter(Boolean)
      .join("\n\n");
    merged.technicalAnalysis = [merged.technicalAnalysis, stringOrEmpty(part.technicalAnalysis), stringOrEmpty(part.movingAverageAnalysis)]
      .filter(Boolean)
      .join("\n\n");
    merged.momentumSignals = [merged.momentumSignals, stringOrEmpty(part.momentumSignals), stringOrEmpty(part.rsiMacdAnalysis)]
      .filter(Boolean)
      .join("\n\n");
    merged.volumeAnalysis = [merged.volumeAnalysis, stringOrEmpty(part.volumeAnalysis), stringOrEmpty(part.liquidityAnalysis)]
      .filter(Boolean)
      .join("\n\n");
    merged.benchmarkContext = [merged.benchmarkContext, stringOrEmpty(part.benchmarkContext), stringOrEmpty(part.betaAnalysis)]
      .filter(Boolean)
      .join("\n\n");
    merged.conclusion = [merged.conclusion, stringOrEmpty(part.conclusion), stringOrEmpty(part.outlook)]
      .filter(Boolean)
      .join("\n\n");

    merged.keyObservations = [
      ...merged.keyObservations,
      ...arrayOfStrings(part.keyObservations),
      ...arrayOfStrings(part.highlights),
    ];
    merged.limitations = [...merged.limitations, ...arrayOfStrings(part.limitations)];
  }

  merged.keyObservations = [...new Set(merged.keyObservations)].slice(0, 12);
  merged.limitations = [...new Set(merged.limitations)].slice(0, 8);

  if (!merged.summary && merged.investmentThesis) {
    merged.summary = merged.investmentThesis.slice(0, 600);
  }

  return merged;
}

export async function generateAnalysisReport(geminiInput) {
  if (!GEMINI_API_KEY) {
    return {
      aiReport: null,
      aiError: "AI report unavailable: GEMINI_API_KEY is not configured on the server.",
    };
  }

  const modelCandidates = getGeminiModelCandidates("analysis");
  let activeModel = modelCandidates[0];

  const passes = [
    {
      title: "Executive overview",
      input: sliceInput(geminiInput, ["pricePerformance", "returns", "risk"]),
      schema: `{ "summary": "...", "investmentThesis": "..." }`,
    },
    {
      title: "Price action deep dive",
      input: sliceInput(geminiInput, ["pricePerformance", "technical", "extended"]),
      schema: `{ "priceAnalysis": "...", "priceDrivers": "...", "supportResistance": "..." }`,
    },
    {
      title: "Returns profile",
      input: sliceInput(geminiInput, ["returns", "extended", "pricePerformance"]),
      schema: `{ "returnAnalysis": "...", "returnProfile": "...", "keyObservations": ["..."] }`,
    },
    {
      title: "Risk and drawdown",
      input: sliceInput(geminiInput, ["risk", "returns", "extended"]),
      schema: `{ "riskAnalysis": "...", "volatilityAnalysis": "...", "drawdownAnalysis": "..." }`,
    },
    {
      title: "Technical structure",
      input: sliceInput(geminiInput, ["technical", "signalMatrix", "extended"]),
      schema: `{ "technicalAnalysis": "...", "movingAverageAnalysis": "...", "momentumSignals": "...", "rsiMacdAnalysis": "..." }`,
    },
    {
      title: "Volume and participation",
      input: sliceInput(geminiInput, ["volume", "extended", "pricePerformance"]),
      schema: `{ "volumeAnalysis": "...", "liquidityAnalysis": "...", "keyObservations": ["..."] }`,
    },
    {
      title: "Benchmark relative behavior",
      input: sliceInput(geminiInput, ["risk", "methodology", "returns"]),
      schema: `{ "benchmarkContext": "...", "betaAnalysis": "...", "limitations": ["..."] }`,
    },
    {
      title: "Closing synthesis",
      input: geminiInput,
      schema: `{ "conclusion": "...", "outlook": "...", "keyObservations": ["..."], "limitations": ["..."] }`,
    },
  ];

  const completed = [];
  const passErrors = [];

  for (let i = 0; i < passes.length; i++) {
    const pass = passes[i];
    try {
      const { result, model } = await withGeminiModelFallback(modelCandidates, (candidateModel) =>
        runPass(pass.title, `JSON shape:\n${pass.schema}`, pass.input, candidateModel)
      );
      activeModel = model;
      completed.push(result);
    } catch (error) {
      passErrors.push(`${pass.title}: ${error.message}`);
    }

    if (i < passes.length - 1 && PASS_DELAY_MS > 0) {
      await sleep(PASS_DELAY_MS);
    }
  }

  if (!completed.length) {
    return {
      aiReport: null,
      aiError: `AI report unavailable: ${passErrors[0] || "All Gemini passes failed."}`,
    };
  }

  const aiReport = mergeReportParts(completed);
  aiReport.wordCount = countWords(aiReport);
  aiReport.generatedInPasses = completed.length;
  aiReport.totalPasses = passes.length;
  aiReport.model = activeModel;

  const aiError =
    passErrors.length > 0
      ? `Partial AI report (${completed.length}/${passes.length} sections). ${passErrors[0]}`
      : null;

  if (!aiReport.summary && !aiReport.priceAnalysis && !aiReport.conclusion) {
    return {
      aiReport: null,
      aiError: aiError || "AI report unavailable: empty merged content.",
    };
  }

  return { aiReport, aiError };
}
