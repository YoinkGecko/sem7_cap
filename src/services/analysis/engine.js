import { fetchDailyBars } from "./fetchBars.js";
import {
  covariance,
  dailyReturns,
  drawdownSeries,
  ema,
  macd,
  mean,
  rsi,
  sma,
  standardDeviation,
  variance,
} from "./indicators.js";
import { periodStartDate } from "./periods.js";

const MIN_BARS = 30;
const BENCHMARK = process.env.ANALYSIS_BENCHMARK || "SPY";
const RISK_FREE_RATE = Number.parseFloat(process.env.ANALYSIS_RISK_FREE_RATE || "0");

export async function buildStockAnalysis(symbol, period) {
  const startDate = periodStartDate(period);
  const bars = await fetchDailyBars(symbol, startDate);

  if (!bars.length) {
    const error = new Error(`No historical daily data found for ${symbol}.`);
    error.status = 404;
    throw error;
  }

  if (bars.length < MIN_BARS) {
    const error = new Error(
      `Insufficient historical data for ${symbol}. Need at least ${MIN_BARS} daily bars, got ${bars.length}.`
    );
    error.status = 404;
    throw error;
  }

  const dates = bars.map((b) => b.date);
  const closes = bars.map((b) => b.close);
  const volumes = bars.map((b) => b.volume);

  const startingPrice = closes[0];
  const endingPrice = closes[closes.length - 1];
  const absoluteChange = endingPrice - startingPrice;
  const percentageChange = startingPrice === 0 ? null : (absoluteChange / startingPrice) * 100;

  const returns = dailyReturns(closes);
  const returnValues = returns.filter((v) => v !== null);
  const averageDailyReturn = mean(returnValues);

  let bestDay = null;
  let worstDay = null;
  for (let i = 1; i < returns.length; i++) {
    const value = returns[i];
    if (value === null) continue;
    if (!bestDay || value > bestDay.return) bestDay = { date: dates[i], return: value };
    if (!worstDay || value < worstDay.return) worstDay = { date: dates[i], return: value };
  }

  const firstDate = new Date(`${dates[0]}T00:00:00Z`);
  const lastDate = new Date(`${dates[dates.length - 1]}T00:00:00Z`);
  const calendarDays = Math.max(1, (lastDate - firstDate) / 86400000);
  const annualizedReturn =
    startingPrice <= 0
      ? null
      : (endingPrice / startingPrice) ** (365 / calendarDays) - 1;

  const dailyVolatility = standardDeviation(returnValues);
  const annualizedVolatility =
    dailyVolatility === null ? null : dailyVolatility * Math.sqrt(252);

  const drawdown = drawdownSeries(closes);
  const sharpeRatio =
    annualizedVolatility && annualizedVolatility !== 0 && annualizedReturn !== null
      ? (annualizedReturn - RISK_FREE_RATE) / annualizedVolatility
      : null;

  const sma20 = sma(closes, 20);
  const sma50 = sma(closes, 50);
  const sma100 = sma(closes, 100);
  const sma200 = sma(closes, 200);
  const ema20 = ema(closes, 20);
  const ema50 = ema(closes, 50);
  const rsi14 = rsi(closes, 14);
  const macdData = macd(closes);

  const cumulativeReturn = closes.map((close) =>
    startingPrice === 0 ? null : close / startingPrice - 1
  );

  const averageVolume = mean(volumes);
  const latestVolume = volumes[volumes.length - 1];
  const highestVolumeDayIndex = volumes.reduce(
    (best, value, index) => (value > volumes[best] ? index : best),
    0
  );

  const betaResult = await calculateBeta(symbol, period, dates, returns);
  const extended = computeExtendedMetrics(bars, returns, closes, annualizedReturn, RISK_FREE_RATE);

  const lastIndex = closes.length - 1;
  const current = {
    close: closes[lastIndex],
    sma20: sma20[lastIndex],
    sma50: sma50[lastIndex],
    sma200: sma200[lastIndex],
    rsi14: rsi14[lastIndex],
    macd: macdData.macdLine[lastIndex],
    signal: macdData.signalLine[lastIndex],
    histogram: macdData.histogram[lastIndex],
    drawdown: drawdown.series[lastIndex],
  };

  const analysis = {
    symbol,
    period,
    generatedAt: new Date().toISOString(),
    methodology: {
      benchmark: betaResult.benchmark,
      riskFreeRate: RISK_FREE_RATE,
      tradingDaysForVolatilityAnnualization: 252,
      calendarDaysInSample: calendarDays,
      barCount: bars.length,
      betaFormula:
        "covariance(stock daily returns, benchmark daily returns) / variance(benchmark daily returns)",
      formulas: ANALYSIS_FORMULAS,
    },
    pricePerformance: {
      startingPrice,
      endingPrice,
      absoluteChange,
      percentageChange,
      highestPrice: Math.max(...bars.map((b) => b.high)),
      lowestPrice: Math.min(...bars.map((b) => b.low)),
      averageClose: mean(closes),
    },
    returns: {
      averageDailyReturn,
      averageDailyReturnPct: averageDailyReturn === null ? null : averageDailyReturn * 100,
      annualizedReturn,
      annualizedReturnPct: annualizedReturn === null ? null : annualizedReturn * 100,
      bestDay,
      worstDay,
    },
    risk: {
      dailyVolatility,
      annualizedVolatility,
      annualizedVolatilityPct:
        annualizedVolatility === null ? null : annualizedVolatility * 100,
      maximumDrawdown: drawdown.maxDrawdown,
      maximumDrawdownPct: drawdown.maxDrawdownPct,
      peakDate: drawdown.peakDateIndex === null ? null : dates[drawdown.peakDateIndex],
      troughDate: drawdown.troughDateIndex === null ? null : dates[drawdown.troughDateIndex],
      sharpeRatio,
      riskFreeRate: RISK_FREE_RATE,
      beta: betaResult.beta,
      benchmark: betaResult.benchmark,
      betaObservationCount: betaResult.observationCount,
    },
    technical: {
      current: {
        sma20: current.sma20,
        sma50: current.sma50,
        sma100: sma100[lastIndex],
        sma200: current.sma200,
        ema20: ema20[lastIndex],
        ema50: ema50[lastIndex],
        rsi14: current.rsi14,
        macd: current.macd,
        signal: current.signal,
        histogram: current.histogram,
      },
      observations: {
        priceVsSma20:
          current.sma20 === null ? null : current.close / current.sma20 - 1,
        priceVsSma50:
          current.sma50 === null ? null : current.close / current.sma50 - 1,
        priceVsSma200:
          current.sma200 === null ? null : current.close / current.sma200 - 1,
        sma50VsSma200:
          current.sma50 === null || current.sma200 === null
            ? null
            : current.sma50 / current.sma200 - 1,
        currentDrawdown: current.drawdown,
        currentDrawdownPct: current.drawdown === null ? null : current.drawdown * 100,
      },
    },
    volume: {
      average: averageVolume,
      highest: volumes[highestVolumeDayIndex],
      highestDate: dates[highestVolumeDayIndex],
      latest: latestVolume,
      relativeToAverage:
        averageVolume && averageVolume !== 0 ? latestVolume / averageVolume : null,
    },
    extended: extended.metrics,
    deepInsights: extended.insights,
    signalMatrix: extended.signalMatrix,
    chartData: {
      priceSeries: bars.map((b) => ({ date: b.date, close: b.close })),
      technicalSeries: bars.map((b, i) => ({
        date: b.date,
        close: b.close,
        sma20: sma20[i],
        sma50: sma50[i],
        sma100: sma100[i],
        sma200: sma200[i],
      })),
      volumeSeries: bars.map((b) => ({ date: b.date, volume: b.volume })),
      rsiSeries: bars.map((b, i) => ({ date: b.date, rsi: rsi14[i] })),
      macdSeries: bars.map((b, i) => ({
        date: b.date,
        macd: macdData.macdLine[i],
        signal: macdData.signalLine[i],
        histogram: macdData.histogram[i],
      })),
      drawdownSeries: bars.map((b, i) => ({
        date: b.date,
        drawdown: drawdown.series[i],
        drawdownPct: drawdown.series[i] === null ? null : drawdown.series[i] * 100,
      })),
      returnsSeries: bars.map((b, i) => ({
        date: b.date,
        dailyReturn: returns[i],
        dailyReturnPct: returns[i] === null ? null : returns[i] * 100,
        cumulativeReturn: cumulativeReturn[i],
        cumulativeReturnPct:
          cumulativeReturn[i] === null ? null : cumulativeReturn[i] * 100,
      })),
      emaSeries: bars.map((b, i) => ({
        date: b.date,
        close: b.close,
        ema20: ema20[i],
        ema50: ema50[i],
      })),
      dailyReturnSeries: bars
        .map((b, i) => ({
          date: b.date,
          dailyReturnPct: returns[i] === null ? null : returns[i] * 100,
        }))
        .filter((row) => row.dailyReturnPct !== null),
    },
  };

  return roundAnalysis(analysis);
}

async function calculateBeta(symbol, period, stockDates, stockReturns) {
  try {
    const benchmarkBars = await fetchDailyBars(BENCHMARK, periodStartDate(period));
    const benchmarkReturns = dailyReturns(benchmarkBars.map((bar) => bar.close));
    const benchmarkMap = new Map(
      benchmarkBars.map((bar, index) => [bar.date, benchmarkReturns[index]])
    );

    const alignedStock = [];
    const alignedBenchmark = [];
    for (let i = 0; i < stockDates.length; i++) {
      const date = stockDates[i];
      const benchmarkReturn = benchmarkMap.get(date);
      if (stockReturns[i] === null || benchmarkReturn === null || benchmarkReturn === undefined) {
        continue;
      }
      alignedStock.push(stockReturns[i]);
      alignedBenchmark.push(benchmarkReturn);
    }

    if (alignedStock.length < 20) {
      return { benchmark: BENCHMARK, beta: null, observationCount: alignedStock.length };
    }

    const benchmarkVariance = variance(alignedBenchmark);
    const beta =
      benchmarkVariance === null || benchmarkVariance === 0
        ? null
        : covariance(alignedStock, alignedBenchmark) / benchmarkVariance;

    return {
      benchmark: BENCHMARK,
      beta,
      observationCount: alignedStock.length,
    };
  } catch {
    return { benchmark: BENCHMARK, beta: null, observationCount: 0 };
  }
}

function roundAnalysis(analysis) {
  return JSON.parse(
    JSON.stringify(analysis, (_key, value) => {
      if (typeof value === "number" && Number.isFinite(value)) {
        return Number(value.toFixed(6));
      }
      return value;
    })
  );
}

export function buildGeminiInput(analysis) {
  return {
    symbol: analysis.symbol,
    period: analysis.period,
    generatedAt: analysis.generatedAt,
    methodology: analysis.methodology,
    pricePerformance: analysis.pricePerformance,
    returns: {
      averageDailyReturnPct: analysis.returns.averageDailyReturnPct,
      annualizedReturnPct: analysis.returns.annualizedReturnPct,
      bestDay: analysis.returns.bestDay,
      worstDay: analysis.returns.worstDay,
    },
    risk: analysis.risk,
    technical: {
      current: analysis.technical.current,
      observations: analysis.technical.observations,
    },
    volume: analysis.volume,
    extended: analysis.extended,
    deepInsights: analysis.deepInsights,
    signalMatrix: analysis.signalMatrix,
  };
}

const ANALYSIS_FORMULAS = [
  {
    id: "totalReturn",
    name: "Total Return (%)",
    expression: "((P_end − P_start) / P_start) × 100",
    description: "Simple buy-and-hold percentage change across the selected period.",
  },
  {
    id: "dailyReturn",
    name: "Daily Return",
    expression: "(Close_t / Close_{t−1}) − 1",
    description: "Logically independent daily percentage moves used for volatility and Sharpe.",
  },
  {
    id: "annualizedReturn",
    name: "Annualized Return",
    expression: "(P_end / P_start)^(365 / calendarDays) − 1",
    description: "Scales the observed period return to a one-year equivalent using actual calendar span.",
  },
  {
    id: "volatility",
    name: "Annualized Volatility",
    expression: "StdDev(daily returns) × √252",
    description: "Historical volatility assuming ~252 trading days per year.",
  },
  {
    id: "drawdown",
    name: "Drawdown",
    expression: "(Price − RunningPeak) / RunningPeak",
    description: "Underwater percentage from the prior maximum close within the sample.",
  },
  {
    id: "sharpe",
    name: "Sharpe Ratio",
    expression: "(AnnualizedReturn − RiskFreeRate) / AnnualizedVolatility",
    description: "Return per unit of total volatility using the configured risk-free rate.",
  },
  {
    id: "sortino",
    name: "Sortino Ratio",
    expression: "(AnnualizedReturn − RiskFreeRate) / (DownsideDev × √252)",
    description: "Like Sharpe but penalizes only negative daily returns.",
  },
  {
    id: "beta",
    name: "Beta",
    expression: "Cov(R_stock, R_benchmark) / Var(R_benchmark)",
    description: "Sensitivity to benchmark daily moves on aligned trading dates.",
  },
  {
    id: "rsi",
    name: "RSI (14)",
    expression: "100 − (100 / (1 + RS)), RS = AvgGain / AvgLoss (Wilder smoothing)",
    description: "Momentum oscillator bounded between 0 and 100.",
  },
  {
    id: "macd",
    name: "MACD",
    expression: "EMA₁₂(Close) − EMA₂₆(Close); Signal = EMA₉(MACD)",
    description: "Trend/momentum crossover system derived from exponential moving averages.",
  },
];

function computeExtendedMetrics(bars, returns, closes, annualizedReturn, riskFreeRate) {
  let positiveDays = 0;
  let negativeDays = 0;
  let flatDays = 0;
  let maxGainStreak = 0;
  let maxLossStreak = 0;
  let gainStreak = 0;
  let lossStreak = 0;

  for (const value of returns) {
    if (value === null) continue;
    if (value > 0) {
      positiveDays++;
      gainStreak++;
      lossStreak = 0;
      maxGainStreak = Math.max(maxGainStreak, gainStreak);
    } else if (value < 0) {
      negativeDays++;
      lossStreak++;
      gainStreak = 0;
      maxLossStreak = Math.max(maxLossStreak, lossStreak);
    } else {
      flatDays++;
      gainStreak = 0;
      lossStreak = 0;
    }
  }

  const tradedDays = positiveDays + negativeDays + flatDays;
  const winRatePct =
    positiveDays + negativeDays > 0 ? (positiveDays / (positiveDays + negativeDays)) * 100 : null;

  const downsideReturns = returns.filter((value) => value !== null && value < 0);
  const downsideDeviation = standardDeviation(downsideReturns);
  const sortinoRatio =
    downsideDeviation && downsideDeviation !== 0 && annualizedReturn !== null
      ? (annualizedReturn - riskFreeRate) / (downsideDeviation * Math.sqrt(252))
      : null;

  const trueRanges = bars.map((bar) => bar.high - bar.low);
  const averageTrueRange = mean(trueRanges);
  const averageClose = mean(closes);
  const periodHigh = Math.max(...bars.map((bar) => bar.high));
  const periodLow = Math.min(...bars.map((bar) => bar.low));
  const rangePct =
    averageClose && averageClose !== 0 ? ((periodHigh - periodLow) / averageClose) * 100 : null;

  const metrics = {
    positiveDays,
    negativeDays,
    flatDays,
    tradedDays,
    winRatePct,
    maxConsecutiveGainDays: maxGainStreak,
    maxConsecutiveLossDays: maxLossStreak,
    sortinoRatio,
    downsideDeviation,
    averageTrueRange,
    periodRangePct: rangePct,
    periodHigh,
    periodLow,
  };

  const insights = [
    `Observed ${tradedDays} trading days with ${positiveDays} up days and ${negativeDays} down days (win rate ${winRatePct?.toFixed(2) ?? "n/a"}%).`,
    `Largest streaks: ${maxGainStreak} consecutive gain days and ${maxLossStreak} consecutive loss days.`,
    `Period high/low range spans ${rangePct?.toFixed(2) ?? "n/a"}% relative to average close.`,
    `Average daily true range (high−low) is ${averageTrueRange?.toFixed(4) ?? "n/a"}.`,
  ];

  const signalMatrix = buildSignalMatrix(closes, bars);

  return { metrics, insights, signalMatrix };
}

function buildSignalMatrix(closes, bars) {
  const last = closes.length - 1;
  const close = closes[last];
  const sma20 = sma(closes, 20)[last];
  const sma50 = sma(closes, 50)[last];
  const sma200 = sma(closes, 200)[last];
  const rsi14 = rsi(closes, 14)[last];
  const macdData = macd(closes);

  return [
    signalRow("Price vs SMA 20", close, sma20, close > sma20 ? "above" : "below"),
    signalRow("Price vs SMA 50", close, sma50, close > sma50 ? "above" : "below"),
    signalRow("Price vs SMA 200", close, sma200, sma200 === null ? "insufficient data" : close > sma200 ? "above" : "below"),
    {
      label: "RSI 14 zone",
      value: rsi14,
      state:
        rsi14 === null ? "insufficient data" : rsi14 >= 70 ? "overbought zone" : rsi14 <= 30 ? "oversold zone" : "neutral",
    },
    {
      label: "MACD vs Signal",
      value: macdData.macdLine[last],
      state:
        macdData.macdLine[last] === null || macdData.signalLine[last] === null
          ? "insufficient data"
          : macdData.macdLine[last] > macdData.signalLine[last]
            ? "bullish crossover bias"
            : "bearish crossover bias",
    },
    {
      label: "Volume vs Average",
      value: bars[last]?.volume,
      state:
        bars[last]?.volume && mean(bars.map((b) => b.volume))
          ? bars[last].volume / mean(bars.map((b) => b.volume)) > 1.25
            ? "elevated"
            : bars[last].volume / mean(bars.map((b) => b.volume)) < 0.75
              ? "light"
              : "normal"
          : "unknown",
    },
  ];
}

function signalRow(label, price, average, state) {
  return {
    label,
    value: average === null ? null : price / average - 1,
    state: average === null ? "insufficient data" : state,
  };
}
