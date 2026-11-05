import React, { useMemo, useState } from 'react';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Calendar,
  Check,
  ChevronDown,
  Eye,
  Layers,
  Maximize2,
  Minimize2,
  Pin,
  Sparkles,
  TrendingDown,
  TrendingUp,
  X,
} from 'lucide-react';
import { useDashboard } from '../context/DashboardContext';
import { ALL_AUDIENCES, AUDIENCE_LABELS, baseBps, type AudienceId, type ImpactEvent } from '../engine';

interface ChartDatum {
  id: string;
  label: string;
  granularity: string;
  isForecast: boolean;
  startDate?: string;
  endDate?: string;
  // Historical scores
  executive?: number;
  congress?: number;
  navy?: number;
  public?: number;
  composite?: number;
  // Forecast scores & band
  forecastEv?: number;
  forecastExecEv?: number;
  forecastCongEv?: number;
  forecastNavyEv?: number;
  forecastPublicEv?: number;
  forecastBand?: [number, number];
  forecastP10?: number;
  forecastP90?: number;
  // Markers
  keyEventCount: number;
  keyEventTitles: string[];
  keyMarkerY?: number;
  revisionCount: number;
  revisionMarkerY?: number;
}

const AUDIENCE_COLORS: Record<AudienceId, string> = {
  executive: '#75abd1', // Sky Blue
  congress: '#509ca2',  // Changing Sea
  navy: '#38bdf8',      // Naval Bright Sky
  public: '#9ca3af',    // Steel Silver
};

const PHASE_COLORS = {
  annual: '#8b98a5',
  quarterly: '#509ca2',
  monthly: '#75abd1',
  forecast: '#ea7722',
};

const NUMBER_BADGES = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩', '⑪', '⑫'];

export const TrendChart: React.FC = () => {
  const {
    state,
    result,
    selectedPeriodId,
    setSelectedPeriodId,
    pinnedEventIds,
    togglePinnedEvent,
    isChartExpanded,
    setIsChartExpanded,
  } = useDashboard();

  const [visibleLines, setVisibleLines] = useState<Record<AudienceId | 'composite', boolean>>({
    composite: true,
    executive: true,
    congress: true,
    navy: true,
    public: true,
  });

  const [showPinDrawer, setShowPinDrawer] = useState(false);
  const [pinSearch, setPinSearch] = useState('');

  const eventMap = useMemo(() => new Map(state.events.map((e) => [e.id, e])), [state.events]);

  const revisionsByPeriod = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of state.revisions) {
      m.set(r.periodId, (m.get(r.periodId) ?? 0) + 1);
    }
    return m;
  }, [state.revisions]);

  // Combine historical timeline and forecast into charting data
  const data: ChartDatum[] = useMemo(() => {
    const list: ChartDatum[] = [];

    // 1. Historical timeline
    for (const pt of result.timeline) {
      const revCount = revisionsByPeriod.get(pt.period.id) ?? 0;
      const keyCount = pt.keyEventIds.length;
      const keyTitles = pt.keyEventIds.map((id) => eventMap.get(id)?.title ?? id);

      list.push({
        id: pt.period.id,
        label: pt.period.label,
        granularity: pt.period.granularity,
        isForecast: false,
        startDate: pt.period.startDate,
        endDate: pt.period.endDate,
        executive: pt.audiences.executive.scoreCenti / 100,
        congress: pt.audiences.congress.scoreCenti / 100,
        navy: pt.audiences.navy.scoreCenti / 100,
        public: pt.audiences.public.scoreCenti / 100,
        composite: pt.compositeCenti / 100,
        keyEventCount: keyCount,
        keyEventTitles: keyTitles,
        keyMarkerY: keyCount > 0 ? 95 : undefined,
        revisionCount: revCount,
        revisionMarkerY: revCount > 0 ? 98 : undefined,
      });
    }

    // 2. Forecast points
    const lastHist = list[list.length - 1];

    for (const fc of result.forecast) {
      list.push({
        id: fc.period.id,
        label: fc.period.label,
        granularity: 'month',
        isForecast: true,
        startDate: fc.period.startDate,
        endDate: fc.period.endDate,
        forecastEv: fc.composite.evCenti / 100,
        forecastExecEv: fc.audiences.executive.evCenti / 100,
        forecastCongEv: fc.audiences.congress.evCenti / 100,
        forecastNavyEv: fc.audiences.navy.evCenti / 100,
        forecastPublicEv: fc.audiences.public.evCenti / 100,
        forecastBand: [fc.composite.p10Centi / 100, fc.composite.p90Centi / 100],
        forecastP10: fc.composite.p10Centi / 100,
        forecastP90: fc.composite.p90Centi / 100,
        keyEventCount: 0,
        keyEventTitles: [],
        revisionCount: 0,
      });
    }

    // Bridge the gap between last historical point and first forecast point
    if (lastHist && result.forecast.length > 0) {
      lastHist.forecastEv = lastHist.composite;
      lastHist.forecastExecEv = lastHist.executive;
      lastHist.forecastCongEv = lastHist.congress;
      lastHist.forecastNavyEv = lastHist.navy;
      lastHist.forecastPublicEv = lastHist.public;
      lastHist.forecastP10 = lastHist.composite;
      lastHist.forecastP90 = lastHist.composite;
    }

    return list;
  }, [result.timeline, result.forecast, revisionsByPeriod]);

  // Pinned events resolution
  const pinnedEventsWithPeriod = useMemo(() => {
    const list: Array<{ event: ImpactEvent; periodId: string; index: number }> = [];
    let idx = 1;
    for (const id of pinnedEventIds) {
      const ev = eventMap.get(id);
      if (!ev) continue;

      let bestPeriodId = data[0]?.id ?? '2011';
      for (const pt of result.timeline) {
        if (ev.eventDate >= pt.period.startDate && ev.eventDate <= pt.period.endDate) {
          bestPeriodId = pt.period.id;
          break;
        }
      }

      list.push({ event: ev, periodId: bestPeriodId, index: idx });
      idx++;
    }
    return list.sort((a, b) => a.event.eventDate.localeCompare(b.event.eventDate));
  }, [pinnedEventIds, eventMap, data, result.timeline]);

  // Re-number badges sequentially by date order
  const orderedPinnedList = useMemo(() => {
    return pinnedEventsWithPeriod.map((item, i) => ({
      ...item,
      displayIndex: i + 1,
      badge: NUMBER_BADGES[i] || `[${i + 1}]`,
    }));
  }, [pinnedEventsWithPeriod]);

  // Search filter for starred events drawer
  const starredEventsForPinning = useMemo(() => {
    return state.events
      .filter((e) => {
        if (!e.starred) return false;
        if (!pinSearch) return true;
        const q = pinSearch.toLowerCase();
        return (
          e.title.toLowerCase().includes(q) ||
          e.eventDate.toLowerCase().includes(q) ||
          e.summary.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => b.eventDate.localeCompare(a.eventDate));
  }, [state.events, pinSearch]);

  const toggleLine = (key: AudienceId | 'composite') => {
    setVisibleLines((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const renderImpactPill = (label: string, bps: number) => {
    if (!bps) return null;
    const isPositive = bps > 0;
    return (
      <span
        key={label}
        className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-mono font-medium border ${
          isPositive
            ? 'bg-emerald-950/60 text-emerald-300 border-emerald-700/60'
            : 'bg-rose-950/60 text-rose-300 border-rose-700/60'
        }`}
      >
        <span className="text-steel font-sans">{label}:</span>
        {isPositive ? <TrendingUp className="w-2.5 h-2.5 inline text-emerald-400" /> : <TrendingDown className="w-2.5 h-2.5 inline text-rose-400" />}
        {isPositive ? '+' : ''}{bps}
      </span>
    );
  };

  return (
    <div className="bg-[#1e2227] border border-[#363c44] rounded-xl p-4 shadow-xl transition-all">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-bold text-white tracking-wide flex items-center gap-2">
              <Layers className="w-4 h-4 text-sky" />
              <span>MULTI-AUDIENCE SENTIMENT TRAJECTORY & 6-MONTH FORECAST</span>
            </h2>
            <span className="px-2 py-0.5 text-[11px] font-mono rounded bg-charcoal border border-steel/60 text-sky">
              Longitudinal Horizon 2011–2027
            </span>
          </div>
          <p className="text-xs text-sky/80 mt-0.5">
            Click any period node to inspect event attribution. Use Full Width mode and Presentation Pins for executive briefings.
          </p>
        </div>

        {/* Action Controls: Presentation Pins & Full Width Toggle */}
        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
          <button
            type="button"
            onClick={() => setShowPinDrawer(!showPinDrawer)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold font-mono border transition ${
              pinnedEventIds.length > 0 || showPinDrawer
                ? 'bg-passion/20 border-passion text-passion'
                : 'bg-charcoal border-steel/60 text-sky hover:text-white hover:border-sky'
            }`}
          >
            <Pin className="w-3.5 h-3.5 fill-current" />
            <span>Pinned Milestones ({pinnedEventIds.length})</span>
            <ChevronDown className={`w-3 h-3 transition-transform ${showPinDrawer ? 'rotate-180' : ''}`} />
          </button>

          <button
            type="button"
            onClick={() => setIsChartExpanded(!isChartExpanded)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-charcoal border border-steel/60 hover:border-sky text-xs font-semibold text-white transition shadow-sm"
            title={isChartExpanded ? 'Switch to side-by-side mode' : 'Expand graph full width'}
          >
            {isChartExpanded ? (
              <>
                <Minimize2 className="w-3.5 h-3.5 text-passion" />
                <span>Side-by-Side Mode</span>
              </>
            ) : (
              <>
                <Maximize2 className="w-3.5 h-3.5 text-sky" />
                <span>Full Width Presentation</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Presentation Callouts Pinning Drawer */}
      {showPinDrawer && (
        <div className="mb-4 p-3.5 rounded-lg bg-[#16191d] border border-passion/50 shadow-inner space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-steel/40 pb-2">
            <div>
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-passion" />
                <span>EXECUTIVE PINNING MANAGER</span>
              </span>
              <p className="text-[11px] text-sky/80">
                Select any key milestone below to pin clean numbered reference markers directly onto the timeline chart.
              </p>
            </div>
            <input
              type="text"
              value={pinSearch}
              onChange={(e) => setPinSearch(e.target.value)}
              placeholder="Search key events..."
              className="px-2.5 py-1 text-xs rounded bg-charcoal border border-steel text-white placeholder-steel/70 focus:outline-none focus:border-passion w-full sm:w-56"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-56 overflow-y-auto pr-1">
            {starredEventsForPinning.map((ev) => {
              const isPinned = pinnedEventIds.includes(ev.id);
              return (
                <button
                  key={ev.id}
                  type="button"
                  onClick={() => togglePinnedEvent(ev.id)}
                  className={`flex items-start gap-2 p-2 rounded text-left text-xs transition border ${
                    isPinned
                      ? 'bg-passion/15 border-passion text-white font-medium'
                      : 'bg-[#1e2227] border-steel/40 text-sky hover:text-white hover:border-steel'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded mt-0.5 flex items-center justify-center shrink-0 border ${
                      isPinned ? 'bg-passion border-passion text-white' : 'border-steel'
                    }`}
                  >
                    {isPinned && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] font-mono text-passion block">{ev.eventDate}</span>
                    <span className="truncate block font-semibold text-white">{ev.title}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Interactive Series Filter Toggles */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 mb-2 text-xs">
        <button
          onClick={() => toggleLine('composite')}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded border transition font-medium whitespace-nowrap ${
            visibleLines.composite
              ? 'bg-charcoal border-white text-white font-bold'
              : 'bg-charcoal/40 border-steel/40 text-steel'
          }`}
        >
          <span className="w-3 h-1 bg-white rounded-full inline-block" />
          <span>Composite ({result.weights.executive}/{result.weights.congress}/{result.weights.navy}/{result.weights.public})</span>
        </button>

        {ALL_AUDIENCES.map((aud) => (
          <button
            key={aud}
            onClick={() => toggleLine(aud)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded border transition whitespace-nowrap ${
              visibleLines[aud]
                ? 'bg-charcoal border-sky/60 text-white font-medium'
                : 'bg-charcoal/40 border-steel/40 text-steel'
            }`}
          >
            <span
              className="w-2.5 h-2.5 rounded-full inline-block"
              style={{ backgroundColor: AUDIENCE_COLORS[aud] }}
            />
            <span>{AUDIENCE_LABELS[aud]}</span>
          </button>
        ))}
      </div>

      {/* Clean Timeline Phase Header Track (Completely resolves overlapping text) */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-[#14171a] border border-[#2d333b] rounded-lg mb-2 text-xs font-mono">
        <div className="flex items-center gap-1.5 text-steel text-[11px] font-sans">
          <Calendar className="w-3.5 h-3.5 text-sky" />
          <span className="font-semibold text-white/90">Timeline Granularity:</span>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-[11px]">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: PHASE_COLORS.annual }} />
            <span className="text-white/80 font-medium">2011–2025 Annual (15 Years)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: PHASE_COLORS.quarterly }} />
            <span className="text-white/80 font-medium">2026 Q1–Q3 Quarterly</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: PHASE_COLORS.monthly }} />
            <span className="text-white/80 font-medium">2026-10 Monthly</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: PHASE_COLORS.forecast }} />
            <span className="text-passion font-semibold">2026-11 → 2027-05 6-Mo Forecast</span>
          </div>
        </div>
      </div>

      {/* Main Chart Canvas (Balanced aspect ratio) */}
      <div className="w-full bg-[#16191d] rounded-lg border border-[#2d333b] p-2 transition-all duration-300 h-[430px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={data}
            margin={{ top: 24, right: 24, left: 4, bottom: 12 }}
            onClick={(stateObj) => {
              if (stateObj && stateObj.activeLabel) {
                const match = data.find((d) => d.id === stateObj.activeLabel);
                if (match && !match.isForecast) {
                  setSelectedPeriodId(match.id);
                }
              }
            }}
          >
            <CartesianGrid stroke="#363c44" strokeDasharray="3 3" strokeOpacity={0.6} />
            <XAxis
              dataKey="id"
              stroke="#8b98a5"
              tick={{ fill: '#ffffff', fontSize: 11, fontFamily: 'JetBrains Mono' }}
              interval={0}
              angle={-30}
              textAnchor="end"
              height={52}
            />
            <YAxis
              domain={[20, 100]}
              stroke="#8b98a5"
              tick={{ fill: '#ffffff', fontSize: 11, fontFamily: 'JetBrains Mono' }}
              ticks={[20, 30, 40, 50, 60, 70, 80, 90, 100]}
            />

            {/* Neutral 50.00 Baseline */}
            <ReferenceLine
              y={50}
              stroke="#5b6670"
              strokeDasharray="4 4"
              label={{
                value: 'Neutral Baseline (50.00)',
                position: 'insideBottomLeft',
                fill: '#75abd1',
                fontSize: 10,
              }}
            />

            {/* Subtle Phase Delimiters (No overlapping labels - handled by top header track) */}
            <ReferenceLine
              x="2026-Q1"
              stroke="#509ca2"
              strokeDasharray="3 3"
              strokeWidth={1.5}
            />
            <ReferenceLine
              x="2026-10"
              stroke="#75abd1"
              strokeDasharray="3 3"
              strokeWidth={1.5}
            />
            <ReferenceLine
              x="2026-11"
              stroke="#ea7722"
              strokeWidth={1.5}
              strokeDasharray="4 2"
            />

            {/* Selected Period Highlight */}
            {selectedPeriodId && (
              <ReferenceLine x={selectedPeriodId} stroke="#ea7722" strokeOpacity={0.6} strokeWidth={2.5} />
            )}

            {/* Pinned Presentation Callout Markers (Clean numbered badges only, zero top text collision) */}
            {orderedPinnedList.map(({ event: ev, periodId, badge }) => (
              <ReferenceLine
                key={`pin_${ev.id}`}
                x={periodId}
                stroke="#ea7722"
                strokeWidth={1.5}
                strokeDasharray="3 2"
                label={{
                  value: badge,
                  position: 'top',
                  fill: '#ea7722',
                  fontSize: 13,
                  fontWeight: 'bold',
                }}
              />
            ))}

            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload || !payload.length) return null;
                const d = payload[0]?.payload as ChartDatum;
                return (
                  <div className="bg-[#1e2227] border border-sky rounded-lg p-3 shadow-2xl text-xs max-w-sm">
                    <div className="flex items-center justify-between gap-3 border-b border-steel/60 pb-1.5 mb-2">
                      <span className="font-bold text-white font-mono">
                        {d.label} {d.isForecast && <span className="text-passion">(Forecast)</span>}
                      </span>
                      {d.composite !== undefined && (
                        <span className="font-mono font-bold text-white text-sm">
                          {d.composite.toFixed(2)}
                        </span>
                      )}
                      {d.forecastEv !== undefined && d.isForecast && (
                        <span className="font-mono font-bold text-passion text-sm">
                          EV {d.forecastEv.toFixed(2)}
                        </span>
                      )}
                    </div>

                    {!d.isForecast && (
                      <div className="space-y-1 font-mono text-[11px]">
                        <div className="flex justify-between">
                          <span className="text-[#75abd1]">Executive:</span>
                          <span className="text-white">{d.executive?.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[#509ca2]">Congress:</span>
                          <span className="text-white">{d.congress?.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[#38bdf8]">Navy:</span>
                          <span className="text-white">{d.navy?.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[#9ca3af]">Public:</span>
                          <span className="text-white">{d.public?.toFixed(2)}</span>
                        </div>
                      </div>
                    )}

                    {d.isForecast && d.forecastP10 !== undefined && d.forecastP90 !== undefined && (
                      <div className="font-mono text-[11px] text-sky space-y-1">
                        <div className="flex justify-between">
                          <span>Confidence Band (80%):</span>
                          <span>
                            [{d.forecastP10.toFixed(2)} – {d.forecastP90.toFixed(2)}]
                          </span>
                        </div>
                      </div>
                    )}

                    {d.keyEventCount > 0 && (
                      <div className="mt-2 pt-2 border-t border-steel/50 text-[10px] text-sky">
                        <span className="font-bold text-white">⭐ {d.keyEventCount} Starred Event(s)</span>
                        <ul className="list-disc list-inside mt-0.5 space-y-0.5">
                          {d.keyEventTitles.slice(0, 3).map((t, idx) => (
                            <li key={idx} className="truncate">{t}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                );
              }}
            />

            {/* Forecast Confidence Fan Area (P10 to P90) */}
            <Area
              type="monotone"
              dataKey="forecastP90"
              stroke="#ea7722"
              strokeWidth={1}
              strokeDasharray="2 2"
              fill="#ea7722"
              fillOpacity={0.18}
              name="Forecast P90"
              isAnimationActive={false}
            />
            <Area
              type="monotone"
              dataKey="forecastP10"
              stroke="#ea7722"
              strokeWidth={1}
              strokeDasharray="2 2"
              fill="#16191d"
              fillOpacity={1}
              name="Forecast P10"
              isAnimationActive={false}
            />

            {/* Historical Series Lines */}
            {visibleLines.executive && (
              <Line
                type="monotone"
                dataKey="executive"
                stroke={AUDIENCE_COLORS.executive}
                strokeWidth={2}
                dot={false}
                name="Executive"
                isAnimationActive={false}
              />
            )}
            {visibleLines.congress && (
              <Line
                type="monotone"
                dataKey="congress"
                stroke={AUDIENCE_COLORS.congress}
                strokeWidth={2}
                dot={false}
                name="Congress"
                isAnimationActive={false}
              />
            )}
            {visibleLines.navy && (
              <Line
                type="monotone"
                dataKey="navy"
                stroke={AUDIENCE_COLORS.navy}
                strokeWidth={2}
                dot={false}
                name="Navy"
                isAnimationActive={false}
              />
            )}
            {visibleLines.public && (
              <Line
                type="monotone"
                dataKey="public"
                stroke={AUDIENCE_COLORS.public}
                strokeWidth={2}
                dot={false}
                name="Public"
                isAnimationActive={false}
              />
            )}

            {/* Composite Historical Line */}
            {visibleLines.composite && (
              <Line
                type="monotone"
                dataKey="composite"
                stroke="#ffffff"
                strokeWidth={3}
                dot={{ r: 4, fill: '#ea7722', stroke: '#ffffff', strokeWidth: 1.5 }}
                activeDot={{ r: 6, fill: '#ea7722', stroke: '#ffffff', strokeWidth: 2 }}
                name="Composite"
                isAnimationActive={false}
              />
            )}

            {/* Forecast Expected Value Line */}
            <Line
              type="monotone"
              dataKey="forecastEv"
              stroke="#ea7722"
              strokeWidth={2.5}
              strokeDasharray="4 3"
              dot={{ r: 3.5, fill: '#ffffff', stroke: '#ea7722', strokeWidth: 1.5 }}
              name="Forecast EV"
              isAnimationActive={false}
            />

            {/* Starred Key Event Dots */}
            {data
              .filter((d) => d.keyEventCount > 0 && !d.isForecast)
              .map((d) => (
                <ReferenceDot
                  key={`star_${d.id}`}
                  x={d.id}
                  y={95}
                  r={3.5}
                  fill="#ea7722"
                  stroke="#ffffff"
                  strokeWidth={1}
                />
              ))}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Executive Pinned Milestones Deck (Clean, structured presentation rack) */}
      {orderedPinnedList.length > 0 && (
        <div className="mt-4 border-t border-[#363c44] pt-3">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-white">
              <Pin className="w-3.5 h-3.5 text-passion" />
              <span>Executive Pinned Milestones Deck ({orderedPinnedList.length})</span>
            </div>
            <span className="text-[11px] text-sky/75">
              Corresponds to numbered markers {orderedPinnedList.map((p) => p.badge).join(' ')} on timeline
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
            {orderedPinnedList.map(({ event: ev, periodId, badge }) => {
              const isSelected = selectedPeriodId === periodId;
              return (
                <div
                  key={ev.id}
                  onClick={() => setSelectedPeriodId(periodId)}
                  className={`group relative flex flex-col justify-between p-3 rounded-lg border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-[#222831] border-passion ring-1 ring-passion/60 shadow-lg'
                      : 'bg-[#16191d] border-[#363c44] hover:border-steel hover:bg-[#1a1e23]'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="flex items-center justify-center w-5 h-5 rounded bg-passion/20 border border-passion/50 text-passion text-xs font-mono font-bold">
                          {badge}
                        </span>
                        <span className="text-[11px] font-mono text-white/90 font-semibold">
                          {ev.eventDate}
                        </span>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          togglePinnedEvent(ev.id);
                        }}
                        className="text-steel hover:text-passion p-1 rounded hover:bg-charcoal transition-colors"
                        title="Unpin milestone"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <h4 className="text-xs font-semibold text-white line-clamp-2 leading-snug mb-2 group-hover:text-sky transition-colors">
                      {ev.title}
                    </h4>
                  </div>

                  <div className="flex flex-wrap gap-1 mt-auto pt-2 border-t border-[#2d333b]">
                    {ev.impacts.map((imp) => {
                      const bps = baseBps(imp);
                      const labels: Record<string, string> = {
                        executive: 'Exec',
                        congress: 'Cong',
                        navy: 'Navy',
                        public: 'Pub',
                      };
                      return renderImpactPill(labels[imp.audience] ?? imp.audience, bps);
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default TrendChart;
