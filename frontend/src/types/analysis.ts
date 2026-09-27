export type AnalysisPeriod = '1M' | '3M' | '6M' | '1Y' | '3Y' | '5Y';

export interface AnalysisSeriesPoint {
  date: string;
  [key: string]: string | number | null | undefined;
}

export interface StockAnalysisResponse {
  symbol: string;
  assetName?: string;
  period: AnalysisPeriod;
  generatedAt: string;
  cached?: boolean;
  methodology: {
    benchmark: string;
    riskFreeRate: number;
    tradingDaysForVolatilityAnnualization: number;
    calendarDaysInSample: number;
    barCount: number;
    betaFormula: string;
    formulas?: Array<{
      id: string;
      name: string;
      expression: string;
      description: string;
    }>;
  };
  pricePerformance: {
    startingPrice: number;
    endingPrice: number;
    absoluteChange: number;
    percentageChange: number | null;
    highestPrice: number;
    lowestPrice: number;
    averageClose: number | null;
  };
  returns: {
    averageDailyReturn: number | null;
    averageDailyReturnPct: number | null;
    annualizedReturn: number | null;
    annualizedReturnPct: number | null;
    bestDay: { date: string; return: number } | null;
    worstDay: { date: string; return: number } | null;
  };
  risk: {
    dailyVolatility: number | null;
    annualizedVolatility: number | null;
    annualizedVolatilityPct: number | null;
    maximumDrawdown: number | null;
    maximumDrawdownPct: number | null;
    peakDate: string | null;
    troughDate: string | null;
    sharpeRatio: number | null;
    riskFreeRate: number;
    beta: number | null;
    benchmark: string;
    betaObservationCount: number;
  };
  technical: {
    current: {
      sma20: number | null;
      sma50: number | null;
      sma100: number | null;
      sma200: number | null;
      ema20: number | null;
      ema50: number | null;
      rsi14: number | null;
      macd: number | null;
      signal: number | null;
      histogram: number | null;
    };
    observations: {
      priceVsSma20: number | null;
      priceVsSma50: number | null;
      priceVsSma200: number | null;
      sma50VsSma200: number | null;
      currentDrawdown: number | null;
      currentDrawdownPct: number | null;
    };
  };
  volume: {
    average: number | null;
    highest: number | null;
    highestDate: string | null;
    latest: number | null;
    relativeToAverage: number | null;
  };
  extended?: {
    positiveDays: number;
    negativeDays: number;
    flatDays: number;
    tradedDays: number;
    winRatePct: number | null;
    maxConsecutiveGainDays: number;
    maxConsecutiveLossDays: number;
    sortinoRatio: number | null;
    downsideDeviation: number | null;
    averageTrueRange: number | null;
    periodRangePct: number | null;
    periodHigh: number;
    periodLow: number;
  };
  deepInsights?: string[];
  signalMatrix?: Array<{ label: string; value: number | null; state: string }>;
  chartData: {
    priceSeries: AnalysisSeriesPoint[];
    technicalSeries: AnalysisSeriesPoint[];
    volumeSeries: AnalysisSeriesPoint[];
    rsiSeries: AnalysisSeriesPoint[];
    macdSeries: AnalysisSeriesPoint[];
    drawdownSeries: AnalysisSeriesPoint[];
    returnsSeries: AnalysisSeriesPoint[];
    emaSeries?: AnalysisSeriesPoint[];
    dailyReturnSeries?: AnalysisSeriesPoint[];
  };
  aiReport: {
    summary: string;
    priceAnalysis: string;
    returnAnalysis: string;
    riskAnalysis: string;
    technicalAnalysis: string;
    volumeAnalysis: string;
    keyObservations: string[];
    limitations: string[];
  } | null;
  aiError: string | null;
}
