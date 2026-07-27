import { toCryptoSignal, toYahooTicker } from '@stock-checker/core/src/services/coinstats';
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
};
