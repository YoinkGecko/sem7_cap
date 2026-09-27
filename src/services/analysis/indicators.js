export function sma(values, period) {
  const out = [];
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) {
      out.push(null);
      continue;
    }
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += values[j];
    out.push(sum / period);
  }
  return out;
}

export function ema(values, period) {
  const out = [];
  const multiplier = 2 / (period + 1);
  let previous = null;

  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) {
      out.push(null);
      continue;
    }

    if (previous === null) {
      let sum = 0;
      for (let j = i - period + 1; j <= i; j++) sum += values[j];
      previous = sum / period;
      out.push(previous);
      continue;
    }

    previous = values[i] * multiplier + previous * (1 - multiplier);
    out.push(previous);
  }

  return out;
}

export function dailyReturns(closes) {
  const out = [null];
  for (let i = 1; i < closes.length; i++) {
    const prev = closes[i - 1];
    if (!prev) {
      out.push(null);
      continue;
    }
    out.push(closes[i] / prev - 1);
  }
  return out;
}

export function rsi(closes, period = 14) {
  const out = new Array(closes.length).fill(null);
  if (closes.length <= period) return out;

  let avgGain = 0;
  let avgLoss = 0;

  for (let i = 1; i <= period; i++) {
    const change = closes[i] - closes[i - 1];
    if (change >= 0) avgGain += change;
    else avgLoss += Math.abs(change);
  }

  avgGain /= period;
  avgLoss /= period;

  const rs = avgLoss === 0 ? Infinity : avgGain / avgLoss;
  out[period] = 100 - 100 / (1 + rs);

  for (let i = period + 1; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? Math.abs(change) : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    const nextRs = avgLoss === 0 ? Infinity : avgGain / avgLoss;
    out[i] = 100 - 100 / (1 + nextRs);
  }

  return out;
}

export function macd(closes) {
  const ema12 = ema(closes, 12);
  const ema26 = ema(closes, 26);
  const macdLine = ema12.map((v, i) =>
    v === null || ema26[i] === null ? null : v - ema26[i]
  );

  const macdValues = macdLine.map((v) => (v === null ? 0 : v));
  const signalLine = ema(
    macdValues.map((v, i) => (macdLine[i] === null ? macdValues[i] : v)),
    9
  );

  const histogram = macdLine.map((v, i) =>
    v === null || signalLine[i] === null ? null : v - signalLine[i]
  );

  return { macdLine, signalLine, histogram };
}

export function drawdownSeries(closes) {
  let peak = closes[0];
  let peakDateIndex = 0;
  let maxDrawdown = 0;
  let maxDrawdownPct = 0;
  let peakDate = null;
  let troughDate = null;

  const series = closes.map((close, index) => {
    if (close > peak) {
      peak = close;
      peakDateIndex = index;
    }
    const drawdown = peak === 0 ? 0 : (close - peak) / peak;
    if (drawdown < maxDrawdown) {
      maxDrawdown = drawdown;
      maxDrawdownPct = drawdown * 100;
      peakDate = peakDateIndex;
      troughDate = index;
    }
    return drawdown;
  });

  return {
    series,
    maxDrawdown,
    maxDrawdownPct,
    peakDateIndex: peakDate,
    troughDateIndex: troughDate,
  };
}

export function mean(values) {
  const filtered = values.filter((v) => v !== null && Number.isFinite(v));
  if (!filtered.length) return null;
  return filtered.reduce((sum, v) => sum + v, 0) / filtered.length;
}

export function standardDeviation(values) {
  const filtered = values.filter((v) => v !== null && Number.isFinite(v));
  if (filtered.length < 2) return null;
  const avg = mean(filtered);
  const variance =
    filtered.reduce((sum, v) => sum + (v - avg) ** 2, 0) / (filtered.length - 1);
  return Math.sqrt(variance);
}

export function covariance(a, b) {
  const pairs = [];
  for (let i = 0; i < a.length; i++) {
    if (a[i] === null || b[i] === null) continue;
    pairs.push([a[i], b[i]]);
  }
  if (pairs.length < 2) return null;
  const meanA = pairs.reduce((s, p) => s + p[0], 0) / pairs.length;
  const meanB = pairs.reduce((s, p) => s + p[1], 0) / pairs.length;
  return (
    pairs.reduce((s, p) => s + (p[0] - meanA) * (p[1] - meanB), 0) / (pairs.length - 1)
  );
}

export function variance(values) {
  return standardDeviation(values) ** 2;
}
