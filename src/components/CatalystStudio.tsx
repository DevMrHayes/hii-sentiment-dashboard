import React, { useMemo } from 'react';
import { TrendingUp } from 'lucide-react';
import { useDashboard } from '../context/DashboardContext';
import {
  AUDIENCE_LABELS,
  baseBps,
  bpsToDisplay,
  catalystSensitivity,
  centiToDisplay,
  PROBABILITY_STEPS,
  signedCenti,
  type ProbabilityStep,
} from '../engine';

export const CatalystStudio: React.FC = () => {
  const { state, result, saveCatalysts } = useDashboard();

  const sensitivities = useMemo(
    () => catalystSensitivity(state.events, state.catalysts, state.settings),
    [state.events, state.catalysts, state.settings],
  );

  const handleToggle = (id: string, enabled: boolean) => {
    const next = state.catalysts.map((c) => (c.id === id ? { ...c, enabled } : c));
    void saveCatalysts(next);
  };

  const handleProbability = (id: string, probability: ProbabilityStep) => {
    const next = state.catalysts.map((c) => (c.id === id ? { ...c, probability } : c));
    void saveCatalysts(next);
  };

  return (
    <div className="space-y-6">
      {/* 6-Month Forecast Table */}
      <div className="bg-[#1e2227] border border-[#363c44] rounded-xl p-5 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-passion" />
              <span>6-MONTH DETERMINISTIC SCENARIO FORECAST (DEC 2026 – MAY 2027)</span>
            </h2>
            <p className="text-xs text-sky/80 mt-0.5">
              Computed analytically from historical decay plus independent Bernoulli catalyst probabilities ($z_{'{0.90}'} = 1.2816$). Zero Monte Carlo randomness.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono text-left border-collapse">
            <thead>
              <tr className="border-b border-steel/60 text-sky uppercase bg-charcoal/60">
                <th className="py-2.5 px-3">Forecast Month</th>
                <th className="py-2.5 px-3">Executive EV [P10–P90]</th>
                <th className="py-2.5 px-3">Congress EV [P10–P90]</th>
                <th className="py-2.5 px-3">Navy EV [P10–P90]</th>
                <th className="py-2.5 px-3">Public EV [P10–P90]</th>
                <th className="py-2.5 px-3 text-passion">Composite EV [P10–P90]</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-steel/30">
              {result.forecast.map((fp) => {
                const fmt = (b: { evCenti: number; p10Centi: number; p90Centi: number }) => (
                  <span>
                    <strong className="text-white">{centiToDisplay(b.evCenti)}</strong>{' '}
                    <span className="text-sky/80">
                      [{centiToDisplay(b.p10Centi)}–{centiToDisplay(b.p90Centi)}]
                    </span>
                  </span>
                );
                return (
                  <tr key={fp.period.id} className="hover:bg-charcoal/40">
                    <td className="py-2.5 px-3 font-bold text-white">
                      {fp.period.label} ({fp.period.id})
                    </td>
                    <td className="py-2.5 px-3">{fmt(fp.audiences.executive)}</td>
                    <td className="py-2.5 px-3">{fmt(fp.audiences.congress)}</td>
                    <td className="py-2.5 px-3">{fmt(fp.audiences.navy)}</td>
                    <td className="py-2.5 px-3">{fmt(fp.audiences.public)}</td>
                    <td className="py-2.5 px-3 bg-charcoal/50 font-bold">
                      <span className="text-passion">
                        {centiToDisplay(fp.composite.evCenti)}
                      </span>{' '}
                      <span className="text-white font-normal">
                        [{centiToDisplay(fp.composite.p10Centi)}–
                        {centiToDisplay(fp.composite.p90Centi)}]
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Interactive Catalyst Probability & Scenario Cards */}
      <div className="bg-[#1e2227] border border-[#363c44] rounded-xl p-5 shadow-xl">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-1">
          PENDING LEGISLATION, CONTRACT AWARDS & PROGRAM CATALYSTS ({state.catalysts.length})
        </h3>
        <p className="text-xs text-sky/80 mb-4">
          Toggle catalysts or adjust their discrete realization probability (`5%` to `95%`) to immediately observe the expected-value and P10–P90 band shift.
        </p>

        <div className="space-y-3">
          {state.catalysts.map((cat) => {
            const netMayEffect = sensitivities[cat.id] ?? 0;
            return (
              <div
                key={cat.id}
                className={`p-4 rounded-lg border transition ${
                  cat.enabled
                    ? 'bg-charcoal/90 border-sky/50'
                    : 'bg-charcoal/40 border-steel/30 opacity-60'
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <input
                      type="checkbox"
                      checked={cat.enabled}
                      onChange={(e) => handleToggle(cat.id, e.target.checked)}
                      className="mt-1 accent-passion w-4 h-4 cursor-pointer"
                    />
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-deepsea text-passion border border-passion/50">
                          {cat.expectedMonth}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-deepsea text-sky border border-steel/50">
                          {cat.category.replace('_', ' ')}
                        </span>
                        <span className="font-mono text-xs text-sky">
                          May 2027 Composite EV Sensitivity:{' '}
                          <strong
                            className={
                              netMayEffect >= 0 ? 'text-changingsea' : 'text-passion'
                            }
                          >
                            {signedCenti(netMayEffect)} pts
                          </strong>
                        </span>
                      </div>
                      <h4 className="text-sm font-semibold text-white mt-1">{cat.title}</h4>
                      <p className="text-xs text-sky/85 mt-1">{cat.summary}</p>
                    </div>
                  </div>

                  {/* Discrete Probability Selector */}
                  <div className="flex flex-col items-end">
                    <span className="text-[11px] font-mono text-sky mb-1">
                      Realization Probability:
                    </span>
                    <div className="flex items-center gap-1">
                      {PROBABILITY_STEPS.map((step) => (
                        <button
                          key={step}
                          type="button"
                          onClick={() => handleProbability(cat.id, step)}
                          className={`px-2 py-1 rounded text-xs font-mono font-semibold border transition ${
                            cat.probability === step
                              ? 'bg-passion text-white border-passion'
                              : 'bg-deepsea text-sky border-steel/50 hover:border-sky'
                          }`}
                        >
                          {step}%
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-3 pl-6 flex flex-wrap gap-2">
                  {cat.impacts.map((imp) => {
                    const raw = baseBps(imp);
                    return (
                      <span
                        key={imp.audience}
                        className="px-2 py-0.5 rounded text-[11px] font-mono bg-deepsea border border-steel/50 text-white"
                      >
                        {AUDIENCE_LABELS[imp.audience]}: {bpsToDisplay(raw)} raw pts
                      </span>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
