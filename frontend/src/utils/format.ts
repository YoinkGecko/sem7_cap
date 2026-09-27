export function fmtCurrency(value: string | number | undefined | null, decimals = 2): string {
  const n = toNum(value);
  if (n === undefined) return '--';
  return n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function fmtNumber(value: string | number | undefined | null, decimals = 2): string {
  const n = toNum(value);
  if (n === undefined) return '--';
  return n.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function fmtPercent(value: string | number | undefined | null, withSign = true): string {
  const n = toNum(value);
  if (n === undefined) return '--';
  const sign = withSign && n > 0 ? '+' : '';
  return `${sign}${n.toFixed(2)}%`;
}

export function fmtSignedCurrency(value: string | number | undefined | null): string {
  const n = toNum(value);
  if (n === undefined) return '--';
  const sign = n >= 0 ? '+' : '-';
  return `${sign}${fmtCurrency(Math.abs(n))}`;
}

export function fmtLargeNumber(value: string | number | undefined | null): string {
  const n = toNum(value);
  if (n === undefined) return '--';
  const abs = Math.abs(n);
  if (abs >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${(n / 1e3).toFixed(2)}K`;
  return n.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

export function fmtInt(value: string | number | undefined | null): string {
  const n = toNum(value);
  if (n === undefined) return '--';
  return Math.round(n).toLocaleString('en-US');
}

export function fmtDate(value: string | undefined | null): string {
  if (!value) return '--';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '--';
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function fmtDateTime(value: string | undefined | null): string {
  if (!value) return '--';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '--';
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function fmtTime(value: string | undefined | null): string {
  if (!value) return '--';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '--';
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

/** US equity session times in Eastern Time (matches Alpaca clock). */
export function fmtMarketTimeEt(value: string | undefined | null): string {
  if (!value) return '--';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '--';
  return d.toLocaleString('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  });
}

export function toNum(value: string | number | undefined | null): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const n = typeof value === 'number' ? value : parseFloat(String(value));
  return Number.isNaN(n) ? undefined : n;
}

export function pctColor(value: string | number | undefined | null): string {
  const n = toNum(value);
  if (n === undefined) return 'text-neutral-400';
  if (n > 0) return 'text-emerald-400';
  if (n < 0) return 'text-red-400';
  return 'text-neutral-400';
}

export function pctBg(value: string | number | undefined | null): string {
  const n = toNum(value);
  if (n === undefined) return 'bg-neutral-600';
  if (n > 0) return 'bg-emerald-500';
  if (n < 0) return 'bg-red-500';
  return 'bg-neutral-600';
}
