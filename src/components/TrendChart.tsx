import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  BarChart3,
  Calendar,
  Check,
  ChevronDown,
  Eye,
  Layers,
  Maximize2,
  Minimize2,
  PieChart,
  Pin,
  Sparkles,
  TrendingDown,
  TrendingUp,
  X,
} from 'lucide-react';
import { useDashboard } from '../context/DashboardContext';
import { ALL_AUDIENCES, AUDIENCE_LABELS, baseBps, bpsToDisplay, type AudienceId, type ImpactEvent } from '../engine';
import {
  SentimentHoverTooltip,
  PeriodBreakdownModal,
  buildSourceMixFromEvents,
  type HoverChartMode,
  type PeriodBreakdownEvent,
  type SourceSlice,
} from './SentimentHoverTooltip';

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
  // Markers & Source Mix Breakdown
  keyEventCount: number;
  keyEventTitles: string[];
  keyMarkerY?: number;
  revisionCount: number;
  revisionMarkerY?: number;
  sourceMix: SourceSlice[];
  totalImpactingEvents: number;
  periodEvents: PeriodBreakdownEvent[];
  tooltipSubtitle?: string;
}

const AUDIENCE_COLORS: Record<AudienceId, string> = {
  executive: '#75abd1', // Sky Blue
  congress: '#509ca2',  // Changing Sea
  navy: '#38bdf8',      // Naval Bright Sky
  public: '#9ca3af',    // Steel Silver
};

const PHASE_COLORS = {
  annual: '#98a6b3',
  quarterly: '#509ca2',
  monthly: '#75abd1',
  forecast: '#ea7722',
};

const PHASE_META = [
  { key: 'annual', label: '2011–2025 Annual', color: PHASE_COLORS.annual },
  { key: 'quarterly', label: '2026 Q1–Q3 Quarterly', color: PHASE_COLORS.quarterly },
  { key: 'monthly', label: '2026-10 Monthly', color: PHASE_COLORS.monthly },
  { key: 'forecast', label: '6-Mo Forecast', color: PHASE_COLORS.forecast },
] as const;

const SERIES_ORDER: AudienceId[] = ['navy', 'executive', 'congress', 'public'];

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
  const [hoverMode, setHoverMode] = useState<HoverChartMode>('scores');
  const [inspectedPeriodId, setInspectedPeriodId] = useState<string | null>(null);
  const chartScrollRef = useRef<HTMLDivElement>(null);
  const hoveredIdRef = useRef<string | null>(null);
  const lastClickRef = useRef<{ id: string; time: number } | null>(null);

  useEffect(() => {
    const el = chartScrollRef.current;
    if (el && el.scrollWidth > el.clientWidth) {
      el.scrollLeft = el.scrollWidth - el.clientWidth;
    }
  }, [result.timeline.length, isChartExpanded]);

  const eventMap = useMemo(() => new Map(state.events.map((e) => [e.id, e])), [state.events]);
  const catalystMap = useMemo(() => new Map(state.catalysts.map((c) => [c.id, c])), [state.catalysts]);

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

      const contributingIds = new Set<string>();
      for (const a of ALL_AUDIENCES) {
        for (const c of pt.audiences[a].contributions) {
          contributingIds.add(c.eventId);
        }
      }
      const contributingEvents = Array.from(contributingIds)
        .map((id) => eventMap.get(id))
        .filter((ev): ev is ImpactEvent => ev !== undefined)
        .sort((a, b) => (b.eventDate > a.eventDate ? 1 : -1));
      const sourceMix = buildSourceMixFromEvents(contributingEvents);

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
        keyMarkerY: keyCount > 0 ? 22 : undefined,
        revisionCount: revCount,
        revisionMarkerY: revCount > 0 ? 98 : undefined,
        sourceMix,
        totalImpactingEvents: contributingEvents.length,
        periodEvents: contributingEvents.map((e) => ({
          id: e.id,
          title: e.title,
          eventDate: e.eventDate,
          sourceType: e.sourceType,
          starred: e.starred,
        })),
        tooltipSubtitle: `${pt.inPeriodEventIds.length} new in period · ${contributingEvents.length} active drivers`,
      });
    }

    // 2. Forecast points
    const lastHist = list[list.length - 1];

    for (const fc of result.forecast) {
      const activeCats = fc.activeCatalystIds
        .map((id) => catalystMap.get(id))
        .filter((c): c is NonNullable<typeof c> => c !== undefined);
      const fcMix = buildSourceMixFromEvents(activeCats);

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
        keyEventTitles: activeCats.map((c) => c.title),
        revisionCount: 0,
        sourceMix: fcMix,
        totalImpactingEvents: activeCats.length,
        periodEvents: activeCats.map((c) => ({
          id: c.id,
          title: `${c.title} (${c.probability}% prob)`,
          eventDate: c.expectedMonth,
          sourceType: c.sourceType,
          starred: true,
        })),
        tooltipSubtitle: `${activeCats.length} active scenario catalyst(s)`,
      });
    }

    // Bridge the gap between last historical point and first forecast point
    if (lastHist && result.forecast.length > 0 && lastHist.composite !== undefined) {
      lastHist.forecastEv = lastHist.composite;
      lastHist.forecastExecEv = lastHist.executive;
      lastHist.forecastCongEv = lastHist.congress;
      lastHist.forecastNavyEv = lastHist.navy;
      lastHist.forecastPublicEv = lastHist.public;
      lastHist.forecastP10 = lastHist.composite;
      lastHist.forecastP90 = lastHist.composite;
      lastHist.forecastBand = [lastHist.composite, lastHist.composite];
    }

    return list;
  }, [result.timeline, result.forecast, revisionsByPeriod, eventMap, catalystMap]);

  const selectedPeriodLabel = useMemo(
    () => data.find((d) => d.id === selectedPeriodId)?.label ?? data.filter((d) => !d.isForecast).slice(-1)[0]?.label ?? 'Latest',
    [data, selectedPeriodId],
  );

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
        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-mono font-medium tabular-nums border ${
          isPositive
            ? 'bg-lift/10 text-lift border-lift/30'
            : 'bg-drag/10 text-drag border-drag/30'
        }`}
      >
        <span className="text-muted font-sans">{label}:</span>
        {isPositive ? (
          <TrendingUp className="w-3 h-3 inline text-lift" />
        ) : (
          <TrendingDown className="w-3 h-3 inline text-drag" />
        )}
        <span>{bpsToDisplay(bps)} pts</span>
      </span>
    );
  };

  return (
    <section
      aria-label="Multi-Audience Sentiment Trajectory and Forecast"
      className="bg-surface1 border border-hairline rounded-xl p-4 shadow-xl transition-all"
    >
      {/* Unified 2-Row Chart Header & Controls */}
      <div className="space-y-2.5 pb-3 border-b border-hairline mb-3">
        {/* Row 1: Title + Action Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex flex-wrap items-center gap-2 min-w-0">
            <Layers className="w-4 h-4 text-sky shrink-0" />
            <h2 className="text-sm sm:text-base font-bold text-white tracking-wide">
              Sentiment Trajectory &amp; 6-Month Forecast
            </h2>
            <span className="px-2 py-0.5 text-[11px] font-mono tabular-nums rounded bg-surface0 border border-hairline text-muted">
              2011–2027
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto shrink-0">
            <div
              role="group"
              aria-label="Hover tooltip display mode"
              className="inline-flex items-center rounded-lg bg-surface0 border border-hairline p-0.5 text-xs font-mono"
              title="Switch compact hover chart between Audience Scores and Source Mix"
            >
              <button
                type="button"
                onClick={() => setHoverMode('scores')}
                aria-pressed={hoverMode === 'scores'}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition ${
                  hoverMode === 'scores'
                    ? 'bg-passion-solid text-white font-bold shadow-sm'
                    : 'text-muted hover:text-white'
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5" />
                <span>Scores</span>
              </button>
              <button
                type="button"
                onClick={() => setHoverMode('sources')}
                aria-pressed={hoverMode === 'sources'}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition ${
                  hoverMode === 'sources'
                    ? 'bg-passion-solid text-white font-bold shadow-sm'
                    : 'text-muted hover:text-white'
                }`}
              >
                <PieChart className="w-3.5 h-3.5" />
                <span>Sources</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                const targetId = selectedPeriodId || result.timeline[result.timeline.length - 1]?.period.id;
                if (targetId) setInspectedPeriodId(targetId);
              }}
              aria-label={`Inspect period breakdown for ${selectedPeriodLabel}`}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-surface0 border border-hairline hover:border-sky text-xs font-medium text-white transition"
              title="Open visual Score & Source Mix breakdown modal for the selected period"
            >
              <Eye className="w-3.5 h-3.5 text-sky" />
              <span>Inspect ({selectedPeriodLabel})</span>
            </button>

            <button
              type="button"
              onClick={() => setShowPinDrawer(!showPinDrawer)}
              aria-expanded={showPinDrawer}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-mono tabular-nums border transition ${
                pinnedEventIds.length > 0 || showPinDrawer
                  ? 'bg-passion/15 border-passion/60 text-passion font-semibold'
                  : 'bg-surface0 border-hairline text-muted hover:text-white hover:border-sky'
              }`}
            >
              <Pin className="w-3.5 h-3.5 fill-current" />
              <span>Pins ({pinnedEventIds.length})</span>
              <ChevronDown className={`w-3 h-3 transition-transform ${showPinDrawer ? 'rotate-180' : ''}`} />
            </button>

            <button
              type="button"
              onClick={() => setIsChartExpanded(!isChartExpanded)}
              aria-pressed={isChartExpanded}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-surface0 border border-hairline hover:border-sky text-xs font-medium text-white transition shadow-sm"
              title={isChartExpanded ? 'Switch to side-by-side mode' : 'Expand graph full width'}
            >
              {isChartExpanded ? (
                <>
                  <Minimize2 className="w-3.5 h-3.5 text-passion" />
                  <span>Side-by-Side</span>
                </>
              ) : (
                <>
                  <Maximize2 className="w-3.5 h-3.5 text-sky" />
                  <span>Full Width</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Row 2: Series Toggle Pills + Inline Phase Granularity Key */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar text-xs">
            <button
              type="button"
              onClick={() => toggleLine('composite')}
              aria-pressed={visibleLines.composite}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded border transition font-medium whitespace-nowrap ${
                visibleLines.composite
                  ? 'bg-surface2 border-white/70 text-white font-semibold'
                  : 'bg-surface0 border-hairline text-muted opacity-65'
              }`}
            >
              <span className="w-3 h-1 bg-white rounded-full inline-block" />
              <span>Composite</span>
            </button>

            {SERIES_ORDER.map((aud) => (
              <button
                key={aud}
                type="button"
                onClick={() => toggleLine(aud)}
                aria-pressed={visibleLines[aud]}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded border transition whitespace-nowrap ${
                  visibleLines[aud]
                    ? 'bg-surface2 border-sky/50 text-white font-medium'
                    : 'bg-surface0 border-hairline text-muted opacity-65'
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

          <div className="hidden md:flex items-center gap-3 text-[11px] font-mono text-muted">
            <Calendar className="w-3.5 h-3.5 text-sky shrink-0" />
            {PHASE_META.map((ph) => (
              <span key={ph.key} className="inline-flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: ph.color }} />
                <span>{ph.label}</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Presentation Callouts Pinning Drawer */}
      {showPinDrawer && (
        <div className="mb-3 p-3.5 rounded-lg bg-surface0 border border-hairline shadow-inner space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-hairline pb-2">
            <div>
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-passion" />
                <span>Executive Pinning Manager</span>
              </span>
              <p className="text-xs text-muted">
                Select key milestones to pin clean numbered reference markers onto the timeline.
              </p>
            </div>
            <input
              type="text"
              aria-label="Filter starred milestones"
              value={pinSearch}
              onChange={(e) => setPinSearch(e.target.value)}
              placeholder="Search key events..."
              className="px-2.5 py-1 text-xs rounded bg-surface1 border border-hairline text-white placeholder-muted focus:outline-none focus:border-sky w-full sm:w-56"
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
                      : 'bg-surface1 border-hairline text-muted hover:text-white hover:border-sky'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded mt-0.5 flex items-center justify-center shrink-0 border ${
                      isPinned ? 'bg-passion-solid border-passion-solid text-white' : 'border-hairline'
                    }`}
                  >
                    {isPinned && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>
                  <div className="min-w-0">
                    <span className="text-[11px] font-mono tabular-nums text-sky block">{ev.eventDate}</span>
                    <span className="truncate block font-semibold text-white">{ev.title}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Chart Canvas: Horizontally scrollable on mobile (auto-focused on recent months & forecast) */}
      <div className="sm:hidden flex items-center justify-between text-xs font-mono text-sky bg-surface0 border border-hairline rounded px-2.5 py-1.5 mb-1.5">
        <span>← Swipe timeline for history</span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => chartScrollRef.current?.scrollTo({ left: 0, behavior: 'smooth' })}
            className="px-2 py-0.5 rounded bg-surface1 border border-hairline text-xs text-muted hover:text-white"
          >
            2011
          </button>
          <button
            type="button"
            onClick={() => {
              const el = chartScrollRef.current;
              if (el) el.scrollTo({ left: el.scrollWidth - el.clientWidth, behavior: 'smooth' });
            }}
            className="px-2 py-0.5 rounded bg-passion-solid text-xs text-white font-bold"
          >
            Recent →
          </button>
        </div>
      </div>

      <div
        ref={chartScrollRef}
        onDoubleClick={() => {
          if (hoveredIdRef.current) setInspectedPeriodId(hoveredIdRef.current);
        }}
        className="w-full bg-surface0 rounded-lg border border-hairline p-2 overflow-x-auto sm:overflow-x-visible transition-all duration-300"
      >
        <div className="min-w-[980px] sm:min-w-0 w-full h-[360px] sm:h-[430px]">
          <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={data}
            margin={{ top: 24, right: 24, left: 4, bottom: 12 }}
            onClick={(stateObj) => {
              if (stateObj && stateObj.activeLabel) {
                const match = data.find((d) => d.id === stateObj.activeLabel);
                if (match) {
                  if (!match.isForecast) setSelectedPeriodId(match.id);
                  const now = Date.now();
                  if (lastClickRef.current && lastClickRef.current.id === match.id && now - lastClickRef.current.time < 400) {
                    setInspectedPeriodId(match.id);
                    lastClickRef.current = null;
                  } else {
                    lastClickRef.current = { id: match.id, time: now };
                  }
                }
              }
            }}
          >
            <CartesianGrid stroke="#2e353d" strokeDasharray="3 3" strokeOpacity={0.7} vertical={false} />
            <XAxis
              dataKey="id"
              stroke="#98a6b3"
              tick={{ fill: '#98a6b3', fontSize: 11, fontFamily: 'IBM Plex Mono' }}
              interval={0}
              angle={-30}
              textAnchor="end"
              height={52}
            />
            <YAxis
              domain={[18, 100]}
              stroke="#98a6b3"
              tick={{ fill: '#98a6b3', fontSize: 11, fontFamily: 'IBM Plex Mono' }}
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
                fill: '#98a6b3',
                fontSize: 11,
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
                hoveredIdRef.current = d.id;
                return (
                  <SentimentHoverTooltip
                    mode={hoverMode}
                    label={d.label}
                    isForecast={d.isForecast}
                    composite={d.isForecast ? d.forecastEv : d.composite}
                    scores={{
                      executive: d.isForecast ? d.forecastExecEv : d.executive,
                      congress: d.isForecast ? d.forecastCongEv : d.congress,
                      navy: d.isForecast ? d.forecastNavyEv : d.navy,
                      public: d.isForecast ? d.forecastPublicEv : d.public,
                    }}
                    p10={d.forecastP10}
                    p90={d.forecastP90}
                    sourceMix={d.sourceMix}
                    totalImpactingEvents={d.totalImpactingEvents}
                    subtitle={d.tooltipSubtitle}
                  />
                );
              }}
            />

            {/* Forecast Confidence Fan Area (Ranged P10 to P90 preserving gridlines & Neutral baseline) */}
            <Area
              type="monotone"
              dataKey="forecastBand"
              stroke="#ea7722"
              strokeWidth={1}
              strokeDasharray="2 2"
              fill="#ea7722"
              fillOpacity={0.18}
              name="Forecast P10–P90"
              isAnimationActive={false}
              connectNulls={false}
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

            {/* Forecast Audience Lines */}
            {visibleLines.executive && (
              <Line
                type="monotone"
                dataKey="forecastExecEv"
                stroke={AUDIENCE_COLORS.executive}
                strokeWidth={1.35}
                strokeDasharray="3 3"
                strokeOpacity={0.65}
                dot={false}
                isAnimationActive={false}
              />
            )}
            {visibleLines.congress && (
              <Line
                type="monotone"
                dataKey="forecastCongEv"
                stroke={AUDIENCE_COLORS.congress}
                strokeWidth={1.35}
                strokeDasharray="3 3"
                strokeOpacity={0.65}
                dot={false}
                isAnimationActive={false}
              />
            )}
            {visibleLines.navy && (
              <Line
                type="monotone"
                dataKey="forecastNavyEv"
                stroke={AUDIENCE_COLORS.navy}
                strokeWidth={1.35}
                strokeDasharray="3 3"
                strokeOpacity={0.65}
                dot={false}
                isAnimationActive={false}
              />
            )}
            {visibleLines.public && (
              <Line
                type="monotone"
                dataKey="forecastPublicEv"
                stroke={AUDIENCE_COLORS.public}
                strokeWidth={1.35}
                strokeDasharray="3 3"
                strokeOpacity={0.65}
                dot={false}
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
                dot={{ r: 3.5, fill: '#ea7722', stroke: '#ffffff', strokeWidth: 1.5 }}
                activeDot={{ r: 6, fill: '#ea7722', stroke: '#ffffff', strokeWidth: 2 }}
                name="Composite"
                isAnimationActive={false}
              />
            )}

            {/* Forecast Expected Value Line */}
            {visibleLines.composite && (
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
            )}

            {/* Starred Key Event Baseline Markers (y=22 so they never collide with upper curves or top pins) */}
            {data
              .filter((d) => d.keyEventCount > 0 && !d.isForecast)
              .map((d) => (
                <ReferenceDot
                  key={`star_${d.id}`}
                  x={d.id}
                  y={22}
                  r={3}
                  fill="#75abd1"
                  stroke="#16191d"
                  strokeWidth={1.5}
                />
              ))}
          </ComposedChart>
        </ResponsiveContainer>
        </div>
      </div>

      {/* Executive Pinned Milestones Deck (Accessible semantic <button> + sibling unpin control) */}
      {orderedPinnedList.length > 0 && (
        <div className="mt-4 border-t border-hairline pt-3">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-white">
              <Pin className="w-3.5 h-3.5 text-passion" />
              <span>Executive Pinned Milestones Deck ({orderedPinnedList.length})</span>
            </div>
            <span className="text-xs text-muted hidden sm:inline">
              Markers {orderedPinnedList.map((p) => p.badge).join(' ')} on timeline
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
            {orderedPinnedList.map(({ event: ev, periodId, badge }) => {
              const isSelected = selectedPeriodId === periodId;
              return (
                <div
                  key={ev.id}
                  className={`group relative rounded-lg border transition-all ${
                    isSelected
                      ? 'bg-surface2 border-sky ring-1 ring-sky/40 shadow-lg'
                      : 'bg-surface0 border-hairline hover:border-sky/60 hover:bg-surface2/60'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedPeriodId(periodId)}
                    className="w-full h-full flex flex-col justify-between p-3 pr-9 text-left rounded-lg"
                  >
                    <div>
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <span className="flex items-center justify-center w-5 h-5 rounded bg-passion/20 border border-passion/50 text-passion text-xs font-mono font-bold tabular-nums">
                          {badge}
                        </span>
                        <span className="text-[11px] font-mono tabular-nums text-white font-semibold">
                          {ev.eventDate}
                        </span>
                      </div>

                      <h4 className="text-xs font-semibold text-white line-clamp-2 leading-snug mb-2 group-hover:text-sky transition-colors">
                        {ev.title}
                      </h4>
                    </div>

                    <div className="w-full flex flex-wrap gap-1 mt-auto pt-2 border-t border-hairline">
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
                  </button>

                  <button
                    type="button"
                    onClick={() => togglePinnedEvent(ev.id)}
                    aria-label={`Unpin ${ev.title}`}
                    className="absolute top-2.5 right-2.5 text-muted hover:text-white p-1 rounded hover:bg-surface2 transition-colors"
                    title="Unpin milestone"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Full Visual Breakdown Inspector Modal (Opened on double-click) */}
      {(() => {
        const inspected = inspectedPeriodId ? data.find((d) => d.id === inspectedPeriodId) : null;
        if (!inspected) return null;
        return (
          <PeriodBreakdownModal
            isOpen={true}
            onClose={() => setInspectedPeriodId(null)}
            label={inspected.label}
            isForecast={inspected.isForecast}
            composite={inspected.isForecast ? inspected.forecastEv : inspected.composite}
            scores={{
              executive: inspected.isForecast ? inspected.forecastExecEv : inspected.executive,
              congress: inspected.isForecast ? inspected.forecastCongEv : inspected.congress,
              navy: inspected.isForecast ? inspected.forecastNavyEv : inspected.navy,
              public: inspected.isForecast ? inspected.forecastPublicEv : inspected.public,
            }}
            p10={inspected.forecastP10}
            p90={inspected.forecastP90}
            sourceMix={inspected.sourceMix}
            totalImpactingEvents={inspected.totalImpactingEvents}
            keyEventTitles={inspected.keyEventTitles}
            periodEvents={inspected.periodEvents}
            subtitle={inspected.tooltipSubtitle}
          />
        );
      })()}
    </section>
  );
};

export default TrendChart;
