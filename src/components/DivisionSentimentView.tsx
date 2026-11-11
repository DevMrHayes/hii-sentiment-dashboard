import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  Building2,
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  Flame,
  HelpCircle,
  Info,
  Layers,
  MapPin,
  Newspaper,
  PieChart,
  Radio,
  Scale,
  Ship,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Users,
  Zap,
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
import { ALL_AUDIENCES, centiToDisplay, type ImpactEvent } from '../engine';
import {
  SentimentHoverTooltip,
  PeriodBreakdownModal,
  buildSourceMixFromEvents,
  type HoverChartMode,
  type PeriodBreakdownEvent,
  type SourceSlice,
} from './SentimentHoverTooltip';

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

  // Compute all 3 division latest scores for rollup comparison
  const allDivisionScores = useMemo(() => {
    return ALL_DIVISIONS.map((divId) => {
      const res = computeDivisionScores(state.events, divId, state.settings);
      return {
        id: divId,
        meta: DIVISION_META[divId],
        score: res.latest.compositeScore,
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
    <div className="space-y-6">
      {/* Division Selector Tabs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {ALL_DIVISIONS.map((divId) => {
          const dMeta = DIVISION_META[divId];
          const isSelected = selectedDivision === divId;
          const divScores = computeDivisionScores(state.events, divId, state.settings);
          const score = divScores.latest.compositeScore;
          const delta = divScores.latest.deltaCenti / 100;

          return (
            <button
              key={divId}
              type="button"
              onClick={() => {
                setSelectedDivision(divId);
                setSelectedProgramFilter('all');
              }}
              className={`p-4 rounded-xl border text-left transition relative overflow-hidden shadow-md ${
                isSelected
                  ? 'bg-charcoal border-passion ring-1 ring-passion'
                  : 'bg-[#1e2227] border-steel/50 hover:border-sky/70 hover:bg-[#252a30]'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-1.5 text-xs text-sky font-mono font-medium">
                    <Building2 className="w-3.5 h-3.5" />
                    <span>{dMeta.name}</span>
                    <span className="text-[10px] text-steel">({DIVISION_OPERATING_WEIGHTS[divId].pctLabel} footprint)</span>
                  </div>
                  <h3 className="text-sm font-bold text-white mt-1">{dMeta.fullName}</h3>
                </div>
                <div className="text-right">
                  <div className="text-xl font-bold font-mono text-white">{score.toFixed(1)}</div>
                  <div
                    className={`text-xs font-mono font-semibold flex items-center justify-end gap-0.5 ${
                      delta > 0 ? 'text-green-400' : delta < 0 ? 'text-passion' : 'text-steel'
                    }`}
                  >
                    {delta > 0 ? (
                      <TrendingUp className="w-3 h-3" />
                    ) : delta < 0 ? (
                      <TrendingDown className="w-3 h-3" />
                    ) : null}
                    <span>{delta >= 0 ? `+${delta.toFixed(2)}` : delta.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-1 text-[11px] font-mono text-steel">
                {dMeta.corePrograms.slice(0, 3).map((prog) => (
                  <span key={prog} className="px-2 py-0.5 rounded bg-charcoal/80 border border-steel/40 text-sky/90">
                    {prog}
                  </span>
                ))}
              </div>
            </button>
          );
        })}
      </div>

      {/* Active Division Executive Banner with Filter Dropdown at Top */}
      <div className="bg-[#1e2227] border border-steel/60 rounded-xl p-5 shadow-lg">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-steel/40 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 text-xs font-mono font-bold rounded bg-passion text-white">
                {meta.name.toUpperCase()} INTELLIGENCE
              </span>
              <div className="flex items-center gap-1 text-xs text-sky font-mono">
                <MapPin className="w-3.5 h-3.5" />
                <span>{meta.location}</span>
              </div>
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight mt-1">{meta.fullName}</h2>
            <p className="text-xs text-sky/90 mt-1 max-w-3xl leading-relaxed">{meta.description}</p>
          </div>

          {/* Right Top KPI Rail: Division Composite + Program Filter Dropdown */}
          <div className="flex flex-wrap items-center gap-3 bg-charcoal/90 border border-steel/70 rounded-xl p-3 shrink-0">
            <div>
              <span className="text-[10px] font-mono uppercase text-steel block">{meta.name} Composite</span>
              <div className="text-2xl font-bold font-mono text-white">
                {divisionResult.latest.compositeScore.toFixed(2)}
              </div>
            </div>

            <div className="h-8 w-px bg-steel/40 mx-1 hidden sm:block" />

            {/* Audience 4-way breakdown pills */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-xs font-mono">
              <div className="p-1.5 rounded bg-[#1e2227] border border-steel/40 text-center">
                <span className="text-[10px] text-steel block">EXEC</span>
                <span className="text-white font-bold">{divisionResult.latest.audiences.executive.score.toFixed(1)}</span>
              </div>
              <div className="p-1.5 rounded bg-[#1e2227] border border-steel/40 text-center">
                <span className="text-[10px] text-steel block">CONG</span>
                <span className="text-white font-bold">{divisionResult.latest.audiences.congress.score.toFixed(1)}</span>
              </div>
              <div className="p-1.5 rounded bg-[#1e2227] border border-steel/40 text-center">
                <span className="text-[10px] text-steel block">NAVY</span>
                <span className="text-white font-bold">{divisionResult.latest.audiences.navy.score.toFixed(1)}</span>
              </div>
              <div className="p-1.5 rounded bg-[#1e2227] border border-steel/40 text-center">
                <span className="text-[10px] text-steel block">PUBLIC</span>
                <span className="text-white font-bold">{divisionResult.latest.audiences.public.score.toFixed(1)}</span>
              </div>
            </div>

            <div className="h-8 w-px bg-steel/40 mx-1 hidden sm:block" />

            {/* Top Program Filter Dropdown directly beside composite score */}
            <div className="flex flex-col">
              <span className="text-[10px] font-mono text-steel uppercase">Filter Program</span>
              <select
                value={selectedProgramFilter}
                onChange={(e) => setSelectedProgramFilter(e.target.value as ProgramId | 'all')}
                className="bg-[#1e2227] border border-passion/70 rounded px-2.5 py-1 text-white text-xs focus:outline-none focus:ring-1 focus:ring-passion font-mono mt-0.5"
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

        {/* Quick Action Badges: Math Explainer & Source Type Methodology */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowMathExplainer(!showMathExplainer)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded font-mono text-xs border transition ${
                showMathExplainer
                  ? 'bg-passion/20 border-passion text-white font-bold'
                  : 'bg-charcoal border-steel/60 text-sky hover:text-white hover:border-steel'
              }`}
            >
              <Scale className="w-3.5 h-3.5 text-passion" />
              <span>Division vs HII Composite Relationship</span>
              <ChevronDown className={`w-3 h-3 transition-transform ${showMathExplainer ? 'rotate-180' : ''}`} />
            </button>

            <button
              type="button"
              onClick={() => setShowSourceGuide(!showSourceGuide)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded font-mono text-xs border transition ${
                showSourceGuide
                  ? 'bg-sky/20 border-sky text-white font-bold'
                  : 'bg-charcoal border-steel/60 text-sky hover:text-white hover:border-steel'
              }`}
            >
              <Newspaper className="w-3.5 h-3.5 text-sky" />
              <span>News Releases, Media & Labor Relations Guide</span>
              <ChevronDown className={`w-3 h-3 transition-transform ${showSourceGuide ? 'rotate-180' : ''}`} />
            </button>
          </div>

          <div className="flex items-center gap-2 text-[11px] font-mono text-steel">
            <span>Operating Footprint Rollup: <strong className="text-white">{operatingRollupScore.toFixed(2)}</strong></span>
            <span>·</span>
            <span>HII Enterprise Composite: <strong className="text-passion">{hiiCorporateScore.toFixed(2)}</strong></span>
            <span>·</span>
            <span className="text-emerald-400">+{diversificationDelta.toFixed(2)} Corporate Premium</span>
          </div>
        </div>

        {/* Expandable Relationship Explainer */}
        {showMathExplainer && (
          <div className="mt-4 p-4 rounded-lg bg-[#14171a] border border-passion/50 space-y-3 text-xs leading-relaxed text-sky/90">
            <div className="flex items-center gap-2 text-sm font-bold text-white border-b border-steel/40 pb-2">
              <Sparkles className="w-4 h-4 text-passion" />
              <span>MATHEMATICAL RELATIONSHIP: DIVISION SENTIMENT VS. HII CONGLOMERATE COMPOSITE</span>
            </div>

            <p>
              Why is <strong>HII Enterprise Composite ({hiiCorporateScore.toFixed(2)})</strong> currently higher than Newport News ({divisionResult.latest.compositeScore.toFixed(2)}), Ingalls ({allDivisionScores[1]?.score.toFixed(2)}), or Mission Technologies ({allDivisionScores[2]?.score.toFixed(2)})?
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
              <div className="p-3 rounded bg-charcoal/80 border border-steel/40">
                <h4 className="font-bold text-white mb-1 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-sky" />
                  <span>1. Conglomerate Backlog Stacking</span>
                </h4>
                <p className="text-[11px] text-sky/80">
                  HII corporate captures contract wins from <strong>all three divisions simultaneously</strong> ($15.2B two-carrier contract at NNS + $5.1B DDG multi-year at Ingalls + $1.2B UUV contracts at Mission Tech = $49B+ backlog). In the enterprise ledger, these positive impulses accumulate together.
                </p>
              </div>

              <div className="p-3 rounded bg-charcoal/80 border border-steel/40">
                <h4 className="font-bold text-white mb-1 flex items-center gap-1.5">
                  <Flame className="w-3.5 h-3.5 text-passion" />
                  <span>2. Isolated Program Drags at Shipyards</span>
                </h4>
                <p className="text-[11px] text-sky/80">
                  When viewing <strong>Newport News in isolation</strong>, it absorbs the full concentrated friction of CVN-78 elevator certifications, CVN-80 schedule slips, and Virginia submarine welding audits <em>without</em> the dilutive benefit of Ingalls destroyers or Mission Tech software margins.
                </p>
              </div>

              <div className="p-3 rounded bg-charcoal/80 border border-steel/40">
                <h4 className="font-bold text-white mb-1 flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-green-400" />
                  <span>3. Corporate Macro & Public Equity</span>
                </h4>
                <p className="text-[11px] text-sky/80">
                  The American Public & Investor score (<strong>{(result.latest.public.scoreCenti / 100).toFixed(2)}</strong>) is heavily lifted by NYSE:HII equity performance (+85.5% surge to $460 ATH), corporate share buybacks, and Trump Golden Fleet executive mandates, which reside at the corporate ticker level.
                </p>
              </div>
            </div>

            <div className="mt-2 pt-2 border-t border-steel/30 flex flex-wrap items-center justify-between text-[11px] font-mono">
              <span className="text-white">
                Division Operating Footprint Rollup (55% NNS + 35% Ingalls + 10% MT): <strong>{operatingRollupScore.toFixed(2)}</strong>
              </span>
              <span className="text-sky">
                Conglomerate Diversification & Corporate Equity Lift: <strong className="text-emerald-400">+{diversificationDelta.toFixed(2)} pts</strong>
              </span>
            </div>
          </div>
        )}

        {/* Expandable News Releases, Media & Labor Relations Guide */}
        {showSourceGuide && (
          <div className="mt-4 p-4 rounded-lg bg-[#14171a] border border-sky/50 space-y-3 text-xs leading-relaxed text-sky/90">
            <div className="flex items-center gap-2 text-sm font-bold text-white border-b border-steel/40 pb-2">
              <Radio className="w-4 h-4 text-sky" />
              <span>SOURCE TYPE INGESTION & AUDIENCE MAPPING GUIDE</span>
            </div>

            <p>
              How HII news releases, press releases, defense journalism, and shipyard labor relations feed into the 4 audience rubrics:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-1">
              <div className="p-3 rounded bg-charcoal/80 border border-steel/40">
                <span className="text-xs font-bold text-white block mb-1">Corporate Press Releases</span>
                <span className="text-[10px] font-mono text-passion block mb-1">corporate_action · Tier 4</span>
                <p className="text-[11px] text-sky/80">
                  Official HII announcements: quarterly earnings releases, share repurchases, executive appointments, M&A (Alion acquisition), and yard capex investments. Feeds directly to <strong>Executive</strong> and <strong>Public/Investor</strong> audiences.
                </p>
              </div>

              <div className="p-3 rounded bg-charcoal/80 border border-steel/40">
                <span className="text-xs font-bold text-white block mb-1">Contract Awards & Navy Releases</span>
                <span className="text-[10px] font-mono text-sky block mb-1">contract_award · Tier 4</span>
                <p className="text-[11px] text-sky/80">
                  Definitive DoD / NAVSEA procurement releases ($15.2B CVN 80/81, $5.1B DDG multi-year, REMUS UUV contracts). Primary driver of <strong>Navy Customer</strong> and <strong>Congress</strong> sentiment.
                </p>
              </div>

              <div className="p-3 rounded bg-charcoal/80 border border-steel/40">
                <span className="text-xs font-bold text-white block mb-1">Defense & Business Journalism</span>
                <span className="text-[10px] font-mono text-changingsea block mb-1">news_media · Tier 2/3</span>
                <p className="text-[11px] text-sky/80">
                  Articles from USNI News, Defense News, Bloomberg, Wall Street Journal, Reuters, and Breaking Defense. Evaluates carrier elevator progress, delivery milestones, and supply chain health. Feeds <strong>American Public</strong> and <strong>Executive</strong>.
                </p>
              </div>

              <div className="p-3 rounded bg-charcoal/80 border border-steel/40">
                <span className="text-xs font-bold text-white block mb-1">Shipyard Labor Relations</span>
                <span className="text-[10px] font-mono text-passion block mb-1">corporate_action / news_media</span>
                <p className="text-[11px] text-sky/80">
                  USW Local 8888 (Newport News) & Pascagoula Metal Trades Council (Ingalls) collective bargaining agreements, wage ratifications, strikes, and apprentice school graduations. Affects <strong>Public</strong> (labor relations) and <strong>Navy</strong> (throughput).
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* BUMPED UP: Historical Line Chart directly beneath top executive banner */}
      <div className="bg-[#1e2227] border border-steel/60 rounded-xl p-5 shadow-lg space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-sky" />
              <span>{meta.name.toUpperCase()} HISTORICAL SENTIMENT TRAJECTORY</span>
            </h3>
            <p className="text-xs text-sky/80">
              Deterministic timeline across Annual (2011–2025), Quarterly (2026), and Monthly periods showing how program execution impacts {meta.name}.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
            <div
              className="inline-flex items-center rounded-lg bg-[#16191d] border border-steel/60 p-0.5 text-[11px] font-mono"
              title="Toggle hover tooltip view between Scores and Sources (Double-click any point for full pane)"
            >
              <button
                type="button"
                onClick={() => setHoverMode('scores')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition ${
                  hoverMode === 'scores'
                    ? 'bg-passion text-white font-bold shadow-sm'
                    : 'text-sky/80 hover:text-white'
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5" />
                <span>Scores</span>
              </button>
              <button
                type="button"
                onClick={() => setHoverMode('sources')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition ${
                  hoverMode === 'sources'
                    ? 'bg-passion text-white font-bold shadow-sm'
                    : 'text-sky/80 hover:text-white'
                }`}
              >
                <PieChart className="w-3.5 h-3.5" />
                <span>Sources</span>
              </button>
            </div>

            <span className="px-2.5 py-1 text-xs font-mono font-semibold rounded bg-charcoal border border-steel text-sky">
              {divisionResult.eventCount} Attached Events
            </span>
          </div>
        </div>

        {/* Mobile swipe strip */}
        <div className="sm:hidden flex items-center justify-between text-[11px] font-mono text-sky/90 bg-[#14171a] border border-[#2d333b] rounded px-2.5 py-1.5">
          <span>← Swipe for 2011–2025 history</span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => divChartScrollRef.current?.scrollTo({ left: 0, behavior: 'smooth' })}
              className="px-1.5 py-0.5 rounded bg-charcoal border border-steel/60 text-[10px] text-steel hover:text-white"
            >
              2011
            </button>
            <button
              type="button"
              onClick={() => {
                const el = divChartScrollRef.current;
                if (el) el.scrollTo({ left: el.scrollWidth - el.clientWidth, behavior: 'smooth' });
              }}
              className="px-1.5 py-0.5 rounded bg-passion/20 border border-passion/60 text-[10px] text-passion font-bold"
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
                <CartesianGrid strokeDasharray="3 3" stroke="#363c44" />
                <XAxis dataKey="label" stroke="#8b98a5" tick={{ fill: '#8b98a5', fontSize: 11 }} interval={0} angle={-25} textAnchor="end" height={46} />
                <YAxis domain={[0, 100]} stroke="#8b98a5" tick={{ fill: '#8b98a5', fontSize: 11 }} />
                <ReferenceLine y={50} stroke="#5b6670" strokeDasharray="3 3" label={{ value: '50 Neutral', fill: '#5b6670', fontSize: 10 }} />
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
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                <Line type="monotone" dataKey="composite" name={`${meta.name} Composite`} stroke="#ffffff" strokeWidth={3} dot={{ r: 3, fill: '#ffffff' }} />
                <Line type="monotone" dataKey="navy" name="Navy Customer" stroke="#75abd1" strokeWidth={2} dot={false} strokeDasharray="5 5" />
                <Line type="monotone" dataKey="congress" name="Congress" stroke="#509ca2" strokeWidth={1.5} dot={false} />
                <Line type="monotone" dataKey="executive" name="Executive" stroke="#ea7722" strokeWidth={1.5} dot={false} />
                <Line type="monotone" dataKey="public" name="Public Markets" stroke="#5b6670" strokeWidth={1.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Program Impact Waterfall Section: Positioned below the line chart */}
      <div className="bg-[#1e2227] border border-steel/60 rounded-xl p-5 shadow-lg space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-steel/40 pb-3">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-passion" />
              <span>PROGRAM IMPACT WATERFALL & ATTRIBUTION</span>
            </h3>
            <p className="text-xs text-sky/80">
              Quantifies each defense program's net lift or drag on {meta.name}'s sentiment score based on primary contract awards, GAO audits, and operational milestones.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-steel font-mono text-[11px]">Filtered:</span>
            <span className="px-2 py-0.5 rounded bg-charcoal border border-steel font-mono text-white text-xs">
              {selectedProgramFilter === 'all'
                ? `All Programs (${divisionResult.programWaterfall.length})`
                : PROGRAM_META[selectedProgramFilter]?.name}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
          {filteredWaterfall.map((prog) => {
            const isDrag = prog.direction === -1;
            const isLift = prog.direction === 1;

            return (
              <div
                key={prog.programId}
                className={`p-3.5 rounded-lg border transition ${
                  isDrag
                    ? 'bg-charcoal border-passion/60 hover:border-passion'
                    : isLift
                    ? 'bg-charcoal border-sky/60 hover:border-sky'
                    : 'bg-charcoal/70 border-steel/40'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-7 h-7 rounded flex items-center justify-center shrink-0 ${
                        isDrag
                          ? 'bg-passion/20 text-passion'
                          : isLift
                          ? 'bg-sky/20 text-sky'
                          : 'bg-steel/20 text-steel'
                      }`}
                    >
                      {isDrag ? (
                        <TrendingDown className="w-4 h-4" />
                      ) : isLift ? (
                        <TrendingUp className="w-4 h-4" />
                      ) : (
                        <Ship className="w-4 h-4" />
                      )}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white">{prog.name}</h4>
                      <span className="text-[11px] font-mono text-sky/80">{prog.shipClass}</span>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span
                      className={`text-sm font-bold font-mono px-2 py-0.5 rounded ${
                        isDrag
                          ? 'bg-passion/25 text-passion border border-passion/40'
                          : isLift
                          ? 'bg-sky/25 text-sky border border-sky/40'
                          : 'bg-steel/20 text-steel'
                      }`}
                    >
                      {prog.netImpactPoints > 0
                        ? `+${prog.netImpactPoints.toFixed(2)} pts`
                        : prog.netImpactPoints < 0
                        ? `${prog.netImpactPoints.toFixed(2)} pts`
                        : 'Neutral'}
                    </span>
                    <span className="block text-[10px] text-steel font-mono mt-0.5">
                      {prog.eventCount} attached events
                    </span>
                  </div>
                </div>

                <p className="text-[11px] text-sky/70 mt-2 line-clamp-2">{prog.summary}</p>

                {prog.topEventTitle && (
                  <div className="mt-2.5 pt-2 border-t border-steel/30 flex items-center gap-1.5 text-[11px]">
                    <span className="text-steel font-mono shrink-0">Primary Driver:</span>
                    <span className="text-white truncate font-medium" title={prog.topEventTitle}>
                      {prog.topEventTitle}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

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
