'use client';

import { Cell, Pie, PieChart } from 'recharts';
import { type ChartConfig, ChartContainer, ChartTooltip } from '@/components/ui/chart';

interface AllocationSlice {
  symbol: string;
  valueUsd: number;
}

interface CryptoAllocationChartProps {
  holdings: AllocationSlice[];
}

/** Cycle through the five chart tokens for arbitrary numbers of holdings. */
const CHART_VARS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
] as const;

const CHART_CONFIG = {} satisfies ChartConfig;

function formatUsd(value: number): string {
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });
}

/**
 * Donut chart of portfolio allocation by holding, sized by USD value.
 * Slices cycle through the five semantic chart tokens so they stay
 * theme-aware in light and dark mode.
 */
export function CryptoAllocationChart({ holdings }: CryptoAllocationChartProps) {
  const total = holdings.reduce((sum, h) => sum + h.valueUsd, 0);
  if (total <= 0 || holdings.length === 0) return null;

  const data = holdings.map((h, i) => ({
    name: h.symbol,
    value: h.valueUsd,
    pct: (h.valueUsd / total) * 100,
    color: CHART_VARS[i % CHART_VARS.length],
  }));

  const top = data[0];

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className="relative w-full h-[180px]"
        role="img"
        aria-label={`Portfolio allocation: ${data
          .map((d) => `${d.name} ${d.pct.toFixed(1)}%`)
          .join(', ')}`}
      >
        <ChartContainer
          config={CHART_CONFIG}
          className="w-full h-[180px]"
          initialDimension={{ width: 220, height: 180 }}
        >
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={54}
              outerRadius={82}
              dataKey="value"
              strokeWidth={0}
              paddingAngle={2}
            >
              {data.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Pie>
            <ChartTooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const p = payload[0].payload as (typeof data)[number];
                return (
                  <div className="rounded-sm border border-border bg-popover px-2 py-1 font-mono text-[10px] text-popover-foreground shadow-md">
                    <span className="font-bold">{p.name}</span> {formatUsd(p.value)} (
                    {p.pct.toFixed(1)}%)
                  </div>
                );
              }}
            />
          </PieChart>
        </ChartContainer>

        {/* centre label: largest holding */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="font-mono text-lg font-bold" style={{ color: top.color }}>
            {top.pct.toFixed(0)}%
          </span>
          <span className="font-mono text-[10px] tracking-widest" style={{ color: top.color }}>
            {top.name}
          </span>
        </div>
      </div>

      {/* legend */}
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1">
        {data.map((entry) => (
          <div key={entry.name} className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full" style={{ background: entry.color }} />
            <span className="font-mono text-[10px] text-muted-foreground tabular-nums">
              {entry.name} {entry.pct.toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
