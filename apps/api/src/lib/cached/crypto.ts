import { type CoinData, getCoins } from '@stock-checker/core/src/services/coinstats';
import { MINUTE, cacheStore, ttlUnlessEmpty } from '@/lib/cache';

const CRYPTO_TTL = 5 * MINUTE;

cacheStore.define(
  'cryptoCoins',
  {
    serialize: ({ limit }: { limit: number }) => `coins:${limit}`,
    ttl: ttlUnlessEmpty(CRYPTO_TTL, (v: CoinData[]) => !v || v.length === 0),
  },
  ({ limit }: { limit: number }) => getCoins(limit)
);

export function cachedCryptoCoins(limit = 50): Promise<CoinData[]> {
  return (cacheStore as Record<string, CallableFunction>).cryptoCoins({ limit });
}
