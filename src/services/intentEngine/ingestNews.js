import { fetchStockNews } from "../stockNews.js";
import { processContentBatch } from "./intentEngine.js";

const NEWS_FETCH_TIMEOUT_MS = Number(process.env.INTENT_NEWS_TIMEOUT_MS) || 8000;

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    }),
  ]);
}

export async function ingestAndSanitizeNews(symbols, options = {}) {
  const limitPerSymbol = Number(options.limitPerSymbol) || 5;
  const unique = [...new Set((symbols || []).map((s) => String(s).trim().toUpperCase()).filter(Boolean))];

  const rawItems = [];

  await Promise.all(
    unique.map(async (symbol) => {
      try {
        const pack = await withTimeout(
          fetchStockNews(symbol),
          NEWS_FETCH_TIMEOUT_MS,
          `News fetch for ${symbol}`
        );
        const articles = Array.isArray(pack?.news) ? pack.news : [];
        for (const article of articles.slice(0, limitPerSymbol)) {
          rawItems.push({
            id: String(article.id ?? `${symbol}-${article.headline}`),
            symbol,
            contentType: "news",
            source: article.source || pack.source || "market",
            url: article.url,
            title: article.headline || "Untitled",
            body: [article.headline, article.summary].filter(Boolean).join("\n\n"),
          });
        }
      } catch {
        // Skip symbols with unavailable or slow news sources.
      }
    })
  );

  const result = processContentBatch(rawItems);
  return {
    ...result,
    symbols: unique,
    fetchNotice:
      rawItems.length === 0
        ? "No external articles were retrieved; intent scan completed on empty set."
        : null,
  };
}
