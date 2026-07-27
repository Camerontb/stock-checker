import {
  getPortfolioHoldings,
  toCryptoSignal,
  toYahooTicker,
} from '@stock-checker/core/src/services/coinstats';
import type { FastifyPluginAsync } from 'fastify';
import { cachedAnalyzeTicker } from '@/lib/cached/analyze';
import { cachedCryptoCoins } from '@/lib/cached/crypto';
import { cachedFearGreed } from '@/lib/cached/market';

interface CryptoQuery {
  limit?: string;
}

interface CryptoSignalsQuery {
  symbols?: string;
}

export const cryptoRoutes: FastifyPluginAsync = async (app) => {
  /**
   * GET /api/crypto/coins?limit=50
   * Returns top coins from CoinStats with market data.
   */
  app.get<{ Querystring: CryptoQuery }>('/crypto/coins', async (req, reply) => {
    try {
      const limit = Math.min(Number(req.query.limit ?? 50), 100);
      const coins = await cachedCryptoCoins(limit);
      const signals = coins.map(toCryptoSignal);

      return reply.send({
        results: signals,
        generatedAt: new Date().toISOString(),
      });
    } catch (error) {
      req.log.error({ err: error }, 'crypto coins failed');
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * GET /api/crypto/signals?symbols=BTC,ETH,SOL
   * Runs the stock-checker signal engine on crypto via Yahoo Finance tickers.
   * Maps BTC → BTC-USD, runs the full pipeline (RSI, MACD, patterns, etc.).
   */
  app.get<{ Querystring: CryptoSignalsQuery }>('/crypto/signals', async (req, reply) => {
    try {
      const symbols = req.query.symbols
        ? req.query.symbols
            .split(',')
            .map((s) => s.trim().toUpperCase())
            .filter(Boolean)
        : ['BTC', 'ETH', 'SOL', 'XRP', 'ADA', 'DOGE', 'AVAX', 'DOT', 'LINK', 'MATIC'];

      const yahooTickers = symbols.map(toYahooTicker);

      const fearGreed = await cachedFearGreed();

      const settled = await Promise.allSettled(
        yahooTickers.map((ticker) => cachedAnalyzeTicker(ticker, fearGreed))
      );

      const results = settled
        .map((r, i) => {
          if (r.status !== 'fulfilled' || !r.value) return null;
          return {
            ...r.value,
            cryptoSymbol: symbols[i],
            name: r.value.name ?? symbols[i],
          };
        })
        .filter((r) => r !== null);

      return reply.send({
        results,
        fearGreed,
        generatedAt: new Date().toISOString(),
      });
    } catch (error) {
      req.log.error({ err: error }, 'crypto signals failed');
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * GET /api/crypto/portfolio
   * Fetches the user's CoinStats portfolio holdings + runs signal engine
   * on each holding. Returns holdings with values, P&L, and buy/sell signals.
   */
  app.get('/crypto/portfolio', async (req, reply) => {
    try {
      const portfolio = await getPortfolioHoldings();

      if (!portfolio) {
        return reply.status(404).send({
          error: 'Portfolio not available. Set COINSTATS_API_KEY and COINSTATS_PORTFOLIO_TOKEN in .env',
        });
      }

      // Run signal engine on each holding (skip stablecoins)
      const stablecoins = new Set(['USDT', 'USDC', 'DAI', 'BUSD', 'BSC-USD']);
      const tradableHoldings = portfolio.holdings.filter(
        (h) => !stablecoins.has(h.symbol)
      );

      const fearGreed = await cachedFearGreed();

      const settled = await Promise.allSettled(
        tradableHoldings.map((h) => cachedAnalyzeTicker(h.yahooTicker, fearGreed))
      );

      const holdingsWithSignals = portfolio.holdings.map((holding) => {
        if (stablecoins.has(holding.symbol)) {
          return { ...holding, signal: null };
        }

        const idx = tradableHoldings.findIndex((h) => h.symbol === holding.symbol);
        if (idx === -1) return { ...holding, signal: null };

        const result = settled[idx];
        const signal =
          result.status === 'fulfilled' && result.value
            ? {
                opinion: result.value.opinion,
                score: result.value.score,
                rsi: result.value.rsi,
                trendRegime: result.value.trendRegime,
                institutionalScore: result.value.institutionalScore,
                institutionalPassed: result.value.institutionalPassed,
                stopLoss: result.value.stopLoss,
                takeProfit: result.value.takeProfit,
                trailingStop: result.value.trailingStop,
                patterns: result.value.patterns,
                confidence: result.value.confidence,
              }
            : null;

        return { ...holding, signal };
      });

      return reply.send({
        totalValue: portfolio.totalValue,
        totalCost: portfolio.totalCost,
        unrealizedPnl: portfolio.unrealizedPnl,
        unrealizedPnlPct: portfolio.unrealizedPnlPct,
        holdings: holdingsWithSignals,
        generatedAt: new Date().toISOString(),
      });
    } catch (error) {
      req.log.error({ err: error }, 'crypto portfolio failed');
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
};
