import React from 'react';
import { GitCommit } from 'lucide-react';
import { useDashboard } from '../context/DashboardContext';
import { AUDIENCE_LABELS, centiToDisplay, signedCenti } from '../engine';

export const RevisionsPanel: React.FC = () => {
  const { state, setSelectedPeriodId, setActiveTab } = useDashboard();

  return (
    <div className="bg-[#1e2227] border border-[#363c44] rounded-xl p-5 shadow-xl space-y-4">
      <div className="border-b border-steel/50 pb-3">
        <h2 className="text-base font-bold text-white flex items-center gap-2">
          <GitCommit className="w-5 h-5 text-passion" />
          <span>RETROACTIVE SCORE REVISIONS & EXPLAINABILITY AUDIT LOG ({state.revisions.length})</span>
        </h2>
        <p className="text-xs text-sky/85 mt-0.5">
          Whenever newly discovered evidence (e.g., a GAO report or congressional hearing transcript) has an `eventDate` in a prior month, quarter, or year, the engine deterministically recomputes affected periods and logs the exact delta and causal event below.
        </p>
      </div>

      {state.revisions.length === 0 ? (
        <div className="p-6 text-center text-xs text-sky bg-charcoal/50 rounded-lg border border-steel/40">
          No retroactive score revisions recorded yet.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="border-b border-steel/60 text-sky font-mono uppercase bg-charcoal/60">
                <th className="py-2.5 px-3">Period</th>
                <th className="py-2.5 px-3">Audience</th>
                <th className="py-2.5 px-3">Old → New Score</th>
                <th className="py-2.5 px-3">Signed Delta</th>
                <th className="py-2.5 px-3">Reason Code</th>
                <th className="py-2.5 px-3">Why the Score Changed (Causal Attribution)</th>
                <th className="py-2.5 px-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-steel/30">
              {[...state.revisions].reverse().map((r) => {
                const audLabel =
                  r.audience === 'composite' ? 'Composite Index' : AUDIENCE_LABELS[r.audience];
                return (
                  <tr key={r.id} className="hover:bg-charcoal/40">
                    <td className="py-2.5 px-3 font-mono font-bold text-white">
                      {r.periodLabel} ({r.periodId})
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-sky">{audLabel}</td>
                    <td className="py-2.5 px-3 font-mono text-white">
                      {centiToDisplay(r.oldScoreCenti)} →{' '}
                      <strong>{centiToDisplay(r.newScoreCenti)}</strong>
                    </td>
                    <td className="py-2.5 px-3 font-mono font-bold">
                      <span
                        className={
                          r.deltaCenti >= 0 ? 'text-changingsea' : 'text-passion'
                        }
                      >
                        {signedCenti(r.deltaCenti)} pts
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[11px] text-sky">
                      {r.revisionReason}
                    </td>
                    <td className="py-2.5 px-3 text-white/95 max-w-md">{r.explanation}</td>
                    <td className="py-2.5 px-3">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedPeriodId(r.periodId);
                          setActiveTab('dashboard');
                        }}
                        className="px-2.5 py-1 rounded bg-charcoal border border-steel hover:border-passion text-[11px] font-mono text-sky hover:text-white transition"
                      >
                        Inspect on Chart
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
