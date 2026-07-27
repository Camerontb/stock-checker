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
