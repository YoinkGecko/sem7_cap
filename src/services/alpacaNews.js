import { runCommand } from "../config/command.js";

export async function fetchStockNewsFromAlpaca(symbol) {
  const ticker = symbol.trim().toUpperCase();
  if (!ticker) {
    throw new Error("Symbol is required.");
  }

  const result = await runCommand([
    "data",
    "news",
    "--symbols",
    ticker,
    "--limit",
    "10",
  ]);

  const parsed = JSON.parse(result);
  const items = Array.isArray(parsed?.news) ? parsed.news : [];

  return {
    news: items.map((item) => ({
      id: String(item.id ?? item.headline ?? ticker),
      headline: item.headline || "Untitled",
      summary: item.summary || undefined,
      source: item.source || "Alpaca",
      url: item.url || undefined,
      created_at: item.created_at || item.updated_at || undefined,
      symbols: Array.isArray(item.symbols) ? item.symbols : [ticker],
    })),
    source: "alpaca",
    symbol: ticker,
  };
}
