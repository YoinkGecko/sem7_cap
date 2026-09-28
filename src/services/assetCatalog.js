import { runCommand } from "../config/command.js";

const CACHE_TTL_MS = Number(process.env.ASSET_CATALOG_TTL_MS) || 60 * 60 * 1000;

let cache = {
  loadedAt: 0,
  assets: [],
};

export function normalizeAsset(raw) {
  if (!raw || typeof raw !== "object") return null;
  const symbol = String(raw.symbol || "").toUpperCase();
  if (!symbol) return null;
  return {
    symbol,
    name: raw.name || undefined,
    exchange: raw.exchange || undefined,
    asset_class: raw.class || raw.asset_class || undefined,
    status: raw.status || undefined,
    tradable: raw.tradable,
  };
}

export async function getActiveUsEquities() {
  const now = Date.now();
  if (cache.assets.length && now - cache.loadedAt < CACHE_TTL_MS) {
    return cache.assets;
  }

  const result = await runCommand([
    "asset",
    "list",
    "--asset-class",
    "us_equity",
    "--status",
    "active",
  ]);
  const parsed = JSON.parse(result);
  const list = Array.isArray(parsed) ? parsed : parsed?.assets || [];
  cache.assets = list.map(normalizeAsset).filter(Boolean);
  cache.loadedAt = now;
  return cache.assets;
}

export async function searchActiveUsEquities(query, limit = 40) {
  const q = String(query || "")
    .trim()
    .toLowerCase();
  if (!q) return [];

  const all = await getActiveUsEquities();
  const scored = [];

  for (const asset of all) {
    const sym = asset.symbol.toLowerCase();
    const name = (asset.name || "").toLowerCase();
    let score = 0;
    if (sym === q) score = 1000;
    else if (sym.startsWith(q)) score = 500;
    else if (sym.includes(q)) score = 200;
    else if (name.startsWith(q)) score = 150;
    else if (name.includes(q)) score = 80;
    else continue;
    scored.push({ asset, score });
  }

  scored.sort((a, b) => b.score - a.score || a.asset.symbol.localeCompare(b.asset.symbol));

  const seen = new Set();
  const out = [];
  for (const { asset } of scored) {
    if (seen.has(asset.symbol)) continue;
    seen.add(asset.symbol);
    out.push(asset);
    if (out.length >= limit) break;
  }
  return out;
}

export async function getAssetBySymbol(symbol) {
  const sym = String(symbol || "").trim().toUpperCase();
  if (!sym) return null;

  try {
    const result = await runCommand([
      "asset",
      "get",
      "--symbol-or-asset-id",
      sym,
    ]);
    return normalizeAsset(JSON.parse(result));
  } catch {
    const all = await getActiveUsEquities();
    return all.find((a) => a.symbol === sym) || null;
  }
}
