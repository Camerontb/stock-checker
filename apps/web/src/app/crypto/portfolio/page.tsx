import Link from 'next/link';
import { ConvertedPrice } from '@/components/converted-price';
import { CryptoAllocationChart } from '@/components/crypto-allocation-chart';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { getCryptoPortfolio } from '@/lib/api';
import type { CryptoPortfolioResult, PortfolioHoldingResult } from '@/lib/api';
import { cn } from '@/lib/utils';

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

/** Label + value pair used across the holding cards. */
function Metric({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-0.5">
      <span className="block text-xs font-mono uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      {children}
    </div>
  );
}

function PortfolioSkeleton() {
  return (
    <div className="space-y-4" role="status" aria-live="polite" aria-label="Loading portfolio">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}><CardContent className="p-5"><Skeleton className="h-14 w-full" /></CardContent></Card>
        ))}
      </div>
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i}><CardContent className="p-5 space-y-3">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-3/4" />
        </CardContent></Card>
      ))}
    </div>
  );
}

function HoldingCard({ holding }: { holding: PortfolioHoldingResult }) {
  const signal = holding.signal;
  const isStable = !signal && (holding.symbol === 'USDT' || holding.symbol === 'USDC' || holding.symbol === 'DAI' || holding.symbol === 'BUSD' || holding.symbol === 'BSC-USD');

  return (
    <Card
      className={cn(
        'overflow-hidden border-l-4 transition-colors duration-150 hover:bg-muted/30',
        signalBorder(signal?.opinion)
      )}
    >
      <CardContent className="p-5 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {holding.icon && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={holding.icon} alt={holding.symbol} className="w-9 h-9 rounded-full" />
            )}
            <div>
              <span className="font-mono font-bold text-xl">{holding.symbol}</span>
              <span className="font-mono text-sm text-muted-foreground ml-2">{holding.name}</span>
            </div>
          </div>
          {signal && (
            <Badge className={cn('font-mono tracking-widest rounded-sm text-sm font-bold px-3 py-1', signalBg(signal.opinion))}>
              {signal.opinion}
            </Badge>
          )}
          {isStable && (
            <Badge variant="outline" className="font-mono text-sm text-muted-foreground px-3 py-1">STABLE</Badge>
          )}
        </div>

        {/* Holdings value */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 font-mono">
          <Metric label="Quantity">
            <span className="text-foreground tabular-nums font-bold text-base">
              {holding.count < 0.01 ? holding.count.toPrecision(4) : holding.count.toLocaleString('en-US', { maximumFractionDigits: 4 })}
            </span>
          </Metric>
          <Metric label="Price">
            <span className="text-foreground tabular-nums text-base">
              {formatUsd(holding.priceUsd)}
            </span>
          </Metric>
          <Metric label="Value">
            <span className="text-foreground tabular-nums font-bold text-base">
              {formatUsd(holding.valueUsd)}
            </span>
            <ConvertedPrice usd={holding.valueUsd} />
          </Metric>
          <Metric label="Avg Buy">
            <span className="text-foreground tabular-nums text-base">
              {holding.avgBuyPriceUsd > 0 ? formatUsd(holding.avgBuyPriceUsd) : '—'}
            </span>
          </Metric>
        </div>

        {/* P&L row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 font-mono">
          <Metric label="Unrealized P&L">
            <span className={cn('tabular-nums font-bold text-base', pnlColor(holding.unrealizedPnlUsd))}>
              {formatUsd(holding.unrealizedPnlUsd)}
            </span>
          </Metric>
          <Metric label="P&L %">
            <span className={cn('tabular-nums text-base', pnlColor(holding.unrealizedPnlPct))}>
              {formatPct(holding.unrealizedPnlPct)}
            </span>
          </Metric>
          <Metric label="24H">
            <span className={cn('tabular-nums text-base', pnlColor(holding.priceChange24h))}>
              {formatPct(holding.priceChange24h)}
            </span>
          </Metric>
          <Metric label="7D">
            <span className={cn('tabular-nums text-base', pnlColor(holding.priceChange7d))}>
              {formatPct(holding.priceChange7d)}
            </span>
          </Metric>
        </div>

        {/* Signal analysis */}
        {signal && (
          <>
            <Separator />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 font-mono">
              <Metric label="Score">
                <span className="text-foreground tabular-nums font-bold text-base">{Math.round(signal.score)}</span>
              </Metric>
              <Metric label="RSI">
                <span className={cn(
                  'tabular-nums text-base',
                  signal.rsi >= 70 ? 'text-destructive' : signal.rsi <= 30 ? 'text-success' : 'text-foreground'
                )}>
                  {signal.rsi.toFixed(1)}
                </span>
              </Metric>
              <Metric label="Trend">
                <span className={cn(
                  'uppercase text-base font-bold',
                  signal.trendRegime === 'uptrend' ? 'text-success' :
                  signal.trendRegime === 'downtrend' ? 'text-destructive' :
                  'text-muted-foreground'
                )}>
                  {signal.trendRegime ?? '—'}
                </span>
              </Metric>
              <Metric label="Inst">
                <span className={cn(
                  'tabular-nums text-base',
                  signal.institutionalPassed ? 'text-success font-bold' : 'text-muted-foreground'
                )}>
                  {signal.institutionalScore != null ? signal.institutionalScore.toFixed(2) : '—'}
                </span>
              </Metric>
            </div>

            {/* Risk levels */}
            <div className="grid grid-cols-3 gap-4 font-mono">
              <Metric label="Stop">
                <span className="tabular-nums text-destructive text-base">{formatUsd(signal.stopLoss)}</span>
              </Metric>
              <Metric label="Target">
                <span className="tabular-nums text-success text-base">{formatUsd(signal.takeProfit)}</span>
              </Metric>
              <Metric label="Trail">
                <span className="tabular-nums text-foreground text-base">{formatUsd(signal.trailingStop)}</span>
              </Metric>
            </div>

            {/* Action recommendation */}
            <Separator />
            <div className="font-mono">
              <span className="block text-xs uppercase tracking-wider text-muted-foreground mb-1.5">Recommendation</span>
              <p className={cn(
                'text-sm sm:text-base leading-relaxed',
                signal.opinion === 'BUY' ? 'text-success' :
                signal.opinion === 'SELL' ? 'text-destructive' :
                'text-foreground'
              )}>
                {actionText(signal.opinion, holding.symbol)}
              </p>
            </div>

            {/* Patterns */}
            {signal.patterns.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {signal.patterns.map((p) => (
                  <Badge key={p} variant="outline" className="font-mono text-xs px-2 py-0.5">
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
    <div className="space-y-5 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-mono tracking-wide text-primary">
            CRYPTO PORTFOLIO
          </h1>
          <p className="text-sm font-mono text-muted-foreground mt-1">
            Live holdings from CoinStats + signal engine analysis
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/crypto"
            className="text-sm font-mono text-muted-foreground hover:text-foreground transition-colors"
          >
            [MARKET]
          </Link>
          <span className="text-sm font-mono text-muted-foreground">
            {new Date().toISOString().split('T')[0]}
          </span>
        </div>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle className="font-mono text-sm font-bold">ERROR</AlertTitle>
          <AlertDescription className="font-mono text-sm">{error}</AlertDescription>
        </Alert>
      ) : !portfolio ? (
        <PortfolioSkeleton />
      ) : (
        <>
          {/* Summary row: metrics + allocation donut */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300 motion-reduce:animate-none">
            <div className="lg:col-span-2 grid grid-cols-2 gap-4">
              <Card>
                <CardContent className="p-5">
                  <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground block mb-1">Total Value</span>
                  <span className="font-mono text-2xl sm:text-3xl font-bold tabular-nums text-foreground block">
                    {formatUsd(portfolio.totalValue)}
                  </span>
                  <ConvertedPrice usd={portfolio.totalValue} />
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-5">
                  <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground block mb-1">Total Cost</span>
                  <span className="font-mono text-2xl sm:text-3xl font-bold tabular-nums text-foreground block">
                    {formatUsd(portfolio.totalCost)}
                  </span>
                  <ConvertedPrice usd={portfolio.totalCost} />
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-5">
                  <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground block mb-1">Unrealized P&L</span>
                  <span className={cn('font-mono text-2xl sm:text-3xl font-bold tabular-nums block', pnlColor(portfolio.unrealizedPnl))}>
                    {formatUsd(portfolio.unrealizedPnl)}
                  </span>
                  <ConvertedPrice usd={portfolio.unrealizedPnl} />
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-5">
                  <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground block mb-1">P&L %</span>
                  <span className={cn('font-mono text-2xl sm:text-3xl font-bold tabular-nums block', pnlColor(portfolio.unrealizedPnlPct))}>
                    {formatPct(portfolio.unrealizedPnlPct)}
                  </span>
                </CardContent>
              </Card>
            </div>
            <Card>
              <CardHeader className="border-b border-border py-2 px-4">
                <span className="text-xs font-mono font-bold uppercase tracking-widest text-primary">
                  Allocation
                </span>
              </CardHeader>
              <CardContent className="p-4">
                <CryptoAllocationChart
                  holdings={portfolio.holdings.map((h) => ({
                    symbol: h.symbol,
                    valueUsd: h.valueUsd,
                  }))}
                />
              </CardContent>
            </Card>
          </div>

          {/* Holdings */}
          <h2 className="text-base font-bold font-mono uppercase tracking-widest text-primary pt-2">
            Holdings — {portfolio.holdings.length} Assets
          </h2>

          <div className="space-y-4">
            {portfolio.holdings.map((holding, i) => (
              <div
                key={holding.symbol}
                className="animate-in fade-in slide-in-from-bottom-2 duration-300 fill-mode-both motion-reduce:animate-none"
                style={{ animationDelay: `${Math.min(i * 60, 360)}ms` }}
              >
                <HoldingCard holding={holding} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
