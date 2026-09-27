export const ANALYSIS_GLOSSARY: Record<string, string> = {
  Return:
    'Total percentage change from the first closing price to the last closing price in the selected period.',
  'Volatility (ann.)':
    'Standard deviation of daily returns scaled to a one-year horizon (√252). Higher values mean larger typical swings.',
  'Max Drawdown':
    'Largest peak-to-trough decline in closing price during the sample. Measures worst historical underwater loss.',
  Sharpe:
    'Excess annualized return per unit of total volatility. Uses the configured risk-free rate in the denominator.',
  Beta:
    'Co-movement with the benchmark (default SPY). Beta > 1 implies higher sensitivity to benchmark moves.',
  'RSI (14)':
    'Relative Strength Index over 14 days. Values above 70 are often considered overbought; below 30 oversold.',
  Sortino:
    'Like Sharpe but uses downside volatility only, focusing on harmful volatility rather than all swings.',
  'Win Rate':
    'Share of trading days with positive daily returns versus days with negative returns.',
  MACD:
    'Moving Average Convergence Divergence compares fast and slow EMAs of price to highlight momentum shifts.',
  'Avg True Range':
    'Average daily high-minus-low range. A simple volatility proxy for intraday movement.',
};

export function glossaryFor(label: string): string | undefined {
  return ANALYSIS_GLOSSARY[label];
}
