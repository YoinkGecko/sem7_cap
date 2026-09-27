const CACHE_TTL_MS =
  (Number.parseInt(process.env.ANALYSIS_CACHE_MINUTES || "30", 10) || 30) * 60 * 1000;

/** @type {Map<string, { expires: number, payload: unknown }>} */
const cache = new Map();
/** @type {Map<string, Promise<unknown>>} */
const inflight = new Map();

export function getCachedAnalysis(key) {
  const entry = cache.get(key);
  if (!entry || entry.expires <= Date.now()) return null;
  return entry.payload;
}

export function setCachedAnalysis(key, payload) {
  cache.set(key, { expires: Date.now() + CACHE_TTL_MS, payload });
}

export async function withAnalysisCache(key, factory) {
  const cached = getCachedAnalysis(key);
  if (cached) return { ...cached, cached: true };

  if (inflight.has(key)) {
    return inflight.get(key);
  }

  const promise = factory().then((payload) => {
    setCachedAnalysis(key, payload);
    return payload;
  });

  inflight.set(key, promise);
  try {
    return await promise;
  } finally {
    inflight.delete(key);
  }
}
