import type { StockAnalysisResponse } from '@/types/analysis';

type Point = { date: string; value: number | null | undefined };

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function downsample<T>(rows: T[], max = 140): T[] {
  if (rows.length <= max) return rows;
  const step = rows.length / max;
  const out: T[] = [];
  for (let i = 0; i < max; i++) out.push(rows[Math.floor(i * step)]);
  return out;
}

function svgLine(points: Point[], width: number, height: number, stroke: string, label: string) {
  const valid = points.filter((p) => p.value !== null && p.value !== undefined) as { date: string; value: number }[];
  if (valid.length < 2) return `<div class="chart-empty">Insufficient data for ${escapeHtml(label)}</div>`;
  const values = valid.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const coords = valid
    .map((p, i) => {
      const x = (i / (valid.length - 1)) * (width - 20) + 10;
      const y = height - 20 - ((p.value - min) / range) * (height - 40);
      return `${x},${y}`;
    })
    .join(' ');
  return `<svg viewBox="0 0 ${width} ${height}" class="chart"><title>${escapeHtml(label)}</title><polyline fill="none" stroke="${stroke}" stroke-width="2" points="${coords}" /></svg>`;
}

function svgBars(points: Point[], width: number, height: number, fill: string, label: string) {
  const valid = points.filter((p) => p.value !== null && p.value !== undefined) as { date: string; value: number }[];
  if (!valid.length) return `<div class="chart-empty">Insufficient data for ${escapeHtml(label)}</div>`;
  const max = Math.max(...valid.map((p) => Math.abs(p.value)));
  const barW = Math.max(1, (width - 20) / valid.length);
  const bars = valid
    .map((p, i) => {
      const h = max === 0 ? 0 : (Math.abs(p.value) / max) * (height - 30);
      const x = 10 + i * barW;
      const y = height - 10 - h;
      return `<rect x="${x}" y="${y}" width="${Math.max(1, barW - 1)}" height="${h}" fill="${fill}" opacity="0.85" />`;
    })
    .join('');
  return `<svg viewBox="0 0 ${width} ${height}" class="chart"><title>${escapeHtml(label)}</title>${bars}</svg>`;
}

function fmtNum(value: number | null | undefined, digits = 4) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return value.toFixed(digits);
}

function fmtPct(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return `${value.toFixed(2)}%`;
}

function fmtMoney(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return `$${value.toFixed(2)}`;
}

export function buildAnalysisReportHtml(data: StockAnalysisResponse) {
  const pricePoints = downsample(
    data.chartData.priceSeries.map((p) => ({ date: String(p.date), value: Number(p.close) }))
  );
  const rsiPoints = downsample(
    data.chartData.rsiSeries.map((p) => ({ date: String(p.date), value: p.rsi as number | null }))
  );
  const ddPoints = downsample(
    data.chartData.drawdownSeries.map((p) => ({
      date: String(p.date),
      value: p.drawdownPct as number | null,
    }))
  );
  const volPoints = downsample(
    data.chartData.volumeSeries.map((p) => ({ date: String(p.date), value: Number(p.volume) }))
  );
  const cumPoints = downsample(
    data.chartData.returnsSeries.map((p) => ({
      date: String(p.date),
      value: p.cumulativeReturnPct as number | null,
    }))
  );

  const ai = data.aiReport;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(data.symbol)} Research Report · ${escapeHtml(data.period)}</title>
  <style>
    :root { --navy:#0b1f3a; --navy2:#12355f; --gold:#c9a227; --ink:#0f172a; --muted:#64748b; --line:#e2e8f0; --bg:#f8fafc; }
    * { box-sizing:border-box; }
    body { margin:0; font-family: "Segoe UI", Inter, system-ui, sans-serif; color:var(--ink); background:var(--bg); }
    .hero { background: linear-gradient(135deg, var(--navy), var(--navy2)); color:white; padding:40px 48px; }
    .hero h1 { margin:0; font-size:34px; letter-spacing:.02em; }
    .hero p { margin:8px 0 0; color:#dbeafe; }
    .badge { display:inline-block; margin-top:14px; padding:6px 12px; border:1px solid rgba(255,255,255,.25); border-radius:999px; font-size:12px; color:#fde68a; }
    .wrap { max-width:1080px; margin:0 auto; padding:32px 24px 64px; }
    .grid { display:grid; grid-template-columns: repeat(auto-fit,minmax(180px,1fr)); gap:14px; margin:24px 0; }
    .card { background:white; border:1px solid var(--line); border-radius:14px; padding:16px; box-shadow:0 8px 24px rgba(15,23,42,.05); }
    .card h3 { margin:0 0 6px; font-size:12px; text-transform:uppercase; letter-spacing:.08em; color:var(--muted); }
    .card .val { font-size:22px; font-weight:700; color:var(--navy); }
    section { margin-top:28px; }
    section h2 { margin:0 0 12px; font-size:20px; color:var(--navy); border-left:4px solid var(--gold); padding-left:10px; }
    .chart-grid { display:grid; grid-template-columns:1fr 1fr; gap:16px; }
    .chart-box { background:white; border:1px solid var(--line); border-radius:14px; padding:12px; }
    .chart { width:100%; height:180px; background:linear-gradient(#ffffff,#f8fafc); border-radius:10px; }
    .chart-empty { padding:24px; color:var(--muted); font-size:13px; }
    table { width:100%; border-collapse:collapse; background:white; border:1px solid var(--line); border-radius:12px; overflow:hidden; }
    th, td { padding:10px 12px; border-bottom:1px solid var(--line); font-size:13px; text-align:left; }
    th { background:#f1f5f9; color:#334155; font-size:12px; text-transform:uppercase; letter-spacing:.06em; }
    .formula { background:#0f172a; color:#e2e8f0; padding:12px 14px; border-radius:10px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size:12px; margin-top:8px; }
    .prose { line-height:1.65; color:#334155; font-size:14px; }
    .pill { display:inline-block; padding:4px 10px; border-radius:999px; background:#eff6ff; color:#1d4ed8; font-size:12px; margin-right:6px; }
    .footer { margin-top:40px; font-size:12px; color:var(--muted); }
    @media print { .wrap { max-width:none; } .chart-grid { grid-template-columns:1fr 1fr; } }
    @media (max-width:800px) { .chart-grid { grid-template-columns:1fr; } .hero { padding:28px 20px; } }
  </style>
</head>
<body>
  <header class="hero">
    <h1>${escapeHtml(data.symbol)} · Equity Research Report</h1>
    <p>${escapeHtml(data.assetName || data.symbol)} · Period ${escapeHtml(data.period)} · Generated ${escapeHtml(new Date(data.generatedAt).toLocaleString())}</p>
    <span class="badge">TradeTerm · Equity Research</span>
  </header>
  <main class="wrap">
    <div class="grid">
      <div class="card"><h3>Total Return</h3><div class="val">${fmtPct(data.pricePerformance.percentageChange)}</div></div>
      <div class="card"><h3>Annualized Return</h3><div class="val">${fmtPct(data.returns.annualizedReturnPct)}</div></div>
      <div class="card"><h3>Volatility (Ann.)</h3><div class="val">${fmtPct(data.risk.annualizedVolatilityPct)}</div></div>
      <div class="card"><h3>Max Drawdown</h3><div class="val">${fmtPct(data.risk.maximumDrawdownPct)}</div></div>
      <div class="card"><h3>Sharpe Ratio</h3><div class="val">${fmtNum(data.risk.sharpeRatio, 3)}</div></div>
      <div class="card"><h3>Sortino Ratio</h3><div class="val">${fmtNum(data.extended?.sortinoRatio, 3)}</div></div>
      <div class="card"><h3>Beta (${escapeHtml(data.risk.benchmark)})</h3><div class="val">${fmtNum(data.risk.beta, 3)}</div></div>
      <div class="card"><h3>RSI (14)</h3><div class="val">${fmtNum(data.technical.current.rsi14, 2)}</div></div>
    </div>

    <section>
      <h2>Visual Analytics</h2>
      <div class="chart-grid">
        <div class="chart-box"><strong>Price (Close)</strong>${svgLine(pricePoints, 480, 200, '#2563eb', 'Price')}</div>
        <div class="chart-box"><strong>Cumulative Return (%)</strong>${svgLine(cumPoints, 480, 200, '#059669', 'Cumulative Return')}</div>
        <div class="chart-box"><strong>RSI (14)</strong>${svgLine(rsiPoints, 480, 200, '#0891b2', 'RSI')}</div>
        <div class="chart-box"><strong>Drawdown (%)</strong>${svgLine(ddPoints, 480, 200, '#dc2626', 'Drawdown')}</div>
        <div class="chart-box" style="grid-column:1 / -1"><strong>Volume</strong>${svgBars(volPoints, 960, 200, '#6366f1', 'Volume')}</div>
      </div>
    </section>

    <section>
      <h2>Performance Details</h2>
      <table>
        <tr><th>Metric</th><th>Value</th></tr>
        <tr><td>Win Rate</td><td>${fmtPct(data.extended?.winRatePct)}</td></tr>
        <tr><td>Up / Down / Flat Days</td><td>${data.extended?.positiveDays ?? '—'} / ${data.extended?.negativeDays ?? '—'} / ${data.extended?.flatDays ?? '—'}</td></tr>
        <tr><td>Max Consecutive Gain Days</td><td>${data.extended?.maxConsecutiveGainDays ?? '—'}</td></tr>
        <tr><td>Max Consecutive Loss Days</td><td>${data.extended?.maxConsecutiveLossDays ?? '—'}</td></tr>
        <tr><td>Average True Range (H−L)</td><td>${fmtMoney(data.extended?.averageTrueRange)}</td></tr>
        <tr><td>Period Range vs Avg Close</td><td>${fmtPct(data.extended?.periodRangePct)}</td></tr>
      </table>
    </section>

    <section>
      <h2>Technical Snapshot</h2>
      <table>
        <tr><th>Signal</th><th>Reading</th><th>State</th></tr>
        ${(data.signalMatrix || [])
          .map(
            (row) => `<tr><td>${escapeHtml(row.label)}</td><td>${typeof row.value === 'number' ? fmtNum(row.value, 4) : '—'}</td><td>${escapeHtml(String(row.state))}</td></tr>`
          )
          .join('')}
      </table>
    </section>

    ${
      ai
        ? `<section>
      <h2>Research Summary</h2>
      <div class="card prose">
        <p><span class="pill">Overview</span> ${escapeHtml(ai.summary)}</p>
        <p><strong>Price:</strong> ${escapeHtml(ai.priceAnalysis)}</p>
        <p><strong>Returns:</strong> ${escapeHtml(ai.returnAnalysis)}</p>
        <p><strong>Risk:</strong> ${escapeHtml(ai.riskAnalysis)}</p>
        <p><strong>Technical:</strong> ${escapeHtml(ai.technicalAnalysis)}</p>
        <p><strong>Volume:</strong> ${escapeHtml(ai.volumeAnalysis)}</p>
        <p><strong>Highlights:</strong></p><ul>${ai.keyObservations.map((o) => `<li>${escapeHtml(o)}</li>`).join('')}</ul>
      </div>
    </section>`
        : `<section><h2>Research Summary</h2><div class="card prose">${escapeHtml(data.aiError || 'Summary unavailable.')}</div></section>`
    }

    <p class="footer">TradeTerm paper-trading platform · For academic demonstration purposes.</p>
  </main>
</body>
</html>`;
}

export function downloadAnalysisReport(data: StockAnalysisResponse) {
  const html = buildAnalysisReportHtml(data);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${data.symbol}_${data.period}_research_report.html`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function printAnalysisReport(data: StockAnalysisResponse) {
  const html = buildAnalysisReportHtml(data);
  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  win.print();
}
