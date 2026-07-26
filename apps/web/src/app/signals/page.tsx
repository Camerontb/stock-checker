import { SignalFilters } from '@/components/signal-filters';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { getPortfolio, getScreener, getWatchlist } from '@/lib/api';
import type { TickerResult } from '@/lib/api';

/**
 * Broad ticker universe — the same set the screener page scans.
 * In a future phase this can be expanded to the full 546-ticker backtest
 * universe via a dedicated /api/screener/scan endpoint.
 */
const SCAN_TICKERS = [
  'TSLA',
  'PLTR',
  'GOOGL',
  'NVDA',
  'AAPL',
  'META',
  'AMD',
  'MSFT',
  'AMZN',
  'NFLX',
  'CRWD',
  'NET',
  'DDOG',
  'COIN',
  'SOFI',
  'XYZ',
  'SHOP',
  'UBER',
  'SNAP',
  'PINS',
];

function SignalsSkeleton() {
  return (
    <div className="space-y-3" role="status" aria-live="polite" aria-label="Loading signals">
      <Card>
        <CardContent className="p-3">
          <div className="flex gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-7 w-20" />
            ))}
          </div>
        </CardContent>
      </Card>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-3 space-y-3">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-6 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default async function SignalsPage() {
  let allResults: TickerResult[] = [];
  let buySignals: TickerResult[] = [];
  let portfolioTickers: string[] = [];
  let watchlistTickers: string[] = [];
  let error: string | null = null;

  try {
    const [screenerResults, portfolio, watchlist] = await Promise.all([
      getScreener(SCAN_TICKERS),
      getPortfolio().catch(() => [] as string[]),
      getWatchlist().catch(() => [] as string[]),
    ]);

    allResults = screenerResults;
    buySignals = screenerResults.filter((r) => r.opinion === 'BUY');
    portfolioTickers = portfolio;
    watchlistTickers = watchlist;
  } catch (err) {
    error = err instanceof Error ? err.message : 'Failed to fetch signals';
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-sm font-bold font-mono tracking-widest text-primary">
            BUY SIGNALS
          </h1>
          <p className="text-[10px] font-mono text-muted-foreground mt-0.5">
            {buySignals.length} BUY of {allResults.length} scanned — quality gate filtered
          </p>
        </div>
        <span className="text-xs font-mono text-muted-foreground">
          {new Date().toISOString().split('T')[0]}
        </span>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle className="font-mono text-xs font-bold">ERROR</AlertTitle>
          <AlertDescription className="font-mono text-xs">{error}</AlertDescription>
        </Alert>
      ) : allResults.length === 0 ? (
        <SignalsSkeleton />
      ) : (
        <SignalFilters
          results={buySignals}
          portfolioTickers={portfolioTickers}
          watchlistTickers={watchlistTickers}
        />
      )}
    </div>
  );
}
