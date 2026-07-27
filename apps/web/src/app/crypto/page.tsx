import { SignalFilters } from '@/components/signal-filters';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  getCryptoCoins,
  getCryptoSignals,
  getPortfolio,
  getWatchlist,
} from '@/lib/api';
import type { CryptoAnalysisResult, CryptoSignalResult, TickerResult } from '@/lib/api';
import { cn, formatMarketCap } from '@/lib/utils';

/**
 * Default crypto symbols to analyze — top coins by market cap.
 * The signal engine runs on these via Yahoo Finance (BTC-USD, ETH-USD, etc.).
 */
const DEFAULT_CRYPTO = [
  'BTC', 'ETH', 'SOL', 'XRP', 'BNB',
  'ADA', 'DOGE', 'AVAX', 'DOT', 'LINK',
  'MATIC', 'UNI', 'ATOM', 'LTC', 'NEAR',
];

function CryptoSkeleton() {
  return (
    <div className="space-y-3" role="status" aria-live="polite" aria-label="Loading crypto data">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex gap-2 px-2 py-1.5">
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-20" />
        </div>
      ))}
    </div>
  );
}

function changeColor(pct: number): string {
  if (pct > 0) return 'text-success';
  if (pct < 0) return 'text-destructive';
  return 'text-muted-foreground';
}

function formatPct(pct: number): string {
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${pct.toFixed(2)}%`;
}

export default async function CryptoPage() {
  let coins: CryptoSignalResult[] = [];
  let signals: CryptoAnalysisResult[] = [];
  let portfolioTickers: string[] = [];
  let watchlistTickers: string[] = [];
  let error: string | null = null;

  try {
    const [coinsData, signalsData, portfolio, watchlist] = await Promise.all([
      getCryptoCoins(30).catch(() => [] as CryptoSignalResult[]),
      getCryptoSignals(DEFAULT_CRYPTO),
      getPortfolio().catch(() => [] as string[]),
      getWatchlist().catch(() => [] as string[]),
    ]);

    coins = coinsData;
    signals = signalsData;
    portfolioTickers = portfolio;
    watchlistTickers = watchlist;
  } catch (err) {
    error = err instanceof Error ? err.message : 'Failed to fetch crypto data';
  }

  const buySignals = signals.filter((s) => s.opinion === 'BUY');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-sm font-bold font-mono tracking-widest text-primary">
            CRYPTO SIGNALS
          </h1>
          <p className="text-[10px] font-mono text-muted-foreground mt-0.5">
            {signals.length} analyzed — {buySignals.length} BUY signal{buySignals.length !== 1 ? 's' : ''} — powered by CoinStats + signal engine
          </p>
        </div>
        <span className="text-xs font-mono text-muted-foreground">
          {new Date().toISOString().split('T')[0]}
        </span>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTitle className="font-mono text-xs font-bold">ERROR</AlertTitle>
          <AlertDescription className="font-mono text-xs">{error}</AlertDescription>
        </Alert>
      )}

      {/* Market overview from CoinStats */}
      {coins.length > 0 && (
        <Card className="overflow-hidden">
          <CardHeader className="border-b border-border py-1.5 px-3">
            <span className="text-[10px] font-mono font-bold tracking-widest text-primary">
              MARKET OVERVIEW — TOP {coins.length}
            </span>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table aria-label="Crypto market overview">
                <TableHeader>
                  <TableRow>
                    <TableHead className="font-mono text-xs text-muted-foreground">#</TableHead>
                    <TableHead className="font-mono text-xs text-muted-foreground">COIN</TableHead>
                    <TableHead className="font-mono text-xs text-muted-foreground text-right">PRICE</TableHead>
                    <TableHead className="font-mono text-xs text-muted-foreground text-right">1H</TableHead>
                    <TableHead className="font-mono text-xs text-muted-foreground text-right">24H</TableHead>
                    <TableHead className="font-mono text-xs text-muted-foreground text-right">7D</TableHead>
                    <TableHead className="font-mono text-xs text-muted-foreground text-right">MKT CAP</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {coins.slice(0, 20).map((coin) => (
                    <TableRow key={coin.id}>
                      <TableCell className="font-mono text-xs text-muted-foreground tabular-nums">
                        {coin.rank}
                      </TableCell>
                      <TableCell className="font-mono text-xs font-bold">
                        {coin.symbol}
                        <span className="ml-1.5 text-muted-foreground font-normal">{coin.name}</span>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-right tabular-nums">
                        ${coin.price < 1 ? coin.price.toPrecision(4) : coin.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className={cn('font-mono text-xs text-right tabular-nums', changeColor(coin.priceChange1h))}>
                        {formatPct(coin.priceChange1h)}
                      </TableCell>
                      <TableCell className={cn('font-mono text-xs text-right tabular-nums', changeColor(coin.priceChange1d))}>
                        {formatPct(coin.priceChange1d)}
                      </TableCell>
                      <TableCell className={cn('font-mono text-xs text-right tabular-nums', changeColor(coin.priceChange1w))}>
                        {formatPct(coin.priceChange1w)}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-right tabular-nums text-muted-foreground">
                        {formatMarketCap(coin.marketCap)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Signal engine results */}
      {signals.length > 0 ? (
        <>
          <Card className="overflow-hidden">
            <CardHeader className="border-b border-border py-1.5 px-3">
              <span className="text-[10px] font-mono font-bold tracking-widest text-primary">
                SIGNAL ENGINE RESULTS
              </span>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table aria-label="Crypto signal analysis">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="font-mono text-xs text-muted-foreground">TICKER</TableHead>
                      <TableHead className="font-mono text-xs text-muted-foreground text-right">CLOSE</TableHead>
                      <TableHead className="font-mono text-xs text-muted-foreground text-right">RSI</TableHead>
                      <TableHead className="font-mono text-xs text-muted-foreground text-right">SCORE</TableHead>
                      <TableHead className="font-mono text-xs text-muted-foreground">SIGNAL</TableHead>
                      <TableHead className="font-mono text-xs text-muted-foreground">TREND</TableHead>
                      <TableHead className="font-mono text-xs text-muted-foreground text-right">INST</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {signals.map((s) => (
                      <TableRow
                        key={s.ticker}
                        className={cn(
                          'border-l-2',
                          s.opinion === 'BUY' ? 'border-l-success' :
                          s.opinion === 'SELL' ? 'border-l-destructive' :
                          'border-l-transparent'
                        )}
                      >
                        <TableCell className="font-mono text-xs font-bold">
                          {s.cryptoSymbol}
                          <span className="ml-1 text-muted-foreground font-normal text-[10px]">
                            {s.ticker}
                          </span>
                        </TableCell>
                        <TableCell className="font-mono text-xs text-right tabular-nums">
                          ${s.close < 1 ? s.close.toPrecision(4) : s.close.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className={cn(
                          'font-mono text-xs text-right tabular-nums',
                          s.rsi >= 70 ? 'text-destructive' : s.rsi <= 30 ? 'text-success' : 'text-foreground'
                        )}>
                          {s.rsi.toFixed(1)}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-right tabular-nums">
                          {Math.round(s.score)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={cn(
                              'font-mono tracking-widest rounded-sm text-xs font-bold',
                              s.opinion === 'BUY' ? 'bg-success text-success-foreground border-transparent' :
                              s.opinion === 'SELL' ? 'bg-destructive/10 text-destructive border-transparent' :
                              'bg-muted text-muted-foreground border-transparent'
                            )}
                          >
                            {s.opinion}
                          </Badge>
                        </TableCell>
                        <TableCell className={cn(
                          'font-mono text-xs uppercase',
                          s.trendRegime === 'uptrend' ? 'text-success' :
                          s.trendRegime === 'downtrend' ? 'text-destructive' :
                          'text-muted-foreground'
                        )}>
                          {s.trendRegime ?? '—'}
                        </TableCell>
                        <TableCell className={cn(
                          'font-mono text-xs text-right tabular-nums',
                          s.institutionalPassed ? 'text-success font-bold' : 'text-muted-foreground'
                        )}>
                          {s.institutionalScore != null ? s.institutionalScore.toFixed(2) : '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* BUY signals as cards */}
          {buySignals.length > 0 && (
            <div>
              <h2 className="text-xs font-bold font-mono tracking-widest text-success mb-3">
                BUY SIGNALS — {buySignals.length} CRYPTO
              </h2>
              <SignalFilters
                results={buySignals as TickerResult[]}
                portfolioTickers={portfolioTickers}
                watchlistTickers={watchlistTickers}
              />
            </div>
          )}
        </>
      ) : !error ? (
        <CryptoSkeleton />
      ) : null}
    </div>
  );
}
