'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

import { EarningsWarningBadge } from '@/components/common/earnings-warning-badge';
import { PatternList } from '@/components/pattern-list';
import { ScoreBar } from '@/components/score-bar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { addToPortfolio, addToWatchlist } from '@/lib/api';
import type { TickerResult } from '@/lib/api';
import { cn, formatMarketCap } from '@/lib/utils';

interface SignalCardProps {
  result: TickerResult;
  inPortfolio: boolean;
  inWatchlist: boolean;
}

function trendColor(regime: string | undefined): string {
  if (regime === 'uptrend') return 'text-success';
  if (regime === 'downtrend') return 'text-destructive';
  return 'text-muted-foreground';
}

export function SignalCard({ result, inPortfolio, inWatchlist }: SignalCardProps) {
  const router = useRouter();
  const [addingPortfolio, setAddingPortfolio] = useState(false);
  const [addingWatchlist, setAddingWatchlist] = useState(false);

  const dayChange = result.dayChangePct ?? 0;
  const isUp = dayChange >= 0;

  async function handleAddPortfolio() {
    setAddingPortfolio(true);
    try {
      await addToPortfolio(result.ticker);
      toast.success(`${result.ticker} added to portfolio`);
      router.refresh();
    } catch {
      toast.error(`Failed to add ${result.ticker}`);
    } finally {
      setAddingPortfolio(false);
    }
  }

  async function handleAddWatchlist() {
    setAddingWatchlist(true);
    try {
      await addToWatchlist(result.ticker);
      toast.success(`${result.ticker} added to watchlist`);
      router.refresh();
    } catch {
      toast.error(`Failed to add ${result.ticker}`);
    } finally {
      setAddingWatchlist(false);
    }
  }

  return (
    <Card className="overflow-hidden border-l-2 border-l-success">
      <CardContent className="p-3 space-y-3">
        {/* Header: Ticker + Name + Sector */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Link
                href={`/${result.ticker}`}
                className="font-mono font-bold text-sm text-foreground hover:text-primary transition-colors"
              >
                {result.ticker}
              </Link>
              <EarningsWarningBadge daysToEarnings={result.daysToEarnings} />
            </div>
            {result.name && (
              <p className="font-mono text-[10px] text-muted-foreground truncate mt-0.5">
                {result.name}
              </p>
            )}
          </div>
          {result.sector && (
            <Badge
              variant="outline"
              className="font-mono text-[10px] text-muted-foreground shrink-0"
            >
              {result.sector}
            </Badge>
          )}
        </div>

        {/* Price row */}
        <div className="flex items-baseline justify-between font-mono text-xs">
          <span className="text-foreground tabular-nums font-bold text-sm">
            ${result.close.toFixed(2)}
          </span>
          <div className="flex items-center gap-3">
            <span className={cn('tabular-nums', isUp ? 'text-success' : 'text-destructive')}>
              {isUp ? '+' : ''}{dayChange.toFixed(2)}%
            </span>
            <span className="text-muted-foreground tabular-nums">
              {formatMarketCap(result.marketCap)}
            </span>
          </div>
        </div>

        {/* Score */}
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] text-muted-foreground w-10 shrink-0">SCORE</span>
          <ScoreBar value={result.score} />
        </div>

        <Separator />

        {/* Institutional flow metrics */}
        <div className="grid grid-cols-3 gap-2 font-mono text-[10px]">
          <div>
            <span className="text-muted-foreground block">INST</span>
            <span
              className={cn(
                'tabular-nums font-bold',
                result.institutionalPassed ? 'text-success' : 'text-muted-foreground'
              )}
            >
              {result.institutionalScore != null
                ? result.institutionalScore.toFixed(2)
                : '—'}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground block">TREND</span>
            <span className={cn('font-bold uppercase', trendColor(result.trendRegime))}>
              {result.trendRegime ?? '—'}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground block">VOL R</span>
            <span className="tabular-nums text-foreground">
              {result.volumeRatio != null ? result.volumeRatio.toFixed(1) : '—'}x
            </span>
          </div>
        </div>

        {/* Risk levels */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-[10px]">
          <div className="flex justify-between">
            <span className="text-muted-foreground">STOP</span>
            <span className="tabular-nums text-destructive">${result.stopLoss.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">TARGET</span>
            <span className="tabular-nums text-success">${result.takeProfit.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">TRAIL</span>
            <span className="tabular-nums text-foreground">${result.trailingStop.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">RSI</span>
            <span className={cn(
              'tabular-nums',
              result.rsi >= 70 ? 'text-destructive' : result.rsi <= 30 ? 'text-success' : 'text-foreground'
            )}>
              {result.rsi.toFixed(1)}
            </span>
          </div>
        </div>

        {/* Patterns */}
        {result.patterns.length > 0 && (
          <>
            <Separator />
            <PatternList patterns={result.patterns} />
          </>
        )}

        <Separator />

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={inPortfolio ? 'secondary' : 'default'}
            className="h-7 px-2 font-mono text-[10px] flex-1"
            disabled={inPortfolio || addingPortfolio}
            onClick={handleAddPortfolio}
          >
            {inPortfolio ? 'IN PORTFOLIO' : '+ PORTFOLIO'}
          </Button>
          <Button
            size="sm"
            variant={inWatchlist ? 'secondary' : 'outline'}
            className="h-7 px-2 font-mono text-[10px] flex-1"
            disabled={inWatchlist || addingWatchlist}
            onClick={handleAddWatchlist}
          >
            {inWatchlist ? 'WATCHING' : '+ WATCHLIST'}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 font-mono text-[10px]"
            render={<Link href={`/${result.ticker}`} />}
          >
            DETAIL
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
