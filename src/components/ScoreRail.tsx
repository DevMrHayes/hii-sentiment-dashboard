import React from 'react';
import { ArrowDownRight, ArrowUpRight, Minus, Star, TrendingUp } from 'lucide-react';
import { useDashboard } from '../context/DashboardContext';
import {
  ALL_AUDIENCES,
  AUDIENCE_LABELS,
  bpsToDisplay,
  centiToDisplay,
  signedCenti,
  type AudienceId,
} from '../engine';

const AUDIENCE_BORDER: Record<AudienceId, string> = {
  executive: 'border-sky/60',
  congress: 'border-changingsea/60',
  navy: 'border-[#38bdf8]/60',
  public: 'border-steel',
};

export const ScoreRail: React.FC = () => {
  const { result, selectedPeriodId, setSelectedPeriodId, setActiveTab } = useDashboard();

  const latestPeriod = result.timeline[result.timeline.length - 1]!;
  const priorPeriod = result.timeline[result.timeline.length - 2];
  const selectedRecord =
    result.timeline.find((r) => r.period.id === selectedPeriodId) ?? latestPeriod;
  const lastForecast = result.forecast[result.forecast.length - 1];

  const renderDeltaBadge = (deltaCenti: number) => {
    if (deltaCenti > 0) {
      return (
        <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-xs font-mono font-semibold bg-changingsea/30 text-sky border border-changingsea">
          <ArrowUpRight className="w-3.5 h-3.5" />
          {signedCenti(deltaCenti)}
        </span>
      );
    }
    if (deltaCenti < 0) {
      return (
        <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-xs font-mono font-semibold bg-passion/25 text-passion border border-passion">
          <ArrowDownRight className="w-3.5 h-3.5" />
          {signedCenti(deltaCenti)}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-xs font-mono text-steel bg-charcoal border border-steel/50">
        <Minus className="w-3.5 h-3.5" />
        0.00
      </span>
    );
  };

  return (
    <aside className="space-y-4">
      {/* Hero Current Composite Score Card */}
      <div className="bg-[#1e2227] border-2 border-passion/80 rounded-xl p-4 shadow-xl">
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono uppercase tracking-wider text-sky">
            CURRENT COMPOSITE SCORE ({latestPeriod.period.label})
          </span>
          <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-charcoal text-passion border border-passion/50">
            VS {priorPeriod?.period.label ?? 'PRIOR'}
          </span>
        </div>

        <div className="mt-2 flex items-baseline justify-between">
          <div className="text-4xl font-extrabold font-mono text-white tracking-tight">
            {centiToDisplay(result.latest.composite.scoreCenti)}
            <span className="text-sm font-normal text-sky ml-1">/ 100</span>
          </div>
          {renderDeltaBadge(result.latest.composite.deltaCenti)}
        </div>

        {/* Weight Distribution Bar */}
        <div className="mt-3">
          <div className="flex justify-between text-[11px] font-mono text-sky mb-1">
            <span>Exec {result.weights.executive}%</span>
            <span>Cong {result.weights.congress}%</span>
            <span>Navy {result.weights.navy}%</span>
            <span>Public {result.weights.public}%</span>
          </div>
          <div className="w-full h-2 rounded-full overflow-hidden flex bg-charcoal border border-steel/50">
            <div style={{ width: `${result.weights.executive}%`, backgroundColor: '#75abd1' }} />
            <div style={{ width: `${result.weights.congress}%`, backgroundColor: '#509ca2' }} />
            <div style={{ width: `${result.weights.navy}%`, backgroundColor: '#38bdf8' }} />
            <div style={{ width: `${result.weights.public}%`, backgroundColor: '#9ca3af' }} />
          </div>
        </div>

        {/* 6-Month Forecast Summary */}
        {lastForecast && (
          <div className="mt-3 pt-3 border-t border-steel/50 flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 text-sky">
              <TrendingUp className="w-4 h-4 text-passion" />
              <span>6-Mo Forecast ({lastForecast.period.label}):</span>
            </div>
            <div className="font-mono text-white font-semibold">
              EV {centiToDisplay(lastForecast.composite.evCenti)}{' '}
              <span className="text-sky font-normal">
                [{centiToDisplay(lastForecast.composite.p10Centi)}–
                {centiToDisplay(lastForecast.composite.p90Centi)}]
              </span>
            </div>
          </div>
        )}
      </div>

      {/* 4 Audience Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2.5">
        {ALL_AUDIENCES.map((aud) => {
          const cur = result.latest[aud];
          const topContrib = latestPeriod.audiences[aud].contributions[0];
          return (
            <div
              key={aud}
              className={`bg-[#1e2227] border ${AUDIENCE_BORDER[aud]} rounded-xl p-3.5 shadow-md`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                    {AUDIENCE_LABELS[aud]}
                  </h3>
                  <span className="text-[11px] font-mono text-sky">
                    Composite Weight: {result.weights[aud]}% · Raw{' '}
                    {bpsToDisplay(latestPeriod.audiences[aud].rawBps)} pts
                  </span>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold font-mono text-white">
                    {centiToDisplay(cur.scoreCenti)}
                  </div>
                  <div className="mt-0.5">{renderDeltaBadge(cur.deltaCenti)}</div>
                </div>
              </div>
              {topContrib && (
                <div className="mt-2 pt-2 border-t border-steel/40 text-[11px] text-sky/90 truncate">
                  <span className="font-mono text-white">
                    {bpsToDisplay(topContrib.effectiveBps)} pts:
                  </span>{' '}
                  {topContrib.title}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Selected Period Deterministic Math Inspector */}
      <div className="bg-[#1e2227] border border-[#363c44] rounded-xl p-4 shadow-xl">
        <div className="flex items-center justify-between border-b border-steel/50 pb-2 mb-2.5">
          <div>
            <span className="text-[11px] font-mono uppercase text-passion block">
              DETERMINISTIC PERIOD INSPECTOR
            </span>
            <h3 className="text-sm font-bold text-white font-mono">
              {selectedRecord.period.label} ({selectedRecord.period.id}) · Composite{' '}
              {centiToDisplay(selectedRecord.compositeCenti)}
            </h3>
          </div>
          {selectedRecord.period.id !== latestPeriod.period.id && (
            <button
              onClick={() => setSelectedPeriodId(latestPeriod.period.id)}
              className="px-2 py-1 text-[11px] font-mono rounded bg-charcoal border border-steel text-sky hover:text-white"
            >
              Jump to Latest
            </button>
          )}
        </div>

        <p className="text-[11px] text-sky mb-2">
          Window <span className="font-mono text-white">{selectedRecord.period.startDate}</span> →{' '}
          <span className="font-mono text-white">{selectedRecord.period.endDate}</span> (
          {selectedRecord.period.sampleDates.length} month-end sample
          {selectedRecord.period.sampleDates.length > 1 ? 's' : ''})
        </p>

        <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
          {ALL_AUDIENCES.map((aud) => {
            const aScore = selectedRecord.audiences[aud];
            return (
              <div
                key={aud}
                className="bg-charcoal/80 border border-steel/40 rounded-lg p-2 text-xs"
              >
                <div className="flex items-center justify-between font-mono font-semibold text-white mb-1">
                  <span>{AUDIENCE_LABELS[aud]}</span>
                  <span>
                    {centiToDisplay(aScore.scoreCenti)} (Raw {bpsToDisplay(aScore.rawBps)})
                  </span>
                </div>
                {aScore.contributions.slice(0, 3).map((c) => (
                  <div
                    key={c.eventId}
                    className="flex items-center justify-between gap-2 text-[11px] text-sky/90 py-0.5 border-t border-steel/25"
                  >
                    <span className="truncate flex items-center gap-1">
                      {c.starred && <Star className="w-3 h-3 text-passion fill-passion shrink-0" />}
                      <span className="truncate">{c.title}</span>
                    </span>
                    <span
                      className={`font-mono shrink-0 ${
                        c.effectiveBps >= 0 ? 'text-changingsea' : 'text-passion'
                      }`}
                    >
                      {bpsToDisplay(c.effectiveBps)}
                    </span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>

        <button
          onClick={() => setActiveTab('control')}
          className="mt-3 w-full py-1.5 rounded bg-charcoal border border-sky/50 hover:border-passion text-xs font-medium text-sky hover:text-white transition"
        >
          Adjust Audience Weights or Add Event →
        </button>
      </div>
    </aside>
  );
};
