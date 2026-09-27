import { fetchStockNewsFromAlpaca } from "./alpacaNews.js";
import {
  fetchStockNewsFromGemini,
  isGeminiNewsConfigured,
  isGeminiTemporarilyDisabled,
  isQuotaError,
} from "./geminiNews.js";

const NEWS_PROVIDER = (process.env.NEWS_PROVIDER || "auto").toLowerCase();

export async function fetchStockNews(symbol) {
  const ticker = symbol.trim().toUpperCase();

  if (NEWS_PROVIDER === "alpaca") {
    return fetchStockNewsFromAlpaca(ticker);
  }

  if (NEWS_PROVIDER === "gemini") {
    return fetchStockNewsFromGemini(ticker);
  }

  // auto: Gemini first (cached), Alpaca when Gemini fails or quota is exceeded
  if (isGeminiNewsConfigured() && !isGeminiTemporarilyDisabled()) {
    try {
      return await fetchStockNewsFromGemini(ticker);
    } catch (error) {
      if (isQuotaError(error) || error.quota) {
        try {
          const alpaca = await fetchStockNewsFromAlpaca(ticker);
          return {
            ...alpaca,
            fallback: "alpaca",
            notice:
              "Gemini free-tier quota exceeded. Showing Alpaca market news instead.",
          };
        } catch (alpacaError) {
          const err = new Error(
            `${error.message} Alpaca fallback also failed: ${alpacaError.message}`
          );
          err.quota = true;
          throw err;
        }
      }

      try {
        const alpaca = await fetchStockNewsFromAlpaca(ticker);
        return {
          ...alpaca,
          fallback: "alpaca",
          notice: "Gemini unavailable. Showing Alpaca market news instead.",
        };
      } catch {
        throw error;
      }
    }
  }

  if (isGeminiNewsConfigured() && isGeminiTemporarilyDisabled()) {
    try {
      const alpaca = await fetchStockNewsFromAlpaca(ticker);
      return {
        ...alpaca,
        fallback: "alpaca",
        notice: "Gemini quota cooldown active. Showing Alpaca market news.",
      };
    } catch (alpacaError) {
      try {
        return await fetchStockNewsFromGemini(ticker);
      } catch {
        throw alpacaError;
      }
    }
  }

  return fetchStockNewsFromAlpaca(ticker);
}
