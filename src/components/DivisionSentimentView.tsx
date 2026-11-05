import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  Flame,
  Layers,
  MapPin,
  Ship,
  Sparkles,
  TrendingDown,
  TrendingUp,
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
import { centiToDisplay } from '../engine';

export const DivisionSentimentView: React.FC = () => {
  const { state } = useDashboard();
  const [selectedDivision, setSelectedDivision] = useState<DivisionId>('nns');
  const [selectedProgramFilter, setSelectedProgramFilter] = useState<ProgramId | 'all'>('all');

  const divisionResult = useMemo(
    () => computeDivisionScores(state.events, selectedDivision, state.settings),
    [state.events, selectedDivision, state.settings],
  );

  const meta = DIVISION_META[selectedDivision];

  // Prepare division timeline chart data
  const chartData = useMemo(() => {
    return divisionResult.timeline.map((r) => ({
      periodId: r.period.id,
      label: r.period.label,
      granularity: r.period.granularity,
      composite: centiToDisplay(r.compositeCenti),
      executive: centiToDisplay(r.audiences.executive.scoreCenti),
      congress: centiToDisplay(r.audiences.congress.scoreCenti),
      navy: centiToDisplay(r.audiences.navy.scoreCenti),
      public: centiToDisplay(r.audiences.public.scoreCenti),
    }));
  }, [divisionResult.timeline]);

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

      {/* Active Division Executive Banner */}
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

          <div className="flex flex-wrap items-center gap-3 bg-charcoal/90 border border-steel/70 rounded-xl p-3 shrink-0">
            <div>
              <span className="text-[10px] font-mono uppercase text-steel block">Division Composite</span>
              <div className="text-2xl font-bold font-mono text-white">
                {divisionResult.latest.compositeScore.toFixed(2)}
              </div>
            </div>
            <div className="h-8 w-px bg-steel/40 mx-1 hidden sm:block" />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
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
          </div>
        </div>

        {/* Program Impact Waterfall Section */}
        <div className="mt-5 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
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
              <span className="text-steel font-mono text-[11px]">Filter Program:</span>
              <select
                value={selectedProgramFilter}
                onChange={(e) => setSelectedProgramFilter(e.target.value as ProgramId | 'all')}
                className="bg-charcoal border border-steel rounded px-2.5 py-1 text-white text-xs focus:outline-none focus:border-passion font-mono"
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
      </div>

      {/* Division Sentiment Timeline Graph */}
      <div className="bg-[#1e2227] border border-steel/60 rounded-xl p-5 shadow-lg space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-sky" />
              <span>{meta.name.toUpperCase()} HISTORICAL SENTIMENT TRAJECTORY</span>
            </h3>
            <p className="text-xs text-sky/80">
              Deterministic timeline across Annual (2011–2025), Quarterly (2026), and Monthly periods showing how program execution impacts {meta.name}.
            </p>
          </div>
          <span className="px-2.5 py-1 text-xs font-mono font-semibold rounded bg-charcoal border border-steel text-sky">
            {divisionResult.eventCount} Attached Events
          </span>
        </div>

        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#363c44" />
              <XAxis dataKey="label" stroke="#8b98a5" tick={{ fill: '#8b98a5', fontSize: 11 }} />
              <YAxis domain={[0, 100]} stroke="#8b98a5" tick={{ fill: '#8b98a5', fontSize: 11 }} />
              <ReferenceLine y={50} stroke="#5b6670" strokeDasharray="3 3" label={{ value: '50 Neutral', fill: '#5b6670', fontSize: 10 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#24272a',
                  borderColor: '#5b6670',
                  borderRadius: '0.5rem',
                  fontSize: '12px',
                  color: '#ffffff',
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
  );
};
