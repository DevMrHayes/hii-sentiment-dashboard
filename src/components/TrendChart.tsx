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
  Check,
  ChevronDown,
  Eye,
  GitCommit,
  Maximize2,
  Minimize2,
  Pin,
  PinOff,
  Sliders,
  Sparkles,
  Star,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { useDashboard } from '../context/DashboardContext';
import { ALL_AUDIENCES, AUDIENCE_LABELS, type AudienceId, type ImpactEvent } from '../engine';

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

  const data: ChartDatum[] = useMemo(() => {
    const rows: ChartDatum[] = [];
    const lastIdx = result.timeline.length - 1;

    result.timeline.forEach((rec, idx) => {
      const comp = rec.compositeCenti / 100;
      const exec = rec.audiences.executive.scoreCenti / 100;
      const cong = rec.audiences.congress.scoreCenti / 100;
      const navy = rec.audiences.navy.scoreCenti / 100;
      const pub = rec.audiences.public.scoreCenti / 100;
      const revCount = revisionsByPeriod.get(rec.period.id) ?? 0;
      const keyTitles = rec.keyEventIds.map((id) => eventMap.get(id)?.title ?? id);

      const datum: ChartDatum = {
        id: rec.period.id,
        label: rec.period.label,
        granularity: rec.period.granularity,
        isForecast: false,
        startDate: rec.period.startDate,
        endDate: rec.period.endDate,
        executive: exec,
        congress: cong,
        navy,
        public: pub,
        composite: comp,
        keyEventCount: rec.keyEventIds.length,
        keyEventTitles: keyTitles,
        keyMarkerY: rec.keyEventIds.length > 0 ? comp : undefined,
        revisionCount: revCount,
        revisionMarkerY: revCount > 0 ? comp : undefined,
      };

      if (idx === lastIdx) {
        datum.forecastEv = comp;
        datum.forecastExecEv = exec;
        datum.forecastCongEv = cong;
        datum.forecastNavyEv = navy;
        datum.forecastPublicEv = pub;
        datum.forecastBand = [comp, comp];
        datum.forecastP10 = comp;
        datum.forecastP90 = comp;
      }

      rows.push(datum);
    });

    for (const fp of result.forecast) {
      const ev = fp.composite.evCenti / 100;
      const p10 = fp.composite.p10Centi / 100;
      const p90 = fp.composite.p90Centi / 100;
      rows.push({
        id: fp.period.id,
        label: fp.period.label,
        granularity: 'forecast',
        isForecast: true,
        forecastEv: ev,
        forecastExecEv: fp.audiences.executive.evCenti / 100,
        forecastCongEv: fp.audiences.congress.evCenti / 100,
        forecastNavyEv: fp.audiences.navy.evCenti / 100,
        forecastPublicEv: fp.audiences.public.evCenti / 100,
        forecastBand: [p10, p90],
        forecastP10: p10,
        forecastP90: p90,
        keyEventCount: 0,
        keyEventTitles: [],
        revisionCount: 0,
      });
    }

    return rows;
  }, [result, eventMap, revisionsByPeriod]);

  // Find period IDs where pinned events fall
  const pinnedEventsWithPeriod = useMemo(() => {
    return pinnedEventIds
      .map((id) => {
        const ev = eventMap.get(id);
        if (!ev) return null;
        // Match which period bucket contains this event date
        const matchPeriod = result.timeline.find(
          (p) => ev.eventDate >= p.period.startDate && ev.eventDate <= p.period.endDate,
        );
        return {
          event: ev,
          periodId: matchPeriod?.period.id ?? ev.eventDate.slice(0, 4),
          periodLabel: matchPeriod?.period.label ?? ev.eventDate.slice(0, 4),
        };
      })
      .filter((x): x is { event: ImpactEvent; periodId: string; periodLabel: string } => x !== null);
  }, [pinnedEventIds, eventMap, result.timeline]);

  const starredEventsForPinning = useMemo(() => {
    return state.events
      .filter((e) => e.starred)
      .filter((e) => {
        if (!pinSearch.trim()) return true;
        const q = pinSearch.toLowerCase();
        return e.title.toLowerCase().includes(q) || e.eventDate.includes(q);
      })
      .sort((a, b) => b.eventDate.localeCompare(a.eventDate));
  }, [state.events, pinSearch]);

  const toggleLine = (key: AudienceId | 'composite') => {
    setVisibleLines((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="bg-[#1e2227] border border-[#363c44] rounded-xl p-4 shadow-xl transition-all">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-bold text-white tracking-wide flex items-center gap-2">
              <span>MULTI-AUDIENCE SENTIMENT TRAJECTORY & 6-MONTH FORECAST</span>
            </h2>
            <span className="px-2 py-0.5 text-[11px] font-mono rounded bg-charcoal border border-steel/60 text-sky">
              2011–2025 Annual · 2026 Q1–Q3 Quarterly · Q4 Monthly · Forecast
            </span>
          </div>
          <p className="text-xs text-sky/80 mt-0.5">
            Click any period node to inspect event attribution. Use Presentation Mode to highlight and pin key events for executive briefings.
          </p>
        </div>

        {/* Action Controls: Presentation Pins & Expand/Contract */}
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
            <span>Pinned Callouts ({pinnedEventIds.length})</span>
            <ChevronDown className={`w-3 h-3 transition-transform ${showPinDrawer ? 'rotate-180' : ''}`} />
          </button>

          <button
            type="button"
            onClick={() => setIsChartExpanded((prev) => !prev)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-charcoal border border-steel/60 hover:border-sky text-xs font-semibold text-white transition shadow-sm"
            title={isChartExpanded ? 'Collapse Graph Height' : 'Expand Graph for Large Presentations'}
          >
            {isChartExpanded ? (
              <>
                <Minimize2 className="w-3.5 h-3.5 text-passion" />
                <span>Compact</span>
              </>
            ) : (
              <>
                <Maximize2 className="w-3.5 h-3.5 text-sky" />
                <span>Enlarge</span>
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
                <span>PRESENTATION PINNING MANAGER</span>
              </span>
              <p className="text-[11px] text-sky/80">
                Check any starred milestone below to project a vertical callout line and annotated banner directly onto the timeline chart.
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

      {/* Main Chart Canvas (Enlargeable Height) */}
      <div
        className={`w-full bg-[#16191d] rounded-lg border border-[#2d333b] p-2 transition-all duration-300 ${
          isChartExpanded ? 'h-[580px]' : 'h-[390px]'
        }`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={data}
            margin={{ top: 20, right: 24, left: 4, bottom: 12 }}
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

            {/* Granularity Transition Dividers */}
            <ReferenceLine
              x="2026-Q1"
              stroke="#509ca2"
              strokeDasharray="3 3"
              label={{ value: 'Quarterly →', position: 'top', fill: '#509ca2', fontSize: 10 }}
            />
            <ReferenceLine
              x="2026-10"
              stroke="#75abd1"
              strokeDasharray="3 3"
              label={{ value: 'Monthly →', position: 'top', fill: '#75abd1', fontSize: 10 }}
            />
            <ReferenceLine
              x="2026-11"
              stroke="#ea7722"
              strokeWidth={1.5}
              strokeDasharray="4 2"
              label={{ value: '6-Mo Forecast →', position: 'top', fill: '#ea7722', fontSize: 10 }}
            />

            {/* Selected Period Highlight */}
            {selectedPeriodId && (
              <ReferenceLine x={selectedPeriodId} stroke="#ea7722" strokeOpacity={0.6} strokeWidth={2.5} />
            )}

            {/* Pinned Presentation Callout Markers */}
            {pinnedEventsWithPeriod.map(({ event: ev, periodId }, i) => (
              <ReferenceLine
                key={`pin_${ev.id}`}
                x={periodId}
                stroke="#ea7722"
                strokeWidth={2}
                strokeDasharray="3 2"
                label={{
                  value: `📌 ${ev.eventDate.slice(0, 4)}: ${ev.title.slice(0, 28)}…`,
                  position: i % 2 === 0 ? 'top' : 'insideTop',
                  fill: '#ffffff',
                  fontSize: 10,
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
                        {d.label} ({d.id})
                      </span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] uppercase font-mono bg-[#16191d] text-sky border border-steel/50">
                        {d.granularity}
                      </span>
                    </div>

                    {!d.isForecast ? (
                      <div className="space-y-1 font-mono">
                        <div className="flex justify-between font-bold text-white">
                          <span>Composite Score:</span>
                          <span>{d.composite?.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-sky">
                          <span>Executive Branch:</span>
                          <span>{d.executive?.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-changingsea">
                          <span>U.S. Congress:</span>
                          <span>{d.congress?.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-[#38bdf8]">
                          <span>Dept. of the Navy:</span>
                          <span>{d.navy?.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-gray-300">
                          <span>American Public:</span>
                          <span>{d.public?.toFixed(2)}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-1 font-mono">
                        <div className="flex justify-between font-bold text-passion">
                          <span>Forecast Composite EV:</span>
                          <span>{d.forecastEv?.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-white">
                          <span>Analytic P10 – P90 Band:</span>
                          <span>
                            [{d.forecastP10?.toFixed(2)} – {d.forecastP90?.toFixed(2)}]
                          </span>
                        </div>
                        <div className="flex justify-between text-sky">
                          <span>Executive EV:</span>
                          <span>{d.forecastExecEv?.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-changingsea">
                          <span>Congress EV:</span>
                          <span>{d.forecastCongEv?.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-[#38bdf8]">
                          <span>Navy EV:</span>
                          <span>{d.forecastNavyEv?.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-gray-300">
                          <span>Public EV:</span>
                          <span>{d.forecastPublicEv?.toFixed(2)}</span>
                        </div>
                      </div>
                    )}

                    {d.keyEventCount > 0 && (
                      <div className="mt-2 pt-1.5 border-t border-steel/50 text-passion">
                        <div className="font-semibold flex items-center gap-1">
                          <Star className="w-3 h-3 fill-passion" />
                          <span>{d.keyEventCount} Starred Key Event(s):</span>
                        </div>
                        <ul className="list-disc list-inside text-[11px] text-white/90 mt-0.5 space-y-0.5">
                          {d.keyEventTitles.slice(0, 3).map((t, i) => (
                            <li key={i} className="truncate">
                              {t}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {d.revisionCount > 0 && (
                      <div className="mt-1.5 pt-1 border-t border-steel/50 text-sky flex items-center gap-1">
                        <GitCommit className="w-3.5 h-3.5 text-passion" />
                        <span>{d.revisionCount} Retroactive Score Revision(s)</span>
                      </div>
                    )}
                  </div>
                );
              }}
            />

            {/* P10-P90 Shaded Forecast Uncertainty Band */}
            <Area
              type="monotone"
              dataKey="forecastBand"
              stroke="none"
              fill="#ea7722"
              fillOpacity={0.22}
              isAnimationActive={false}
            />

            {/* 4 Audience Historical Lines */}
            {visibleLines.executive && (
              <Line
                type="monotone"
                dataKey="executive"
                stroke={AUDIENCE_COLORS.executive}
                strokeWidth={1.8}
                dot={{ r: 2.5, fill: AUDIENCE_COLORS.executive }}
                isAnimationActive={false}
              />
            )}
            {visibleLines.congress && (
              <Line
                type="monotone"
                dataKey="congress"
                stroke={AUDIENCE_COLORS.congress}
                strokeWidth={1.8}
                dot={{ r: 2.5, fill: AUDIENCE_COLORS.congress }}
                isAnimationActive={false}
              />
            )}
            {visibleLines.navy && (
              <Line
                type="monotone"
                dataKey="navy"
                stroke={AUDIENCE_COLORS.navy}
                strokeWidth={1.8}
                dot={{ r: 2.5, fill: AUDIENCE_COLORS.navy }}
                isAnimationActive={false}
              />
            )}
            {visibleLines.public && (
              <Line
                type="monotone"
                dataKey="public"
                stroke={AUDIENCE_COLORS.public}
                strokeWidth={1.8}
                dot={{ r: 2.5, fill: AUDIENCE_COLORS.public }}
                isAnimationActive={false}
              />
            )}

            {/* Audience Forecast Dashed Lines */}
            {visibleLines.executive && (
              <Line
                type="monotone"
                dataKey="forecastExecEv"
                stroke={AUDIENCE_COLORS.executive}
                strokeWidth={1.4}
                strokeDasharray="4 4"
                dot={false}
                isAnimationActive={false}
              />
            )}
            {visibleLines.congress && (
              <Line
                type="monotone"
                dataKey="forecastCongEv"
                stroke={AUDIENCE_COLORS.congress}
                strokeWidth={1.4}
                strokeDasharray="4 4"
                dot={false}
                isAnimationActive={false}
              />
            )}
            {visibleLines.navy && (
              <Line
                type="monotone"
                dataKey="forecastNavyEv"
                stroke={AUDIENCE_COLORS.navy}
                strokeWidth={1.4}
                strokeDasharray="4 4"
                dot={false}
                isAnimationActive={false}
              />
            )}
            {visibleLines.public && (
              <Line
                type="monotone"
                dataKey="forecastPublicEv"
                stroke={AUDIENCE_COLORS.public}
                strokeWidth={1.4}
                strokeDasharray="4 4"
                dot={false}
                isAnimationActive={false}
              />
            )}

            {/* Bold Composite Historical Line */}
            {visibleLines.composite && (
              <Line
                type="monotone"
                dataKey="composite"
                stroke="#ffffff"
                strokeWidth={3.2}
                dot={(props) => {
                  const { cx, cy, payload } = props as {
                    cx?: number;
                    cy?: number;
                    payload?: ChartDatum;
                  };
                  if (cx === undefined || cy === undefined || !payload) return <g />;
                  if (payload.keyEventCount > 0) {
                    return (
                      <circle
                        key={payload.id}
                        cx={cx}
                        cy={cy}
                        r={5.5}
                        fill="#ea7722"
                        stroke="#ffffff"
                        strokeWidth={1.8}
                      />
                    );
                  }
                  return (
                    <circle
                      key={payload.id}
                      cx={cx}
                      cy={cy}
                      r={3.5}
                      fill="#ffffff"
                      stroke="#003b4d"
                      strokeWidth={1.5}
                    />
                  );
                }}
                isAnimationActive={false}
              />
            )}

            {/* Composite 6-Month Forecast Expected Value Dashed Line */}
            {visibleLines.composite && (
              <Line
                type="monotone"
                dataKey="forecastEv"
                stroke="#ea7722"
                strokeWidth={3}
                strokeDasharray="6 4"
                dot={{ r: 4, fill: '#ea7722', stroke: '#ffffff', strokeWidth: 1.5 }}
                isAnimationActive={false}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Period Quick-Selector Strip */}
      <div className="mt-3 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-3 text-xs text-sky">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-passion border border-white inline-block" />
            <span>Starred Key Event</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-4 h-2 bg-passion/30 border border-passion inline-block rounded-sm" />
            <span>6-Mo Analytic Forecast Band</span>
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-xs">
          <Eye className="w-3.5 h-3.5 text-passion" />
          <span className="text-sky">Inspect Period:</span>
          <select
            value={selectedPeriodId}
            onChange={(e) => setSelectedPeriodId(e.target.value)}
            className="bg-charcoal border border-steel rounded px-2 py-1 text-white font-mono text-xs focus:outline-none focus:border-passion"
          >
            {result.timeline.map((r) => (
              <option key={r.period.id} value={r.period.id}>
                {r.period.label} ({r.period.id}) — Composite {(r.compositeCenti / 100).toFixed(2)}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
};
