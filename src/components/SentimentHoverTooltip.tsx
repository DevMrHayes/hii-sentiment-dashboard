import React from 'react';
import { SourceType } from '../engine';

export interface SourceBucketMeta {
  bucket: 'congress' | 'navy' | 'executive' | 'media' | 'markets';
  label: string;
  color: string;
}

export interface SourceSlice {
  bucket: string;
  label: string;
  color: string;
  count: number;
  pct: number; // integer 0..100 or 1-decimal
}

export interface SentimentHoverTooltipProps {
  label: string;
  isForecast?: boolean;
  composite?: number;
  scores: {
    executive?: number;
    congress?: number;
    navy?: number;
    public?: number;
  };
  p10?: number;
  p90?: number;
  sourceMix: SourceSlice[];
  totalImpactingEvents: number;
  keyEventTitles?: string[];
  subtitle?: string;
}

export function classifySourceBucket(sourceType: SourceType): SourceBucketMeta {
  switch (sourceType) {
    case 'legislation':
    case 'hearing':
    case 'gao_report':
    case 'crs_report':
      return {
        bucket: 'congress',
        label: 'Congress & Oversight',
        color: '#509ca2',
      };
    case 'contract_award':
    case 'navy_statement':
      return {
        bucket: 'navy',
        label: 'Navy & Contracts',
        color: '#38bdf8',
      };
    case 'exec_order':
    case 'budget_request':
      return {
        bucket: 'executive',
        label: 'Executive Branch',
        color: '#75abd1',
      };
    case 'news_media':
      return {
        bucket: 'media',
        label: 'Public Media',
        color: '#f59e0b',
      };
    case 'earnings':
    case 'stock_move':
    case 'analyst_rating':
    case 'corporate_action':
    default:
      return {
        bucket: 'markets',
        label: 'Corporate & Markets',
        color: '#ea7722',
      };
  }
}

export function buildSourceMixFromEvents(
  events: Array<{ sourceType: SourceType }>
): SourceSlice[] {
  if (!events || events.length === 0) {
    return [];
  }

  const bucketMap = new Map<
    string,
    { bucket: string; label: string; color: string; count: number }
  >();

  for (const ev of events) {
    const meta = classifySourceBucket(ev.sourceType);
    const existing = bucketMap.get(meta.bucket);
    if (existing) {
      existing.count += 1;
    } else {
      bucketMap.set(meta.bucket, {
        bucket: meta.bucket,
        label: meta.label,
        color: meta.color,
        count: 1,
      });
    }
  }

  const total = events.length;
  const sorted = Array.from(bucketMap.values())
    .filter((b) => b.count > 0)
    .sort((a, b) => b.count - a.count);

  if (sorted.length === 0) {
    return [];
  }

  const slices: SourceSlice[] = sorted.map((item) => ({
    ...item,
    pct: Math.round((item.count / total) * 1000) / 10,
  }));

  // Guarantee exact 100.0% sum on largest slice to eliminate floating-point drift
  const sumPct = slices.reduce((acc, s) => acc + s.pct, 0);
  const drift = Math.round((100 - sumPct) * 10) / 10;
  if (drift !== 0 && slices.length > 0) {
    slices[0].pct = Math.round((slices[0].pct + drift) * 10) / 10;
  }

  return slices;
}

function polarToCartesian(cx: number, cy: number, r: number, angleInDegrees: number) {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
  return {
    x: cx + r * Math.cos(angleInRadians),
    y: cy + r * Math.sin(angleInRadians),
  };
}

function createDonutSlicePath(
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
  startAngle: number,
  endAngle: number
): string {
  const sweep = endAngle - startAngle;
  const largeArcFlag = sweep > 180 ? 1 : 0;

  const outerStart = polarToCartesian(cx, cy, outerR, startAngle);
  const outerEnd = polarToCartesian(cx, cy, outerR, endAngle);
  const innerEnd = polarToCartesian(cx, cy, innerR, endAngle);
  const innerStart = polarToCartesian(cx, cy, innerR, startAngle);

  return [
    `M ${outerStart.x.toFixed(2)} ${outerStart.y.toFixed(2)}`,
    `A ${outerR} ${outerR} 0 ${largeArcFlag} 1 ${outerEnd.x.toFixed(2)} ${outerEnd.y.toFixed(2)}`,
    `L ${innerEnd.x.toFixed(2)} ${innerEnd.y.toFixed(2)}`,
    `A ${innerR} ${innerR} 0 ${largeArcFlag} 0 ${innerStart.x.toFixed(2)} ${innerStart.y.toFixed(2)}`,
    'Z',
  ].join(' ');
}

function clampScore(val: number | undefined): number {
  if (val === undefined || Number.isNaN(val)) return 0;
  return Math.max(0, Math.min(100, val));
}

export const SentimentHoverTooltip: React.FC<SentimentHoverTooltipProps> = ({
  label,
  isForecast = false,
  composite,
  scores,
  p10,
  p90,
  sourceMix,
  totalImpactingEvents,
  keyEventTitles,
  subtitle,
}) => {
  const audienceRows = [
    { key: 'composite', label: 'Composite', value: composite, color: '#ffffff', isPrimary: true },
    { key: 'executive', label: 'Executive', value: scores.executive, color: '#75abd1', isPrimary: false },
    { key: 'congress', label: 'Congress', value: scores.congress, color: '#509ca2', isPrimary: false },
    { key: 'navy', label: 'Navy', value: scores.navy, color: '#38bdf8', isPrimary: false },
    { key: 'public', label: 'Public', value: scores.public, color: '#9ca3af', isPrimary: false },
  ].filter((row) => row.value !== undefined);

  const activeSlices = sourceMix.filter((s) => s.count > 0);
  const totalSliceCount = activeSlices.reduce((acc, s) => acc + s.count, 0);

  let cumulativeAngle = 0;

  return (
    <div className="bg-[#161a1f]/95 backdrop-blur border border-sky/80 rounded-xl p-3 sm:p-3.5 shadow-2xl w-[285px] sm:w-[450px] text-xs pointer-events-none select-none text-slate-200">
      {/* Header Row */}
      <div className="flex items-center justify-between gap-2 pb-2 mb-2.5 border-b border-slate-700/70">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-white text-sm tracking-tight truncate">
              {label}
            </span>
            {isForecast && (
              <span className="px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded bg-sky-500/20 text-sky-300 border border-sky-400/30">
                Forecast
              </span>
            )}
          </div>
          {subtitle && (
            <div className="text-[10px] text-slate-400 truncate mt-0.5">
              {subtitle}
            </div>
          )}
        </div>

        {composite !== undefined && (
          <div className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-md bg-slate-800/90 border border-slate-600/70">
            <span className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">
              {isForecast ? 'EV' : 'Score'}
            </span>
            <span className="font-mono font-bold text-white text-xs">
              {composite.toFixed(2)}
            </span>
          </div>
        )}
      </div>

      {/* Two-Column Visual Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Left Column: Audience Scores Bar Chart */}
        <div className="flex flex-col justify-between bg-slate-900/50 rounded-lg p-2.5 border border-slate-800/80">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                Audience Scores · Bar Chart
              </span>
              <span className="text-[9px] font-mono text-slate-500">50=Neutral</span>
            </div>

            <div className="space-y-1.5">
              {audienceRows.map((row) => {
                const scoreVal = clampScore(row.value);
                return (
                  <div key={row.key} className="flex items-center gap-1.5">
                    <span
                      className={`w-14 truncate text-[10px] ${
                        row.isPrimary ? 'font-bold text-white' : 'text-slate-300'
                      }`}
                    >
                      {row.label}
                    </span>

                    <div className="relative flex-1 h-2.5 bg-slate-800/90 rounded-sm overflow-hidden border border-slate-700/60">
                      {/* 50 Neutral Reference Marker */}
                      <div
                        className="absolute top-0 bottom-0 left-1/2 w-[1px] bg-slate-400/60 z-10"
                        title="Neutral 50"
                      />
                      {/* Proportional Bar Fill */}
                      <div
                        className="h-full transition-all duration-150 rounded-r-xs"
                        style={{
                          width: `${scoreVal}%`,
                          backgroundColor: row.color,
                          opacity: row.isPrimary ? 0.95 : 0.85,
                        }}
                      />
                    </div>

                    <span
                      className={`w-8 text-right font-mono text-[10px] ${
                        row.isPrimary ? 'font-bold text-white' : 'text-slate-300'
                      }`}
                    >
                      {scoreVal.toFixed(1)}
                    </span>
                  </div>
                );
              })}

              {/* Forecast P10 - P90 Confidence Band Bar */}
              {isForecast && p10 !== undefined && p90 !== undefined && (
                <div className="pt-1 mt-1 border-t border-slate-800">
                  <div className="flex items-center gap-1.5">
                    <span className="w-14 truncate text-[10px] text-sky-300 font-medium">
                      P10–P90
                    </span>
                    <div className="relative flex-1 h-2 bg-slate-800/90 rounded-sm overflow-hidden border border-slate-700/60">
                      <div className="absolute top-0 bottom-0 left-1/2 w-[1px] bg-slate-400/50 z-10" />
                      <div
                        className="absolute top-0 bottom-0 bg-sky-400/45 border-x border-sky-300"
                        style={{
                          left: `${clampScore(p10)}%`,
                          width: `${Math.max(2, clampScore(p90) - clampScore(p10))}%`,
                        }}
                      />
                    </div>
                    <span className="w-12 text-right font-mono text-[9px] text-sky-300">
                      {p10.toFixed(0)}–{p90.toFixed(0)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Ledger Source Mix Pie Chart */}
        <div className="flex flex-col justify-between bg-slate-900/50 rounded-lg p-2.5 border border-slate-800/80">
          <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
            Ledger Source Mix · Pie Chart
          </div>

          {totalImpactingEvents === 0 || activeSlices.length === 0 ? (
            <div className="flex flex-col items-center justify-center flex-1 py-4 text-center">
              <svg viewBox="0 0 80 80" className="w-14 h-14 mb-1 opacity-40">
                <circle
                  cx="40"
                  cy="40"
                  r="25"
                  fill="none"
                  stroke="#475569"
                  strokeWidth="12"
                />
                <text
                  x="40"
                  y="43"
                  textAnchor="middle"
                  className="fill-slate-400 font-mono text-[11px] font-bold"
                >
                  0
                </text>
              </svg>
              <span className="text-[10px] text-slate-500">
                No impacting ledger events
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2.5 my-auto">
              {/* Crisp Inline SVG Donut Chart */}
              <div className="shrink-0">
                <svg viewBox="0 0 80 80" className="w-16 h-16">
                  {activeSlices.length === 1 ? (
                    <>
                      <circle
                        cx="40"
                        cy="40"
                        r="34"
                        fill={activeSlices[0].color}
                      />
                      <circle cx="40" cy="40" r="15" fill="#13171d" />
                    </>
                  ) : (
                    activeSlices.map((slice) => {
                      const sliceAngle =
                        totalSliceCount > 0
                          ? (slice.count / totalSliceCount) * 360
                          : 0;
                      const startAngle = cumulativeAngle;
                      const endAngle = cumulativeAngle + sliceAngle;
                      cumulativeAngle = endAngle;

                      // Guard against near-360 float precision edge case
                      if (sliceAngle >= 359.9) {
                        return (
                          <g key={slice.bucket}>
                            <circle cx="40" cy="40" r="34" fill={slice.color} />
                            <circle cx="40" cy="40" r="15" fill="#13171d" />
                          </g>
                        );
                      }

                      const pathData = createDonutSlicePath(
                        40,
                        40,
                        34,
                        15,
                        startAngle,
                        endAngle
                      );

                      return (
                        <path
                          key={slice.bucket}
                          d={pathData}
                          fill={slice.color}
                          stroke="#161a1f"
                          strokeWidth="1"
                        />
                      );
                    })
                  )}

                  {/* Center Hole Count */}
                  <text
                    x="40"
                    y="43.5"
                    textAnchor="middle"
                    className="fill-white font-mono text-[11px] font-bold"
                  >
                    {totalImpactingEvents}
                  </text>
                </svg>
              </div>

              {/* Compact Legend */}
              <div className="flex-1 min-w-0 space-y-1">
                {activeSlices.map((slice) => (
                  <div
                    key={slice.bucket}
                    className="flex items-center justify-between gap-1 text-[10px]"
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: slice.color }}
                      />
                      <span className="text-slate-300 truncate">
                        {slice.label}
                      </span>
                    </div>
                    <span className="font-mono text-slate-400 shrink-0">
                      {Math.round(slice.pct)}%{' '}
                      <span className="text-slate-500">({slice.count})</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer: Key Highlights */}
      {keyEventTitles && keyEventTitles.length > 0 && (
        <div className="mt-2.5 pt-2 border-t border-slate-700/70 space-y-1">
          <div className="text-[9px] font-bold uppercase tracking-wider text-amber-400/90">
            Key Period Milestones
          </div>
          {keyEventTitles.slice(0, 2).map((title, idx) => (
            <div
              key={idx}
              className="flex items-center gap-1.5 text-[10px] text-slate-300 truncate"
            >
              <span className="text-amber-400 shrink-0">★</span>
              <span className="truncate">{title}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SentimentHoverTooltip;
