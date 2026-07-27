import axios from 'axios';
import pino from 'pino';

const logger = pino({
  level: 'debug',
  timestamp: pino.stdTimeFunctions.isoTime,
  transport: { target: 'pino-pretty' },
});

const COINSTATS_BASE = 'https://openapiv1.coinstats.app';

function getApiKey(): string | undefined {
  return process.env.COINSTATS_API_KEY;
}

const client = axios.create({
  baseURL: COINSTATS_BASE,
  timeout: 15_000,
});

client.interceptors.request.use((config) => {
  const key = getApiKey();
  if (key) {
    config.headers['X-API-KEY'] = key;
  }
  return config;
});

export interface CoinData {
  id: string;
  symbol: string;
  name: string;
  icon: string;
  rank: number;
  price: number;
  priceBtc: number;
  priceChange1h: number;
  priceChange1d: number;
  priceChange1w: number;
  marketCap: number;
  volume: number;
  availableSupply: number;
  totalSupply: number;
}

export interface CryptoSignal {
  id: string;
  symbol: string;
  name: string;
  icon: string;
  rank: number;
  price: number;
  priceChange1h: number;
  priceChange1d: number;
  priceChange1w: number;
  marketCap: number;
  volume: number;
  // Yahoo Finance ticker for signal engine integration
  yahooTicker: string | null;
}

/**
 * Maps a CoinStats coin ID/symbol to its Yahoo Finance ticker.
 * Yahoo uses the format BTC-USD, ETH-USD, etc.
 */
export function toYahooTicker(symbol: string): string {
  return `${symbol.toUpperCase()}-USD`;
}

/**
 * Fetch top coins from CoinStats.
 * Free tier: 2 req/s, 20k credits/month. Each call costs 1-2 credits.
 */
export async function getCoins(limit = 50): Promise<CoinData[]> {
  if (!getApiKey()) {
    logger.warn('COINSTATS_API_KEY not set — returning empty coin list');
    return [];
  }

  try {
    const res = await client.get('/coins', {
      params: { limit, currency: 'USD' },
    });
    return res.data?.result ?? [];
  } catch (error) {
    logger.error({ err: error }, 'CoinStats /coins failed');
    return [];
  }
}

/**
 * Fetch a single coin by ID (e.g., 'bitcoin', 'ethereum').
 */
export async function getCoin(coinId: string): Promise<CoinData | null> {
  if (!getApiKey()) {
    logger.warn('COINSTATS_API_KEY not set — returning null');
    return null;
  }

  try {
    const res = await client.get(`/coins/${coinId}`);
    return res.data ?? null;
  } catch (error) {
    logger.error({ err: error, coinId }, 'CoinStats /coins/:id failed');
    return null;
  }
}

// ── Portfolio Holdings ──────────────────────────────────────

export interface PortfolioHolding {
  symbol: string;
  name: string;
  icon: string;
  rank: number;
  count: number;
  priceUsd: number;
  valueUsd: number;
  avgBuyPriceUsd: number;
  unrealizedPnlUsd: number;
  unrealizedPnlPct: number;
  priceChange24h: number;
  priceChange1h: number;
  priceChange7d: number;
  yahooTicker: string;
}

export interface PortfolioSummary {
  totalValue: number;
  totalCost: number;
  unrealizedPnl: number;
  unrealizedPnlPct: number;
  holdings: PortfolioHolding[];
}

function getShareToken(): string | undefined {
  return process.env.COINSTATS_PORTFOLIO_TOKEN;
}

/**
 * Fetch the user's portfolio holdings from CoinStats.
 * Requires COINSTATS_PORTFOLIO_TOKEN (share token from portfolio share link).
 */
export async function getPortfolioHoldings(): Promise<PortfolioSummary | null> {
  const apiKey = getApiKey();
  const shareToken = getShareToken();

  if (!apiKey || !shareToken) {
    logger.warn('COINSTATS_API_KEY or COINSTATS_PORTFOLIO_TOKEN not set');
    return null;
  }

  try {
    const [valueRes, coinsRes] = await Promise.all([
      client.get('/portfolio/value', { params: { shareToken } }),
      client.get('/portfolio/coins', { params: { shareToken } }),
    ]);

    const summary = valueRes.data;
    const coins = coinsRes.data?.result ?? [];

    const holdings: PortfolioHolding[] = coins
      .filter((c: Record<string, unknown>) => {
        const count = c.count as number;
        const price = (c.price as Record<string, number>)?.USD ?? 0;
        // Filter out dust (< $0.01 value)
        return count * price >= 0.01;
      })
      .map((c: Record<string, unknown>) => {
        const coin = c.coin as Record<string, unknown>;
        const price = (c.price as Record<string, number>)?.USD ?? 0;
        const count = c.count as number;
        const profit = c.profit as Record<string, Record<string, number>>;
        const profitPct = c.profitPercent as Record<string, Record<string, number>>;
        const avgBuy = c.averageBuy as Record<string, Record<string, number>>;

        return {
          symbol: coin.symbol as string,
          name: coin.name as string,
          icon: coin.icon as string,
          rank: coin.rank as number,
          count,
          priceUsd: price,
          valueUsd: count * price,
          avgBuyPriceUsd: avgBuy?.unrealized?.USD ?? avgBuy?.allTime?.USD ?? 0,
          unrealizedPnlUsd: profit?.unrealized?.USD ?? 0,
          unrealizedPnlPct: profitPct?.unrealized?.USD ?? 0,
          priceChange24h: (coin.priceChange24h as number) ?? 0,
          priceChange1h: (coin.priceChange1h as number) ?? 0,
          priceChange7d: (coin.priceChange7d as number) ?? 0,
          yahooTicker: toYahooTicker(coin.symbol as string),
        };
      })
      .sort((a: PortfolioHolding, b: PortfolioHolding) => b.valueUsd - a.valueUsd);

    return {
      totalValue: summary.totalValue ?? 0,
      totalCost: summary.totalCost ?? 0,
      unrealizedPnl: summary.unrealizedProfitLoss ?? 0,
      unrealizedPnlPct: summary.unrealizedProfitLossPercent ?? 0,
      holdings,
    };
  } catch (error) {
    logger.error({ err: error }, 'CoinStats portfolio fetch failed');
    return null;
  }
}

/**
 * Convert CoinStats data to a format compatible with the signals page.
 * The Yahoo Finance ticker allows the signal engine to run analysis.
 */
export function toCryptoSignal(coin: CoinData): CryptoSignal {
  return {
    id: coin.id,
    symbol: coin.symbol,
    name: coin.name,
    icon: coin.icon,
    rank: coin.rank,
    price: coin.price,
    priceChange1h: coin.priceChange1h ?? 0,
    priceChange1d: coin.priceChange1d ?? 0,
    priceChange1w: coin.priceChange1w ?? 0,
    marketCap: coin.marketCap,
    volume: coin.volume,
    yahooTicker: toYahooTicker(coin.symbol),
  };
}
