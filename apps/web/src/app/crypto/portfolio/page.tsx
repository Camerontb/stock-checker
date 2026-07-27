import Link from 'next/link';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { getCryptoPortfolio } from '@/lib/api';
import type { CryptoPortfolioResult, PortfolioHoldingResult } from '@/lib/api';
import { cn, formatMarketCap } from '@/lib/utils';

function formatUsd(value: number): string {
  return value.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
}

function formatPct(pct: number): string {
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${pct.toFixed(2)}%`;
}

function pnlColor(value: number): string {
  if (value > 0) return 'text-success';
  if (value < 0) return 'text-destructive';
  return 'text-muted-foreground';
}

function signalBg(opinion: string): string {
  if (opinion === 'BUY') return 'bg-success text-success-foreground border-transparent';
  if (opinion === 'SELL') return 'bg-destructive/10 text-destructive border-transparent';
  return 'bg-muted text-muted-foreground border-transparent';
}

function signalBorder(opinion: string | undefined): string {
  if (opinion === 'BUY') return 'border-l-success';
  if (opinion === 'SELL') return 'border-l-destructive';
  return 'border-l-transparent';
}

function actionText(opinion: string, symbol: string): string {
  switch (opinion) {
    case 'BUY':
      return `Accumulate ${symbol} — institutional flow positive, trend and momentum aligned. Consider adding to position on pullbacks.`;
    case 'SELL':
      return `Reduce ${symbol} exposure — distribution detected, trend breaking down. Consider taking profits or tightening stops.`;
    case 'HOLD':
      return `Hold ${symbol} — no clear entry or exit signal. Wait for quality gate conditions to align before acting.`;
    default:
      return `Monitor ${symbol} — insufficient data for a signal.`;
  }
}

function PortfolioSkeleton() {
  return (
    <div className="space-y-3" role="status" aria-live="polite" aria-label="Loading portfolio">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}><CardContent className="p-3"><Skeleton className="h-12 w-full" /></CardContent></Card>
        ))}
      </div>
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i}><CardContent className="p-3 space-y-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </CardContent></Card>
      ))}
    </div>
  );
}

function HoldingCard({ holding }: { holding: PortfolioHoldingResult }) {
  const signal = holding.signal;
  const isStable = !signal && (holding.symbol === 'USDT' || holding.symbol === 'USDC' || holding.symbol === 'DAI' || holding.symbol === 'BUSD' || holding.symbol === 'BSC-USD');

  return (
    <Card className={cn('overflow-hidden border-l-2', signalBorder(signal?.opinion))}>
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {holding.icon && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={holding.icon} alt={holding.symbol} className="w-6 h-6 rounded-full" />
            )}
            <div>
              <span className="font-mono font-bold text-sm">{holding.symbol}</span>
              <span className="font-mono text-[10px] text-muted-foreground ml-1.5">{holding.name}</span>
            </div>
          </div>
          {signal && (
            <Badge className={cn('font-mono tracking-widest rounded-sm text-xs font-bold', signalBg(signal.opinion))}>
              {signal.opinion}
            </Badge>
          )}
          {isStable && (
            <Badge variant="outline" className="font-mono text-[10px] text-muted-foreground">STABLE</Badge>
          )}
        </div>

        {/* Holdings value */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-[10px]">
          <div>
            <span className="text-muted-foreground block">QUANTITY</span>
            <span className="text-foreground tabular-nums font-bold text-xs">
              {holding.count < 0.01 ? holding.count.toPrecision(4) : holding.count.toLocaleString('en-US', { maximumFractionDigits: 4 })}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground block">PRICE</span>
            <span className="text-foreground tabular-nums text-xs">
              {formatUsd(holding.priceUsd)}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground block">VALUE</span>
            <span className="text-foreground tabular-nums font-bold text-xs">
              {formatUsd(holding.valueUsd)}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground block">AVG BUY</span>
            <span className="text-foreground tabular-nums text-xs">
              {holding.avgBuyPriceUsd > 0 ? formatUsd(holding.avgBuyPriceUsd) : '—'}
            </span>
          </div>
        </div>

        {/* P&L row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-[10px]">
          <div>
            <span className="text-muted-foreground block">UNREALIZED P&L</span>
            <span className={cn('tabular-nums font-bold text-xs', pnlColor(holding.unrealizedPnlUsd))}>
              {formatUsd(holding.unrealizedPnlUsd)}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground block">P&L %</span>
            <span className={cn('tabular-nums text-xs', pnlColor(holding.unrealizedPnlPct))}>
              {formatPct(holding.unrealizedPnlPct)}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground block">24H</span>
            <span className={cn('tabular-nums text-xs', pnlColor(holding.priceChange24h))}>
              {formatPct(holding.priceChange24h)}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground block">7D</span>
            <span className={cn('tabular-nums text-xs', pnlColor(holding.priceChange7d))}>
              {formatPct(holding.priceChange7d)}
            </span>
          </div>
        </div>

        {/* Signal analysis */}
        {signal && (
          <>
            <Separator />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-[10px]">
              <div>
                <span className="text-muted-foreground block">SCORE</span>
                <span className="text-foreground tabular-nums font-bold text-xs">{Math.round(signal.score)}</span>
              </div>
              <div>
                <span className="text-muted-foreground block">RSI</span>
                <span className={cn(
                  'tabular-nums text-xs',
                  signal.rsi >= 70 ? 'text-destructive' : signal.rsi <= 30 ? 'text-success' : 'text-foreground'
                )}>
                  {signal.rsi.toFixed(1)}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block">TREND</span>
                <span className={cn(
                  'uppercase text-xs font-bold',
                  signal.trendRegime === 'uptrend' ? 'text-success' :
                  signal.trendRegime === 'downtrend' ? 'text-destructive' :
                  'text-muted-foreground'
                )}>
                  {signal.trendRegime ?? '—'}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block">INST</span>
                <span className={cn(
                  'tabular-nums text-xs',
                  signal.institutionalPassed ? 'text-success font-bold' : 'text-muted-foreground'
                )}>
                  {signal.institutionalScore != null ? signal.institutionalScore.toFixed(2) : '—'}
                </span>
              </div>
            </div>

            {/* Risk levels */}
            <div className="grid grid-cols-3 gap-3 font-mono text-[10px]">
              <div>
                <span className="text-muted-foreground block">STOP</span>
                <span className="tabular-nums text-destructive text-xs">{formatUsd(signal.stopLoss)}</span>
              </div>
              <div>
                <span className="text-muted-foreground block">TARGET</span>
                <span className="tabular-nums text-success text-xs">{formatUsd(signal.takeProfit)}</span>
              </div>
              <div>
                <span className="text-muted-foreground block">TRAIL</span>
                <span className="tabular-nums text-foreground text-xs">{formatUsd(signal.trailingStop)}</span>
              </div>
            </div>

            {/* Action recommendation */}
            <Separator />
            <div className="font-mono text-[10px]">
              <span className="text-muted-foreground block mb-1">RECOMMENDATION</span>
              <p className={cn(
                'text-xs leading-relaxed',
                signal.opinion === 'BUY' ? 'text-success' :
                signal.opinion === 'SELL' ? 'text-destructive' :
                'text-foreground'
              )}>
                {actionText(signal.opinion, holding.symbol)}
              </p>
            </div>

            {/* Patterns */}
            {signal.patterns.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {signal.patterns.map((p) => (
                  <Badge key={p} variant="outline" className="font-mono text-[10px] px-1.5 py-0.5">
                    {p}
                  </Badge>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default async function CryptoPortfolioPage() {
  let portfolio: CryptoPortfolioResult | null = null;
  let error: string | null = null;

  try {
    portfolio = await getCryptoPortfolio();
  } catch (err) {
    error = err instanceof Error ? err.message : 'Failed to fetch portfolio';
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-sm font-bold font-mono tracking-widest text-primary">
            CRYPTO PORTFOLIO
          </h1>
          <p className="text-[10px] font-mono text-muted-foreground mt-0.5">
            Live holdings from CoinStats + signal engine analysis
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/crypto"
            className="text-xs font-mono text-muted-foreground hover:text-foreground transition-colors"
          >
            [MARKET]
          </Link>
          <span className="text-xs font-mono text-muted-foreground">
            {new Date().toISOString().split('T')[0]}
          </span>
        </div>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle className="font-mono text-xs font-bold">ERROR</AlertTitle>
          <AlertDescription className="font-mono text-xs">{error}</AlertDescription>
        </Alert>
      ) : !portfolio ? (
        <PortfolioSkeleton />
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card>
              <CardContent className="p-3">
                <span className="font-mono text-[10px] text-muted-foreground block">TOTAL VALUE</span>
                <span className="font-mono text-lg font-bold tabular-nums text-foreground">
                  {formatUsd(portfolio.totalValue)}
                </span>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3">
                <span className="font-mono text-[10px] text-muted-foreground block">TOTAL COST</span>
                <span className="font-mono text-lg font-bold tabular-nums text-foreground">
                  {formatUsd(portfolio.totalCost)}
                </span>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3">
                <span className="font-mono text-[10px] text-muted-foreground block">UNREALIZED P&L</span>
                <span className={cn('font-mono text-lg font-bold tabular-nums', pnlColor(portfolio.unrealizedPnl))}>
                  {formatUsd(portfolio.unrealizedPnl)}
                </span>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3">
                <span className="font-mono text-[10px] text-muted-foreground block">P&L %</span>
                <span className={cn('font-mono text-lg font-bold tabular-nums', pnlColor(portfolio.unrealizedPnlPct))}>
                  {formatPct(portfolio.unrealizedPnlPct)}
                </span>
              </CardContent>
            </Card>
          </div>

          {/* Holdings */}
          <Card>
            <CardHeader className="border-b border-border py-1.5 px-3">
              <span className="text-[10px] font-mono font-bold tracking-widest text-primary">
                HOLDINGS — {portfolio.holdings.length} ASSETS
              </span>
            </CardHeader>
          </Card>

          <div className="space-y-3">
            {portfolio.holdings.map((holding) => (
              <HoldingCard key={holding.symbol} holding={holding} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
