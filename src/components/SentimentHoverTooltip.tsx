import React, { useEffect } from 'react';
import { SourceType } from '../engine';
import { X, Star, BarChart3, PieChart } from 'lucide-react';

export type HoverChartMode = 'scores' | 'sources';

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
  pct: number;
}

export interface PeriodBreakdownEvent {
  id: string;
  title: string;
  eventDate: string;
  sourceType: SourceType;
  starred?: boolean;
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
  events: Array<{ sourceType: SourceType }>,
): SourceSlice[] {
  if (!events || events.length === 0) return [];

  const bucketMap = new Map<string, { bucket: string; label: string; color: string; count: number }>();

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

  if (sorted.length === 0) return [];

  const slices: SourceSlice[] = sorted.map((item) => ({
    ...item,
    pct: Math.round((item.count / total) * 1000) / 10,
  }));

  const sumPct = slices.reduce((acc, s) => acc + s.pct, 0);
  const drift = Math.round((100 - sumPct) * 10) / 10;
  if (drift !== 0 && slices.length > 0) {
    slices[0].pct = Math.round((slices[0].pct + drift) * 10) / 10;
  }

  return slices;
}

export interface SentimentHoverTooltipProps {
  mode: HoverChartMode;
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
  subtitle?: string;
}

export interface PeriodBreakdownModalProps {
  isOpen: boolean;
  onClose: () => void;
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
  periodEvents?: PeriodBreakdownEvent[];
  subtitle?: string;
}

const AUDIENCE_BARS: Array<{
  key: 'composite' | 'executive' | 'congress' | 'navy' | 'public';
  shortLabel: string;
  fullLabel: string;
  color: string;
}> = [
  { key: 'composite', shortLabel: 'Comp', fullLabel: 'Composite', color: '#ffffff' },
  { key: 'executive', shortLabel: 'Exec', fullLabel: 'Executive', color: '#75abd1' },
  { key: 'congress', shortLabel: 'Cong', fullLabel: 'Congress', color: '#509ca2' },
  { key: 'navy', shortLabel: 'Navy', fullLabel: 'Navy / DoD', color: '#38bdf8' },
  { key: 'public', shortLabel: 'Pub', fullLabel: 'Public / Media', color: '#9ca3af' },
];

function polarToCartesian(cx: number, cy: number, r: number, angleInDegrees: number) {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
  return {
    x: cx + r * Math.cos(angleInRadians),
    y: cy + r * Math.sin(angleInRadians),
  };
}

function createPieSlicePath(
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  endAngle: number,
): string {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
  return [
    'M',
    cx,
    cy,
    'L',
    start.x.toFixed(2),
    start.y.toFixed(2),
    'A',
    r,
    r,
    0,
    largeArcFlag,
    0,
    end.x.toFixed(2),
    end.y.toFixed(2),
    'Z',
  ].join(' ');
}

const DonutSvg: React.FC<{
  sourceMix: SourceSlice[];
  totalCount: number;
  sizeClass: string;
  centerLabelSizeClass?: string;
}> = ({ sourceMix, totalCount, sizeClass, centerLabelSizeClass = 'text-[10px]' }) => {
  let cumulativeAngle = 0;

  return (
    <svg viewBox="0 0 64 64" className={`${sizeClass} shrink-0 overflow-visible`}>
      {sourceMix.length === 0 ? (
        <circle
          cx="32"
          cy="32"
          r="26"
          fill="#22262b"
          stroke="#5b6670"
          strokeWidth="1.5"
          strokeDasharray="3 2"
        />
      ) : sourceMix.length === 1 ? (
        <circle
          cx="32"
          cy="32"
          r="28"
          fill={sourceMix[0]!.color}
          stroke="#1a1e23"
          strokeWidth="1.5"
        />
      ) : (
        sourceMix.map((slice) => {
          const sliceAngle = (slice.pct / 100) * 360;
          const startAngle = cumulativeAngle;
          const endAngle = cumulativeAngle + sliceAngle;
          cumulativeAngle = endAngle;

          if (sliceAngle >= 359.9) {
            return (
              <circle
                key={slice.bucket}
                cx="32"
                cy="32"
                r="28"
                fill={slice.color}
                stroke="#1a1e23"
                strokeWidth="1.5"
              />
            );
          }

          return (
            <path
              key={slice.bucket}
              d={createPieSlicePath(32, 32, 28, startAngle, endAngle)}
              fill={slice.color}
              stroke="#1a1e23"
              strokeWidth="1.2"
            />
          );
        })
      )}
      <circle cx="32" cy="32" r="14" fill="#1a1e23" />
      <text
        x="32"
        y="35"
        textAnchor="middle"
        className={`fill-white font-mono font-bold ${centerLabelSizeClass}`}
      >
        {totalCount}
      </text>
    </svg>
  );
};

/**
 * Ultra-compact Hover Card (never obscures chart lines).
 * Switches between 'scores' (Bar Chart) and 'sources' (Pie Chart).
 */
export const SentimentHoverTooltip: React.FC<SentimentHoverTooltipProps> = ({
  mode,
  label,
  isForecast = false,
  composite,
  scores,
  p10,
  p90,
  sourceMix,
  totalImpactingEvents,
  subtitle,
}) => {
  const allValues: Record<string, number | undefined> = {
    composite,
    executive: scores.executive,
    congress: scores.congress,
    navy: scores.navy,
    public: scores.public,
  };

  const widthClass = mode === 'scores' ? 'w-[195px]' : 'w-[225px]';

  return (
    <div
      className={`bg-[#1a1e23]/95 backdrop-blur-md border border-sky/60 rounded-lg p-2.5 shadow-xl text-white pointer-events-none select-none ${widthClass}`}
    >
      {/* Compact Header */}
      <div className="flex items-center justify-between gap-1.5 border-b border-sky/30 pb-1.5 mb-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1">
            <span className="text-[11px] font-bold text-white truncate">{label}</span>
            {isForecast && (
              <span className="text-[8px] uppercase font-bold tracking-wider px-1 py-0.2 rounded bg-passion/25 border border-passion/50 text-passion shrink-0">
                Fcst
              </span>
            )}
          </div>
          {subtitle && (
            <div className="text-[9px] text-sky/75 truncate leading-tight">{subtitle}</div>
          )}
        </div>
        {composite !== undefined && (
          <div className="text-right shrink-0 bg-[#22262b] px-1.5 py-0.5 rounded border border-sky/30">
            <span className="text-[11px] font-mono font-bold text-white">
              {composite.toFixed(1)}
            </span>
          </div>
        )}
      </div>

      {/* Mode 1: Compact Score Bar Chart ONLY */}
      {mode === 'scores' && (
        <div className="space-y-1">
          {AUDIENCE_BARS.map(({ key, shortLabel, color }) => {
            const val = allValues[key];
            if (val === undefined || Number.isNaN(val)) return null;
            const clamped = Math.max(0, Math.min(100, val));
            const isComp = key === 'composite';

            return (
              <div key={key} className="flex items-center gap-1.5 text-[10px]">
                <span className={`w-8 truncate ${isComp ? 'font-bold text-white' : 'text-sky/90'}`}>
                  {shortLabel}
                </span>
                <div className="flex-1 h-2 bg-[#14171a] rounded-sm overflow-hidden relative border border-steel/40">
                  <div
                    className="absolute top-0 bottom-0 left-1/2 w-[1px] bg-white/30 z-10"
                    title="Neutral 50"
                  />
                  <div
                    className="h-full rounded-sm"
                    style={{
                      width: `${clamped}%`,
                      backgroundColor: color,
                    }}
                  />
                </div>
                <span
                  className={`w-7 text-right font-mono text-[10px] ${
                    isComp ? 'font-bold text-white' : 'text-white/85'
                  }`}
                >
                  {val.toFixed(1)}
                </span>
              </div>
            );
          })}

          {p10 !== undefined && p90 !== undefined && (
            <div className="pt-1 mt-1 border-t border-sky/20 flex items-center justify-between text-[9px] text-passion font-mono">
              <span>80% Band</span>
              <span>
                [{p10.toFixed(1)}–{p90.toFixed(1)}]
              </span>
            </div>
          )}
        </div>
      )}

      {/* Mode 2: Compact Source Mix Donut/Pie Chart ONLY */}
      {mode === 'sources' && (
        <div className="flex items-center gap-2.5">
          <DonutSvg
            sourceMix={sourceMix}
            totalCount={totalImpactingEvents}
            sizeClass="w-14 h-14"
            centerLabelSizeClass="text-[11px]"
          />

          <div className="flex-1 min-w-0 space-y-1">
            {sourceMix.length === 0 ? (
              <div className="text-[9px] text-steel italic leading-tight">
                Baseline decay window (0 active events)
              </div>
            ) : (
              sourceMix.slice(0, 4).map((slice) => (
                <div
                  key={slice.bucket}
                  className="flex items-center justify-between gap-1 text-[9px]"
                >
                  <div className="flex items-center gap-1 min-w-0">
                    <span
                      className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ backgroundColor: slice.color }}
                    />
                    <span className="text-white/90 truncate">{slice.label}</span>
                  </div>
                  <span className="font-mono text-sky shrink-0">
                    {Math.round(slice.pct)}%
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Micro Footer Hint */}
      <div className="mt-2 pt-1 border-t border-sky/20 text-[9px] text-passion font-semibold text-center">
        Double-click point for full pane
      </div>
    </div>
  );
};

/**
 * Full-screen Visual Breakdown Modal opened when double-clicking any chart point.
 */
export const PeriodBreakdownModal: React.FC<PeriodBreakdownModalProps> = ({
  isOpen,
  onClose,
  label,
  isForecast = false,
  composite,
  scores,
  p10,
  p90,
  sourceMix,
  totalImpactingEvents,
  keyEventTitles = [],
  periodEvents = [],
  subtitle,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const allValues: Record<string, number | undefined> = {
    composite,
    executive: scores.executive,
    congress: scores.congress,
    navy: scores.navy,
    public: scores.public,
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Detailed Sentiment Breakdown for ${label}`}
    >
      <div
        className="max-w-3xl w-full max-h-[90vh] overflow-y-auto bg-[#1a1e23] border border-sky/60 rounded-2xl shadow-2xl text-white"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between gap-4 px-5 py-4 bg-[#22262b] border-b border-steel/50 sticky top-0 z-10">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h3 className="text-lg font-bold text-white tracking-tight">{label}</h3>
              {isForecast ? (
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-passion/20 border border-passion/50 text-passion">
                  Projected Forecast Window
                </span>
              ) : (
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-sky/20 border border-sky/40 text-sky">
                  Historical Period Breakdown
                </span>
              )}
            </div>
            {subtitle && <p className="text-xs text-sky/80 mt-0.5">{subtitle}</p>}
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {composite !== undefined && (
              <div className="text-right bg-[#1a1e23] px-3 py-1.5 rounded-xl border border-sky/40">
                <div className="text-[10px] uppercase tracking-wider text-steel font-semibold">
                  {isForecast ? 'Forecast EV' : 'Composite Score'}
                </div>
                <div className="text-lg font-mono font-bold text-white">
                  {composite.toFixed(2)}
                </div>
              </div>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg bg-[#1a1e23] hover:bg-passion/20 text-steel hover:text-white border border-steel/60 transition-colors"
              title="Close pane (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body: 2-Column Visual Charts */}
        <div className="p-5 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Left Card: Audience Sentiment Bar Chart */}
            <div className="bg-[#22262b] border border-steel/50 rounded-xl p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-sky flex items-center gap-1.5">
                    <BarChart3 className="w-4 h-4 text-passion" />
                    <span>Audience Sentiment · Bar Chart</span>
                  </span>
                  <span className="text-[10px] font-mono text-steel">50 = Neutral</span>
                </div>

                <div className="space-y-2.5">
                  {AUDIENCE_BARS.map(({ key, fullLabel, color }) => {
                    const val = allValues[key];
                    if (val === undefined || Number.isNaN(val)) return null;
                    const clamped = Math.max(0, Math.min(100, val));
                    const isComp = key === 'composite';
                    const deltaFromNeutral = val - 50;

                    return (
                      <div key={key} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className={isComp ? 'font-bold text-white' : 'font-medium text-sky/90'}>
                            {fullLabel}
                          </span>
                          <div className="flex items-center gap-2 font-mono">
                            <span
                              className={`text-[10px] ${
                                deltaFromNeutral >= 0 ? 'text-changingsea' : 'text-passion'
                              }`}
                            >
                              {deltaFromNeutral >= 0 ? '+' : ''}
                              {deltaFromNeutral.toFixed(1)} vs 50
                            </span>
                            <span className={isComp ? 'font-bold text-white' : 'text-white/90'}>
                              {val.toFixed(2)}
                            </span>
                          </div>
                        </div>

                        <div className="h-3 bg-[#14171a] rounded overflow-hidden relative border border-steel/40">
                          <div
                            className="absolute top-0 bottom-0 left-1/2 w-[1.5px] bg-white/35 z-10"
                            title="Neutral 50"
                          />
                          <div
                            className="h-full rounded transition-all duration-200"
                            style={{
                              width: `${clamped}%`,
                              backgroundColor: color,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {p10 !== undefined && p90 !== undefined && (
                <div className="mt-4 pt-3 border-t border-steel/40">
                  <div className="flex items-center justify-between text-xs text-passion font-mono mb-1">
                    <span>80% Scenario Confidence (P10 – P90)</span>
                    <span className="font-bold">
                      [{p10.toFixed(2)} – {p90.toFixed(2)}]
                    </span>
                  </div>
                  <div className="h-2.5 bg-[#14171a] rounded overflow-hidden relative border border-passion/40">
                    <div
                      className="absolute top-0 bottom-0 bg-passion/45 border-x border-passion"
                      style={{
                        left: `${Math.max(0, Math.min(100, p10))}%`,
                        width: `${Math.max(2, Math.min(100, p90) - Math.max(0, Math.min(100, p10)))}%`,
                      }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Right Card: Ledger Source Distribution Pie Chart */}
            <div className="bg-[#22262b] border border-steel/50 rounded-xl p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-sky flex items-center gap-1.5">
                    <PieChart className="w-4 h-4 text-passion" />
                    <span>Ledger Source Mix · Pie Chart</span>
                  </span>
                  <span className="text-[11px] font-mono text-white font-semibold">
                    {totalImpactingEvents} Driver{totalImpactingEvents === 1 ? '' : 's'}
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-4 my-2">
                  <DonutSvg
                    sourceMix={sourceMix}
                    totalCount={totalImpactingEvents}
                    sizeClass="w-28 h-28"
                    centerLabelSizeClass="text-[12px]"
                  />

                  <div className="flex-1 w-full min-w-0 space-y-2">
                    {sourceMix.length === 0 ? (
                      <div className="text-xs text-steel italic">
                        No direct ledger events in this period; scores reflect exponential time-decay toward neutral baseline (50.0).
                      </div>
                    ) : (
                      sourceMix.map((slice) => (
                        <div key={slice.bucket} className="space-y-0.5">
                          <div className="flex items-center justify-between text-xs gap-1">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span
                                className="w-2.5 h-2.5 rounded-sm shrink-0"
                                style={{ backgroundColor: slice.color }}
                              />
                              <span className="text-white/95 truncate font-medium">
                                {slice.label}
                              </span>
                            </div>
                            <span className="font-mono text-[11px] text-sky shrink-0">
                              {Math.round(slice.pct)}% ({slice.count})
                            </span>
                          </div>
                          <div className="h-1.5 bg-[#14171a] rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${slice.pct}%`,
                                backgroundColor: slice.color,
                              }}
                            />
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-3 pt-2.5 border-t border-steel/40 text-[11px] text-steel flex items-center justify-between">
                <span>Source Attribution Mix</span>
                <span className="font-mono text-white/80">
                  {sourceMix.length} active source bucket{sourceMix.length === 1 ? '' : 's'}
                </span>
              </div>
            </div>
          </div>

          {/* Bottom Section: Impacting Ledger Events & Milestones */}
          <div className="bg-[#22262b] border border-steel/50 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-xs font-bold uppercase tracking-wider text-sky">
                Impacting Ledger Events & Milestones ({totalImpactingEvents})
              </span>
              <span className="text-[11px] text-steel hidden sm:inline">
                Contributing active & decayed drivers in period
              </span>
            </div>

            {periodEvents.length > 0 ? (
              <div className="max-h-52 overflow-y-auto space-y-1.5 pr-1">
                {periodEvents.map((ev) => {
                  const b = classifySourceBucket(ev.sourceType);
                  return (
                    <div
                      key={ev.id}
                      className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-[#1a1e23] border border-steel/40 text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {ev.starred && (
                          <Star className="w-3.5 h-3.5 text-passion fill-passion shrink-0" />
                        )}
                        <span className="font-mono text-[11px] text-passion shrink-0">
                          {ev.eventDate}
                        </span>
                        <span className="text-white font-medium truncate">
                          {ev.title}
                        </span>
                      </div>
                      <span
                        className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 border"
                        style={{
                          backgroundColor: `${b.color}20`,
                          borderColor: `${b.color}70`,
                          color: '#ffffff',
                        }}
                      >
                        {b.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : keyEventTitles.length > 0 ? (
              <ul className="max-h-44 overflow-y-auto space-y-1.5 text-xs text-white/90">
                {keyEventTitles.map((title, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 px-3 py-1.5 rounded bg-[#1a1e23] border border-steel/40"
                  >
                    <Star className="w-3.5 h-3.5 text-passion fill-passion shrink-0 mt-0.5" />
                    <span>{title}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-xs text-steel italic py-3 text-center">
                No discrete events logged inside this slice.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SentimentHoverTooltip;
