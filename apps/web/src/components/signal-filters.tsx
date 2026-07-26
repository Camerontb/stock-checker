'use client';

import { useMemo, useState } from 'react';

import { SignalCard } from '@/components/signal-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { TickerResult } from '@/lib/api';

type SortKey = 'score' | 'institutionalScore' | 'dayChangePct' | 'rsi';

interface SignalFiltersProps {
  results: TickerResult[];
  portfolioTickers: string[];
  watchlistTickers: string[];
}

const SORT_OPTIONS: Array<{ key: SortKey; label: string }> = [
  { key: 'score', label: 'SCORE' },
  { key: 'institutionalScore', label: 'INST SCORE' },
  { key: 'dayChangePct', label: 'DAY CHANGE' },
  { key: 'rsi', label: 'RSI' },
];

export function SignalFilters({ results, portfolioTickers, watchlistTickers }: SignalFiltersProps) {
  const [sortKey, setSortKey] = useState<SortKey>('score');
  const [sectorFilter, setSectorFilter] = useState<string>('ALL');

  const sectors = useMemo(() => {
    const set = new Set<string>();
    for (const r of results) {
      if (r.sector) set.add(r.sector);
    }
    return Array.from(set).sort();
  }, [results]);

  const filtered = useMemo(() => {
    let list = results;
    if (sectorFilter !== 'ALL') {
      list = list.filter((r) => r.sector === sectorFilter);
    }
    return [...list].sort((a, b) => {
      const av = (a[sortKey] as number) ?? 0;
      const bv = (b[sortKey] as number) ?? 0;
      return bv - av; // descending
    });
  }, [results, sortKey, sectorFilter]);

  const portfolioSet = useMemo(() => new Set(portfolioTickers), [portfolioTickers]);
  const watchlistSet = useMemo(() => new Set(watchlistTickers), [watchlistTickers]);

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <Card>
        <CardHeader className="border-b border-border py-1.5 px-3">
          <span className="text-[10px] font-mono font-bold tracking-widest text-primary">
            FILTERS
          </span>
        </CardHeader>
        <CardContent className="p-3">
          <div
            className="flex flex-wrap items-center gap-3"
            role="toolbar"
            aria-label="Signal filters"
          >
            {/* Sector filter */}
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-[10px] text-muted-foreground">SECTOR</span>
              <Select value={sectorFilter} onValueChange={setSectorFilter}>
                <SelectTrigger size="sm" className="font-mono text-[10px] min-w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">
                    <span className="font-mono text-xs">ALL SECTORS</span>
                  </SelectItem>
                  {sectors.map((s) => (
                    <SelectItem key={s} value={s}>
                      <span className="font-mono text-xs">{s}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Sort buttons */}
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-[10px] text-muted-foreground">SORT</span>
              {SORT_OPTIONS.map(({ key, label }) => (
                <Button
                  key={key}
                  type="button"
                  variant={sortKey === key ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-7 px-2 font-mono text-[10px]"
                  aria-pressed={sortKey === key}
                  onClick={() => setSortKey(key)}
                >
                  {label}
                </Button>
              ))}
            </div>

            {/* Count */}
            <Badge variant="outline" className="font-mono text-[10px] ml-auto">
              {filtered.length} SIGNAL{filtered.length !== 1 ? 'S' : ''}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Signal cards grid */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="font-mono text-xs text-muted-foreground">
              NO BUY SIGNALS FOUND
            </p>
            <p className="font-mono text-[10px] text-muted-foreground mt-1">
              The quality gate is highly selective — this is by design.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((r) => (
            <SignalCard
              key={r.ticker}
              result={r}
              inPortfolio={portfolioSet.has(r.ticker)}
              inWatchlist={watchlistSet.has(r.ticker)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
