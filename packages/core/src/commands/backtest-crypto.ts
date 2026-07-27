/**
 * Crypto backtest — runs the SAME signal engine (institutional pipeline +
 * quality gate) against major crypto pairs to test whether the equity-validated
 * strategy holds up on crypto.
 *
 * Adaptations vs the stock backtest (documented, not hidden):
 *  - Benchmark: BTC-USD serves as the "market" AND "sector" benchmark for alts
 *    (RS = is this coin outperforming the crypto market leader). For BTC itself
 *    the benchmark is SPY (BTC vs traditional market).
 *  - Extra gate variants with relaxed ATR% caps — crypto's baseline volatility
 *    is far above the 3.5% equity cap, so the shipped gate may block everything.
 *
 * Run: cd packages/core && bun src/commands/backtest-crypto.ts
 */
import {
  DEFAULT_INSTITUTIONAL_PIPELINE_CONFIG,
  DEFAULT_QUALITY_PIPELINE_CONFIG,
  DEFAULT_ROUND_TRIP_COST_PCT,
} from '@/constants';
import { DataLoader } from '@/optimization/data-loader';
import {
  type BacktestSignal,
  buildTickerContext,
  measure5DayWinRate,
  runSignalsWithContext,
  type TickerContext,
  type WinRateResult,
} from '@/optimization/engine';
import type { BenchmarkCandle, PipelineConfig } from '@/types';

const HISTORY_DAYS = 2920; // 8 years, same window as the stock backtest

const CRYPTO_TICKERS = [
  'BTC-USD',
  'ETH-USD',
  'SOL-USD',
  'BNB-USD',
  'XRP-USD',
  'ADA-USD',
  'DOGE-USD',
  'AVAX-USD',
  'DOT-USD',
  'LINK-USD',
  'LTC-USD',
  'ATOM-USD',
];

async function main() {
  const COST_PCT = DEFAULT_ROUND_TRIP_COST_PCT;
  console.log('CRYPTO BACKTEST — same engine, crypto universe');
  console.log(`Cost model: ${(COST_PCT * 100).toFixed(0)}bps round-trip per trade\n`);

  // ── Load data ────────────────────────────────────────────────
  const allData = new Map<
    string,
    { date: Date; open: number; high: number; low: number; close: number; volume: number }[]
  >();
  for (const ticker of CRYPTO_TICKERS) {
    try {
      const data = await DataLoader.loadHistoricalData(ticker, HISTORY_DAYS);
      if (data.length >= 210) {
        allData.set(ticker, data);
        console.log(
          `  ${ticker}: ${data.length} bars (${data[0].date.toISOString().slice(0, 10)} ~ ${data[data.length - 1].date.toISOString().slice(0, 10)})`
        );
      } else {
        console.log(`  ${ticker}: ${data.length} bars (skipped, < 210)`);
      }
    } catch (e) {
      console.log(`  ${ticker}: failed (${e instanceof Error ? e.message : e})`);
    }
  }
  console.log(`Loaded ${allData.size} tickers\n`);

  // Benchmarks
  let spyData: BenchmarkCandle[] = [];
  try {
    spyData = await DataLoader.loadHistoricalData('SPY', HISTORY_DAYS);
  } catch {
    /* keep empty */
  }
  const btcData = allData.get('BTC-USD') ?? [];
  const btcBench: BenchmarkCandle[] = btcData.map((d) => ({
    date: d.date,
    close: d.close,
    volume: d.volume,
    high: d.high,
    low: d.low,
  }));

  // Price map for win-rate measurement
  const priceData = new Map<string, { date: Date; close: number }[]>();
  for (const [ticker, data] of allData) {
    priceData.set(
      ticker,
      data.map((d) => ({ date: d.date, close: d.close }))
    );
  }

  // Contexts: BTC benchmarked vs SPY; alts benchmarked vs BTC
  const ctxMap = new Map<string, TickerContext>();
  for (const [ticker, data] of allData) {
    const bench = ticker === 'BTC-USD' ? spyData : btcBench;
    const ctx = buildTickerContext(data, bench, bench);
    if (ctx) ctxMap.set(ticker, ctx);
  }
  console.log(`Built context for ${ctxMap.size} tickers\n`);

  // ── Base rate: how often is ANY 5-day hold profitable? ───────
  let baseUp = 0;
  let baseN = 0;
  for (const [, ctx] of ctxMap) {
    const c = ctx.closes;
    for (let i = 205; i + 5 < c.length; i++) {
      baseN++;
      if (c[i + 5] > c[i] * (1 + COST_PCT / 100)) baseUp++;
    }
  }
  const baseRate = baseN > 0 ? (baseUp / baseN) * 100 : 0;
  console.log(
    `Base rate (all bars, 5d hold net of costs): ${baseRate.toFixed(1)}% — any strategy must beat this\n`
  );

  // ── Configs ──────────────────────────────────────────────────
  const configs: { name: string; config: PipelineConfig }[] = [
    { name: 'V5 institutional (no gate)', config: { ...DEFAULT_INSTITUTIONAL_PIPELINE_CONFIG } },
    { name: 'V10 shipped gate (equity)', config: { ...DEFAULT_QUALITY_PIPELINE_CONFIG } },
    {
      name: 'Gate atr<6 (crypto vol)',
      config: {
        ...DEFAULT_QUALITY_PIPELINE_CONFIG,
        qualityGate: { ...DEFAULT_QUALITY_PIPELINE_CONFIG.qualityGate, atrPctMax: 6 },
      },
    },
    {
      name: 'Gate atr<8',
      config: {
        ...DEFAULT_QUALITY_PIPELINE_CONFIG,
        qualityGate: { ...DEFAULT_QUALITY_PIPELINE_CONFIG.qualityGate, atrPctMax: 8 },
      },
    },
    {
      name: 'Gate atr<6 rs.5',
      config: {
        ...DEFAULT_QUALITY_PIPELINE_CONFIG,
        qualityGate: {
          ...DEFAULT_QUALITY_PIPELINE_CONFIG.qualityGate,
          atrPctMax: 6,
          rsMin: 0.5,
        },
      },
    },
    {
      name: 'Gate atr<8 rs.5 ibs.3',
      config: {
        ...DEFAULT_QUALITY_PIPELINE_CONFIG,
        qualityGate: {
          ...DEFAULT_QUALITY_PIPELINE_CONFIG.qualityGate,
          atrPctMax: 8,
          rsMin: 0.5,
          ibsMax: 0.3,
        },
      },
    },
  ];

  console.log(
    `${'Config'.padEnd(28)} | ${'WinRate'.padStart(8)} | ${'vs base'.padStart(8)} | ${'N'.padStart(6)} | ${'AvgRet'.padStart(8)} | ${'R/R'.padStart(6)}`
  );
  console.log('-'.repeat(80));

  const resultsByName = new Map<string, { signals: BacktestSignal[]; result: WinRateResult }>();
  for (const { name, config } of configs) {
    const signals: BacktestSignal[] = [];
    for (const [ticker, ctx] of ctxMap) {
      signals.push(...runSignalsWithContext(ctx, ticker, config));
    }
    const result = measure5DayWinRate(signals, priceData, COST_PCT);
    resultsByName.set(name, { signals, result });
    console.log(
      `${name.padEnd(28)} | ${`${result.winRate5d.toFixed(1)}%`.padStart(8)} | ${`${(result.winRate5d - baseRate).toFixed(1)}pp`.padStart(8)} | ${String(result.totalSignals).padStart(6)} | ${`${result.avgReturn.toFixed(2)}%`.padStart(8)} | ${result.rewardRisk.toFixed(2).padStart(6)}`
    );
  }

  // ── Detail on the best-N config: per year + per ticker ───────
  for (const [name, { signals, result }] of resultsByName) {
    if (result.totalSignals < 10) continue;
    console.log(`\n📊 ${name} — detail (N=${result.totalSignals}):`);
    const years = [...new Set(signals.map((s) => s.date.toISOString().slice(0, 4)))].sort();
    console.log('  By entry year:');
    for (const yr of years) {
      const sub = signals.filter(
        (s) => s.decision === 'BUY' && s.date.toISOString().slice(0, 4) === yr
      );
      if (sub.length === 0) continue;
      const r = measure5DayWinRate(sub, priceData, COST_PCT);
      if (r.totalSignals === 0) continue;
      console.log(
        `    ${yr}: WR=${r.winRate5d.toFixed(1)}%  R/R=${r.rewardRisk.toFixed(2)}  N=${r.totalSignals}  avgRet=${r.avgReturn.toFixed(2)}%`
      );
    }
    console.log('  By ticker:');
    for (const ticker of [...ctxMap.keys()]) {
      const sub = signals.filter((s) => s.decision === 'BUY' && s.ticker === ticker);
      if (sub.length === 0) continue;
      const r = measure5DayWinRate(sub, priceData, COST_PCT);
      if (r.totalSignals === 0) continue;
      console.log(
        `    ${ticker.padEnd(10)}: WR=${r.winRate5d.toFixed(1)}%  R/R=${r.rewardRisk.toFixed(2)}  N=${r.totalSignals}  avgRet=${r.avgReturn.toFixed(2)}%`
      );
    }
  }

  console.log('\nDone. Read WR relative to the base rate — crypto drifts, so raw WR flatters.');
}

await main();
