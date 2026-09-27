import { runCommand } from "../../config/command.js";
import { withAnalysisCache } from "./cache.js";
import { buildGeminiInput, buildStockAnalysis } from "./engine.js";
import { generateAnalysisReport } from "./geminiReport.js";
import { normalizePeriod, validateSymbol } from "./periods.js";

async function fetchAssetName(symbol) {
  try {
    const result = await runCommand(["asset", "get", "--symbol", symbol]);
    const asset = JSON.parse(result);
    return asset.name || asset.symbol || symbol;
  } catch {
    return symbol;
  }
}

export async function getStockAnalysis(symbolInput, periodInput) {
  const symbol = validateSymbol(symbolInput);
  if (!symbol) {
    const error = new Error("Invalid symbol.");
    error.status = 400;
    throw error;
  }

  const period = normalizePeriod(periodInput);
  if (!period) {
    const error = new Error("Invalid period. Supported values: 1M, 3M, 6M, 1Y, 3Y, 5Y.");
    error.status = 400;
    throw error;
  }

  const cacheKey = `${symbol}:${period}`;

  return withAnalysisCache(cacheKey, async () => {
    let analysis;
    try {
      analysis = await buildStockAnalysis(symbol, period);
    } catch (error) {
      if (!error.status) error.status = 502;
      throw error;
    }

    const geminiInput = buildGeminiInput(analysis);
    const ai = await generateAnalysisReport(geminiInput);
    const assetName = await fetchAssetName(symbol);

    return {
      ...analysis,
      assetName,
      aiReport: ai.aiReport,
      aiError: ai.aiError,
    };
  });
}
