import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  BarChart3,
  Building2,
  ChevronDown,
  Eye,
  Flame,
  Layers,
  MapPin,
  Newspaper,
  PieChart,
  Radio,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useDashboard } from '../context/DashboardContext';
import {
  ALL_DIVISIONS,
  computeDivisionScores,
  DIVISION_META,
  PROGRAM_META,
  type DivisionId,
  type ProgramId,
} from '../engine/division';
import { ALL_AUDIENCES, type AudienceId, type ImpactEvent } from '../engine';
import {
  SentimentHoverTooltip,
  PeriodBreakdownModal,
  buildSourceMixFromEvents,
  type HoverChartMode,
  type PeriodBreakdownEvent,
  type SourceSlice,
} from './SentimentHoverTooltip';

// Unified across TrendChart, ScoreRail, SentimentHoverTooltip & DivisionSentimentView
const AUDIENCE_COLORS: Record<AudienceId, string> = {
  navy: '#38bdf8',
  executive: '#75abd1',
  congress: '#509ca2',
  public: '#9ca3af',
};

// Division operating weights by approximate shipyard revenue & headcount footprint
// Newport News (~55%), Ingalls (~35%), Mission Technologies (~10%)
const DIVISION_OPERATING_WEIGHTS: Record<DivisionId, { weight: number; pctLabel: string }> = {
  nns: { weight: 0.55, pctLabel: '55%' },
  ingalls: { weight: 0.35, pctLabel: '35%' },
  mission_tech: { weight: 0.10, pctLabel: '10%' },
};

export const DivisionSentimentView: React.FC = () => {
  const { state, result } = useDashboard();
  const [selectedDivision, setSelectedDivision] = useState<DivisionId>('nns');
  const [selectedProgramFilter, setSelectedProgramFilter] = useState<ProgramId | 'all'>('all');
  const [showMathExplainer, setShowMathExplainer] = useState(false);
  const [showSourceGuide, setShowSourceGuide] = useState(false);
  const [hoverMode, setHoverMode] = useState<HoverChartMode>('scores');
  const [inspectedPeriodId, setInspectedPeriodId] = useState<string | null>(null);
  const divChartScrollRef = useRef<HTMLDivElement>(null);
  const hoveredDivIdRef = useRef<string | null>(null);
  const lastDivClickRef = useRef<{ id: string; time: number } | null>(null);

  useEffect(() => {
    const el = divChartScrollRef.current;
    if (el && el.scrollWidth > el.clientWidth) {
      el.scrollLeft = el.scrollWidth - el.clientWidth;
    }
  }, [selectedDivision, selectedProgramFilter]);

  const divisionResult = useMemo(
    () => computeDivisionScores(state.events, selectedDivision, state.settings),
    [state.events, selectedDivision, state.settings],
  );

  const meta = DIVISION_META[selectedDivision];

  // Compute all 3 division latest scores + deltas for segmented switcher bar
  const allDivisionScores = useMemo(() => {
    return ALL_DIVISIONS.map((divId) => {
      const res = computeDivisionScores(state.events, divId, state.settings);
      return {
        id: divId,
        meta: DIVISION_META[divId],
        score: res.latest.compositeScore,
        delta: res.latest.deltaCenti / 100,
        weight: DIVISION_OPERATING_WEIGHTS[divId].weight,
        pctLabel: DIVISION_OPERATING_WEIGHTS[divId].pctLabel,
      };
    });
  }, [state.events, state.settings]);

  // Division-weighted operating rollup score
  const operatingRollupScore = useMemo(() => {
    const rawSum = allDivisionScores.reduce((acc, d) => acc + d.score * d.weight, 0);
    return Number(rawSum.toFixed(2));
  }, [allDivisionScores]);

  const hiiCorporateScore = Number((result.latest.composite.scoreCenti / 100).toFixed(2));
  const diversificationDelta = Number((hiiCorporateScore - operatingRollupScore).toFixed(2));

  const eventMap = useMemo(() => new Map(state.events.map((e) => [e.id, e])), [state.events]);

  // Prepare division timeline chart data with active event source mix per period
  const chartData = useMemo(() => {
    return divisionResult.timeline.map((r) => {
      const contributingIds = new Set<string>();
      for (const a of ALL_AUDIENCES) {
        for (const c of r.audiences[a].contributions) {
          contributingIds.add(c.eventId);
        }
      }
      const contributingEvents = Array.from(contributingIds)
        .map((id) => eventMap.get(id))
        .filter((ev): ev is ImpactEvent => ev !== undefined)
        .sort((a, b) => (b.eventDate > a.eventDate ? 1 : -1));
      const sourceMix: SourceSlice[] = buildSourceMixFromEvents(contributingEvents);

      return {
        periodId: r.period.id,
        label: r.period.label,
        granularity: r.period.granularity,
        composite: Number((r.compositeCenti / 100).toFixed(2)),
        executive: Number((r.audiences.executive.scoreCenti / 100).toFixed(2)),
        congress: Number((r.audiences.congress.scoreCenti / 100).toFixed(2)),
        navy: Number((r.audiences.navy.scoreCenti / 100).toFixed(2)),
        public: Number((r.audiences.public.scoreCenti / 100).toFixed(2)),
        sourceMix,
        totalImpactingEvents: contributingEvents.length,
        periodEvents: contributingEvents.map((e): PeriodBreakdownEvent => ({
          id: e.id,
          title: e.title,
          eventDate: e.eventDate,
          sourceType: e.sourceType,
          starred: e.starred,
        })),
        keyEventTitles: r.keyEventIds.map((id) => eventMap.get(id)?.title ?? id),
      };
    });
  }, [divisionResult.timeline, eventMap]);

  const filteredWaterfall = useMemo(() => {
    if (selectedProgramFilter === 'all') return divisionResult.programWaterfall;
    return divisionResult.programWaterfall.filter((p) => p.programId === selectedProgramFilter);
  }, [divisionResult.programWaterfall, selectedProgramFilter]);

  return (
    <div className="space-y-5">
      {/* Top 4-Column Segmented Yard Switcher Bar & Enterprise Rollup */}
      <div
        role="tablist"
        aria-label="HII Operating Divisions"
        className="bg-surface1 border border-hairline rounded-xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-hairline overflow-hidden shadow-lg"
      >
        {allDivisionScores.map((div) => {
          const isSelected = selectedDivision === div.id;
          return (
            <button
              key={div.id}
              type="button"
              role="tab"
              aria-selected={isSelected}
              onClick={() => {
                setSelectedDivision(div.id);
                setSelectedProgramFilter('all');
              }}
              className={`px-4 py-3.5 text-left transition relative flex flex-col justify-between gap-2 ${
                isSelected
                  ? 'bg-surface2 border-b-2 border-[#2dd4bf]'
                  : 'bg-surface1 hover:bg-surface2/60 border-b-2 border-transparent'
              }`}
            >
              <div className="flex items-center justify-between gap-2 text-xs text-muted">
                <span className="inline-flex items-center gap-1.5 font-medium text-gray-100 truncate">
                  <Building2 className="w-3.5 h-3.5 text-sky shrink-0" />
                  <span className="truncate">{div.meta.fullName}</span>
                </span>
                <span className="text-[11px] font-mono tabular-nums text-sky shrink-0">
                  {div.pctLabel}
                </span>
              </div>

              <div className="flex items-baseline gap-2.5">
                <span className="text-2xl font-bold font-mono tabular-nums text-white leading-none">
                  {div.score.toFixed(1)}
                </span>
                <span
                  className={`text-xs font-mono tabular-nums font-semibold inline-flex items-center gap-0.5 ${
                    div.delta > 0 ? 'text-lift' : div.delta < 0 ? 'text-drag' : 'text-muted'
                  }`}
                >
                  {div.delta > 0 ? (
                    <TrendingUp className="w-3 h-3" />
                  ) : div.delta < 0 ? (
                    <TrendingDown className="w-3 h-3" />
                  ) : null}
                  <span>{div.delta >= 0 ? `+${div.delta.toFixed(2)}` : div.delta.toFixed(2)}</span>
                </span>
              </div>
            </button>
          );
        })}

        {/* Cell 4: Enterprise Rollup Bridge */}
        <div className="px-4 py-3.5 bg-surface0/80 flex flex-col justify-between gap-2">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="text-muted">Operating Rollup</span>
            <span className="font-mono tabular-nums font-semibold text-white">
              {operatingRollupScore.toFixed(1)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="text-muted">Enterprise Composite</span>
            <span className="font-mono tabular-nums font-bold text-passion">
              {hiiCorporateScore.toFixed(1)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-hairline text-[11px]">
            <span
              className={`font-mono tabular-nums font-semibold ${
                diversificationDelta >= 0 ? 'text-lift' : 'text-drag'
              }`}
            >
              {diversificationDelta >= 0 ? `+${diversificationDelta.toFixed(2)}` : diversificationDelta.toFixed(2)} pts Corporate Lift
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowMathExplainer(!showMathExplainer)}
                className="text-sky hover:text-white underline underline-offset-2 transition"
              >
                Methodology
              </button>
              <button
                type="button"
                onClick={() => setShowSourceGuide(!showSourceGuide)}
                className="text-muted hover:text-white underline underline-offset-2 transition"
              >
                Sources
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Active Division Executive Summary & Stakeholder Strip */}
      <div className="bg-surface1 border border-hairline rounded-xl p-5 shadow-lg">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="text-xl font-bold text-white tracking-tight">{meta.fullName}</h2>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-surface0 border border-hairline text-xs font-mono text-sky">
                <MapPin className="w-3 h-3" />
                <span>{meta.location}</span>
              </span>
            </div>
            <p className="text-xs text-muted mt-1.5 max-w-3xl leading-relaxed">{meta.description}</p>
          </div>

          {/* Flat 4-Audience Hairline Strip + Program Filter */}
          <div className="flex flex-wrap items-center gap-3 bg-surface0 border border-hairline rounded-lg px-3.5 py-2.5 shrink-0">
            <div className="grid grid-cols-4 gap-3 text-xs font-mono tabular-nums">
              {([
                { key: 'navy', label: 'Navy', val: divisionResult.latest.audiences.navy.score },
                { key: 'executive', label: 'Exec', val: divisionResult.latest.audiences.executive.score },
                { key: 'congress', label: 'Cong', val: divisionResult.latest.audiences.congress.score },
                { key: 'public', label: 'Public', val: divisionResult.latest.audiences.public.score },
              ] as const).map((item) => (
                <div key={item.key} className="text-center">
                  <span className="inline-flex items-center gap-1 text-[11px] text-muted">
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: AUDIENCE_COLORS[item.key] }}
                    />
                    {item.label}
                  </span>
                  <span className="block text-white font-bold mt-0.5">{item.val.toFixed(1)}</span>
                </div>
              ))}
            </div>

            <div className="h-8 w-px bg-hairline hidden sm:block" />

            <div className="flex flex-col">
              <label htmlFor="div-program-filter" className="text-[11px] font-mono text-muted">
                Program Filter
              </label>
              <select
                id="div-program-filter"
                value={selectedProgramFilter}
                onChange={(e) => setSelectedProgramFilter(e.target.value as ProgramId | 'all')}
                className="bg-surface1 border border-hairline focus:border-sky rounded px-2.5 py-1 text-white text-xs font-mono mt-0.5"
              >
                <option value="all">All Programs ({divisionResult.programWaterfall.length})</option>
                {divisionResult.programWaterfall.map((p) => (
                  <option key={p.programId} value={p.programId}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Expandable Relationship Explainer */}
        {showMathExplainer && (
          <div className="mt-4 p-4 rounded-lg bg-surface0 border border-hairline space-y-3 text-xs leading-relaxed text-gray-200">
            <div className="flex items-center gap-2 text-sm font-bold text-white border-b border-hairline pb-2">
              <Sparkles className="w-4 h-4 text-passion" />
              <span>Division Sentiment vs. Enterprise Composite Methodology</span>
            </div>

            <p>
              Why is <strong>HII Enterprise Composite ({hiiCorporateScore.toFixed(2)})</strong> currently differing from Newport News ({allDivisionScores[0]?.score.toFixed(2)}), Ingalls ({allDivisionScores[1]?.score.toFixed(2)}), or Mission Technologies ({allDivisionScores[2]?.score.toFixed(2)})?
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
              <div className="p-3 rounded bg-surface1 border border-hairline">
                <h4 className="font-bold text-white mb-1 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-sky" />
                  <span>1. Conglomerate Backlog Stacking</span>
                </h4>
                <p className="text-xs text-muted">
                  HII corporate captures contract wins from <strong>all three divisions simultaneously</strong> ($15.2B two-carrier contract at NNS + $5.1B DDG multi-year at Ingalls + $1.2B UUV contracts at Mission Tech). Positive impulses accumulate across the enterprise ledger.
                </p>
              </div>

              <div className="p-3 rounded bg-surface1 border border-hairline">
                <h4 className="font-bold text-white mb-1 flex items-center gap-1.5">
                  <Flame className="w-3.5 h-3.5 text-drag" />
                  <span>2. Isolated Yard Execution Drags</span>
                </h4>
                <p className="text-xs text-muted">
                  Viewing <strong>Newport News in isolation</strong> concentrates carrier certification, schedule slips, and submarine welding audits <em>without</em> the balancing weight of Ingalls destroyers or Mission Tech autonomy margins.
                </p>
              </div>

              <div className="p-3 rounded bg-surface1 border border-hairline">
                <h4 className="font-bold text-white mb-1 flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-lift" />
                  <span>3. Corporate Macro &amp; Equity</span>
                </h4>
                <p className="text-xs text-muted">
                  Public &amp; Investor sentiment (<strong>{(result.latest.public.scoreCenti / 100).toFixed(2)}</strong>) reflects enterprise-level NYSE:HII market valuation, capital returns, and defense budget directives.
                </p>
              </div>
            </div>

            <div className="mt-2 pt-2 border-t border-hairline flex flex-wrap items-center justify-between text-xs font-mono tabular-nums">
              <span className="text-white">
                Operating Footprint Rollup (55% NNS + 35% Ingalls + 10% MT): <strong>{operatingRollupScore.toFixed(2)}</strong>
              </span>
              <span className={diversificationDelta >= 0 ? 'text-lift' : 'text-drag'}>
                Enterprise Variance: <strong>{diversificationDelta >= 0 ? `+${diversificationDelta.toFixed(2)}` : diversificationDelta.toFixed(2)} pts</strong>
              </span>
            </div>
          </div>
        )}

        {/* Expandable Source Mapping Guide */}
        {showSourceGuide && (
          <div className="mt-4 p-4 rounded-lg bg-surface0 border border-hairline space-y-3 text-xs leading-relaxed text-gray-200">
            <div className="flex items-center gap-2 text-sm font-bold text-white border-b border-hairline pb-2">
              <Radio className="w-4 h-4 text-sky" />
              <span>Source Type Ingestion &amp; Audience Mapping Guide</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-1">
              <div className="p-3 rounded bg-surface1 border border-hairline">
                <span className="text-xs font-bold text-white block mb-1">Corporate Press Releases</span>
                <span className="text-[11px] font-mono text-sky block mb-1">corporate_action · Tier 4</span>
                <p className="text-xs text-muted">
                  Earnings releases, capital allocation, M&amp;A, and yard capex feeding <strong>Executive</strong> and <strong>Public/Investor</strong> audiences.
                </p>
              </div>

              <div className="p-3 rounded bg-surface1 border border-hairline">
                <span className="text-xs font-bold text-white block mb-1">Contract Awards &amp; Navy</span>
                <span className="text-[11px] font-mono text-sky block mb-1">contract_award · Tier 4</span>
                <p className="text-xs text-muted">
                  DoD / NAVSEA procurement awards driving <strong>Navy Customer</strong> and <strong>Congress</strong> sentiment.
                </p>
              </div>

              <div className="p-3 rounded bg-surface1 border border-hairline">
                <span className="text-xs font-bold text-white block mb-1">Defense &amp; Business Press</span>
                <span className="text-[11px] font-mono text-lift block mb-1">news_media · Tier 2/3</span>
                <p className="text-xs text-muted">
                  USNI News, Defense News, Bloomberg, WSJ, and Reuters coverage of delivery milestones and supply-chain health.
                </p>
              </div>

              <div className="p-3 rounded bg-surface1 border border-hairline">
                <span className="text-xs font-bold text-white block mb-1">Shipyard Labor Relations</span>
                <span className="text-[11px] font-mono text-sky block mb-1">corporate_action / news_media</span>
                <p className="text-xs text-muted">
                  USW Local 8888 (Newport News) and Pascagoula Metal Trades Council (Ingalls) agreements impacting workforce &amp; throughput.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Historical Line Chart */}
      <div className="bg-surface1 border border-hairline rounded-xl p-5 shadow-lg space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-sky" />
              <span>{meta.name} Historical Sentiment Trajectory</span>
            </h3>
            <p className="text-xs text-muted">
              Unified stakeholder series across Annual (2011–2025), Quarterly (2026), and Monthly periods.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
            <div
              role="group"
              aria-label="Division tooltip display mode"
              className="inline-flex items-center rounded-lg bg-surface0 border border-hairline p-0.5 text-xs font-mono"
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
                const targetId = chartData[chartData.length - 1]?.periodId;
                if (targetId) setInspectedPeriodId(targetId);
              }}
              aria-label={`Inspect latest period breakdown for ${meta.name}`}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-surface0 border border-hairline hover:border-sky text-xs font-medium text-white transition"
            >
              <Eye className="w-3.5 h-3.5 text-sky" />
              <span>Inspect Latest</span>
            </button>

            <span className="px-2.5 py-1 text-xs font-mono tabular-nums font-semibold rounded bg-surface0 border border-hairline text-sky">
              {divisionResult.eventCount} Events
            </span>
          </div>
        </div>

        {/* Mobile swipe strip */}
        <div className="sm:hidden flex items-center justify-between text-xs font-mono text-sky bg-surface0 border border-hairline rounded px-2.5 py-1.5">
          <span>← Swipe for 2011–2025 history</span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => divChartScrollRef.current?.scrollTo({ left: 0, behavior: 'smooth' })}
              className="px-2 py-0.5 rounded bg-surface1 border border-hairline text-xs text-muted hover:text-white"
            >
              2011
            </button>
            <button
              type="button"
              onClick={() => {
                const el = divChartScrollRef.current;
                if (el) el.scrollTo({ left: el.scrollWidth - el.clientWidth, behavior: 'smooth' });
              }}
              className="px-2 py-0.5 rounded bg-passion-solid text-xs text-white font-bold"
            >
              Recent →
            </button>
          </div>
        </div>

        <div
          ref={divChartScrollRef}
          onDoubleClick={() => {
            if (hoveredDivIdRef.current) setInspectedPeriodId(hoveredDivIdRef.current);
          }}
          className="w-full overflow-x-auto sm:overflow-x-visible"
        >
          <div className="min-w-[820px] sm:min-w-0 w-full h-72 sm:h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={chartData}
                margin={{ top: 10, right: 20, left: -10, bottom: 0 }}
                onClick={(stateObj) => {
                  if (stateObj && stateObj.activeLabel) {
                    const match = chartData.find((d) => d.label === stateObj.activeLabel);
                    if (match) {
                      const now = Date.now();
                      if (lastDivClickRef.current && lastDivClickRef.current.id === match.periodId && now - lastDivClickRef.current.time < 400) {
                        setInspectedPeriodId(match.periodId);
                        lastDivClickRef.current = null;
                      } else {
                        lastDivClickRef.current = { id: match.periodId, time: now };
                      }
                    }
                  }
                }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#2e353d" vertical={false} />
                <XAxis dataKey="label" stroke="#98a6b3" tick={{ fill: '#98a6b3', fontSize: 11, fontFamily: 'IBM Plex Mono' }} interval={0} angle={-25} textAnchor="end" height={46} />
                <YAxis domain={[0, 100]} stroke="#98a6b3" tick={{ fill: '#98a6b3', fontSize: 11, fontFamily: 'IBM Plex Mono' }} />
                <ReferenceLine y={50} stroke="#5b6670" strokeDasharray="3 3" label={{ value: '50 Neutral', fill: '#98a6b3', fontSize: 11 }} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload || !payload.length) return null;
                    const d = payload[0]?.payload as (typeof chartData)[number];
                    hoveredDivIdRef.current = d.periodId;
                    return (
                      <SentimentHoverTooltip
                        mode={hoverMode}
                        label={`${meta.name} · ${d.label}`}
                        composite={d.composite}
                        scores={{
                          executive: d.executive,
                          congress: d.congress,
                          navy: d.navy,
                          public: d.public,
                        }}
                        sourceMix={d.sourceMix}
                        totalImpactingEvents={d.totalImpactingEvents}
                        subtitle={`${d.totalImpactingEvents} ${meta.name} drivers`}
                      />
                    );
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                <Line type="monotone" dataKey="composite" name={`${meta.name} Composite`} stroke="#ffffff" strokeWidth={3} dot={{ r: 3, fill: '#ffffff' }} />
                <Line type="monotone" dataKey="navy" name="Navy Customer" stroke={AUDIENCE_COLORS.navy} strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="executive" name="Executive" stroke={AUDIENCE_COLORS.executive} strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="congress" name="Congress" stroke={AUDIENCE_COLORS.congress} strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="public" name="Public Markets" stroke={AUDIENCE_COLORS.public} strokeWidth={1.75} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Program Impact Horizontal Diverging Waterfall Table */}
      {(() => {
        const maxAbsPts = Math.max(1, ...filteredWaterfall.map((p) => Math.abs(p.netImpactPoints)));
        const maxLabel = maxAbsPts.toFixed(1);

        return (
          <div className="bg-surface1 border border-hairline rounded-xl shadow-lg overflow-hidden">
            <div className="px-5 py-4 border-b border-hairline flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Layers className="w-4 h-4 text-sky" />
                  <span>{meta.name} Program Impact Diverging Waterfall</span>
                </h3>
                <p className="text-xs text-muted mt-0.5">
                  Quantifies net lift (<span className="text-lift font-medium">Sea-Teal</span>) vs. schedule or oversight drag (<span className="text-drag font-medium">Coral-Red</span>) centered on <span className="font-mono tabular-nums text-white">0.00</span>. Click any row to filter.
                </p>
              </div>

              <div className="flex items-center gap-2 text-xs">
                {selectedProgramFilter !== 'all' ? (
                  <button
                    type="button"
                    onClick={() => setSelectedProgramFilter('all')}
                    className="px-2.5 py-1 rounded bg-surface0 border border-hairline hover:border-sky font-mono text-sky hover:text-white transition"
                  >
                    Clear Filter ({PROGRAM_META[selectedProgramFilter]?.name})
                  </button>
                ) : (
                  <span className="px-2.5 py-1 rounded bg-surface0 border border-hairline font-mono tabular-nums text-muted">
                    {filteredWaterfall.length} Programs
                  </span>
                )}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[760px]">
                <thead>
                  <tr className="border-b border-hairline bg-surface0 text-[11px] font-mono uppercase tracking-wider text-muted">
                    <th scope="col" className="py-2.5 px-4 w-[24%]">Defense Program</th>
                    <th scope="col" className="py-2.5 px-3 w-[16%]">Ship Class</th>
                    <th scope="col" className="py-2.5 px-3 w-[24%]">Primary Attribution Driver</th>
                    <th scope="col" className="py-2.5 px-4 w-[28%]">
                      <div className="flex items-center justify-between tabular-nums">
                        <span className="text-drag">-{maxLabel}</span>
                        <span className="text-white">0.00</span>
                        <span className="text-lift">+{maxLabel}</span>
                      </div>
                    </th>
                    <th scope="col" className="py-2.5 px-4 text-right w-[8%]">Events</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline text-xs">
                  {filteredWaterfall.map((prog) => {
                    const isPos = prog.netImpactPoints > 0;
                    const isNeg = prog.netImpactPoints < 0;
                    const barPct = Math.min(100, (Math.abs(prog.netImpactPoints) / maxAbsPts) * 100);
                    const isRowSelected = selectedProgramFilter === prog.programId;

                    return (
                      <tr
                        key={prog.programId}
                        onClick={() =>
                          setSelectedProgramFilter(isRowSelected ? 'all' : prog.programId)
                        }
                        className={`cursor-pointer transition ${
                          isRowSelected ? 'bg-surface2' : 'hover:bg-surface2/50'
                        }`}
                      >
                        <td className="py-3 px-4 align-middle">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedProgramFilter(isRowSelected ? 'all' : prog.programId);
                            }}
                            className="text-left font-semibold text-white hover:text-sky transition block"
                          >
                            {prog.name}
                          </button>
                          <p className="text-[11px] text-muted line-clamp-1 mt-0.5">{prog.summary}</p>
                        </td>

                        <td className="py-3 px-3 align-middle font-mono text-[11px] text-sky">
                          {prog.shipClass}
                        </td>

                        <td className="py-3 px-3 align-middle text-gray-200">
                          <span className="line-clamp-2" title={prog.topEventTitle}>
                            {prog.topEventTitle || '—'}
                          </span>
                        </td>

                        <td className="py-3 px-4 align-middle">
                          <div className="flex items-center gap-3">
                            <div
                              className="relative flex-1 h-4 flex items-center bg-surface0 rounded border border-hairline overflow-hidden"
                              aria-label={`${prog.name} net sentiment impact ${prog.netImpactPoints.toFixed(2)} points`}
                            >
                              <div className="w-1/2 h-full flex justify-end items-center pr-px">
                                {isNeg && (
                                  <div
                                    className="h-2.5 rounded-l-sm"
                                    style={{ width: `${barPct}%`, backgroundColor: '#f43f5e' }}
                                  />
                                )}
                              </div>
                              <div className="w-px h-full bg-muted/60 shrink-0 z-10" />
                              <div className="w-1/2 h-full flex justify-start items-center pl-px">
                                {isPos && (
                                  <div
                                    className="h-2.5 rounded-r-sm"
                                    style={{ width: `${barPct}%`, backgroundColor: '#2dd4bf' }}
                                  />
                                )}
                              </div>
                            </div>
                            <span
                              className={`w-20 text-right font-mono tabular-nums font-bold shrink-0 ${
                                isPos ? 'text-lift' : isNeg ? 'text-drag' : 'text-muted'
                              }`}
                            >
                              {prog.netImpactPoints > 0
                                ? `+${prog.netImpactPoints.toFixed(2)}`
                                : prog.netImpactPoints.toFixed(2)}{' '}
                              pts
                            </span>
                          </div>
                        </td>

                        <td className="py-3 px-4 align-middle text-right font-mono tabular-nums text-white font-semibold">
                          {prog.eventCount}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {(() => {
        const inspected = inspectedPeriodId ? chartData.find((d) => d.periodId === inspectedPeriodId) : null;
        if (!inspected) return null;
        return (
          <PeriodBreakdownModal
            isOpen={true}
            onClose={() => setInspectedPeriodId(null)}
            label={`${meta.name} · ${inspected.label}`}
            composite={inspected.composite}
            scores={{
              executive: inspected.executive,
              congress: inspected.congress,
              navy: inspected.navy,
              public: inspected.public,
            }}
            sourceMix={inspected.sourceMix}
            totalImpactingEvents={inspected.totalImpactingEvents}
            keyEventTitles={inspected.keyEventTitles}
            periodEvents={inspected.periodEvents}
            subtitle={`${inspected.totalImpactingEvents} ${meta.name} active ledger driver(s)`}
          />
        );
      })()}
    </div>
  );
};
