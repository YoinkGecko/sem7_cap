import { fetchStockNews } from "../stockNews.js";
import { processContentBatch } from "./intentEngine.js";

export async function ingestAndSanitizeNews(symbols, options = {}) {
  const limitPerSymbol = Number(options.limitPerSymbol) || 5;
  const unique = [...new Set((symbols || []).map((s) => String(s).trim().toUpperCase()).filter(Boolean))];

  const rawItems = [];

  for (const symbol of unique) {
    try {
      const pack = await fetchStockNews(symbol);
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
      // Skip symbols with unavailable news; batch still returns partial results.
    }
  }

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
