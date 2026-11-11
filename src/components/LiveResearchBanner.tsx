import React from 'react';
import { ArrowRight, CheckCircle2, Cog, Loader2, Sparkles, X } from 'lucide-react';
import { useDashboard } from '../context/DashboardContext';

export const LiveResearchBanner: React.FC = () => {
  const {
    isResearchRunning,
    agentStages,
    researchProgressPct,
    researchLiveLog,
    researchResultSummary,
    dismissResearchBanner,
    setActiveTab,
  } = useDashboard();

  if (!isResearchRunning && !researchResultSummary) {
    return null;
  }

  return (
    <div className="max-w-[1600px] w-full mx-auto px-3 sm:px-4 mt-3">
      <div
        className={`rounded-xl border-2 p-3.5 sm:p-4 shadow-2xl transition-all ${
          isResearchRunning
            ? 'bg-[#171c22] border-passion'
            : 'bg-[#162024] border-changingsea'
        }`}
      >
        {/* Header Row: Spinning Gear / Completion + Progress % + Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            {isResearchRunning ? (
              <div className="w-8 h-8 rounded-lg bg-passion/20 border border-passion/60 flex items-center justify-center shrink-0">
                <Cog className="w-5 h-5 text-passion animate-spin" />
              </div>
            ) : (
              <div className="w-8 h-8 rounded-lg bg-changingsea/20 border border-changingsea flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-5 h-5 text-changingsea" />
              </div>
            )}

            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xs sm:text-sm font-bold text-white tracking-wide">
                  {isResearchRunning
                    ? 'VERTEX AI MULTI-AGENT SWARM RUNNING…'
                    : `SWEEP COMPLETE — ${researchResultSummary?.stagedCount ?? 0} NEW EVENT(S) DISCOVERED`}
                </h3>
                <span
                  className={`px-2 py-0.5 rounded font-mono text-[11px] font-bold ${
                    isResearchRunning
                      ? 'bg-passion text-white animate-pulse'
                      : 'bg-changingsea text-charcoal'
                  }`}
                >
                  {researchProgressPct}%
                </span>
              </div>
              <p className="text-[11px] font-mono text-sky/85 mt-0.5">
                {isResearchRunning
                  ? 'Executing parallel 4-audience Flash collectors & Gemini 4 Argon verifier…'
                  : `Run ${researchResultSummary?.runId} · Mode: ${researchResultSummary?.mode} · Spend: $${researchResultSummary?.costUsd.toFixed(2)} · Skipped ${researchResultSummary?.skippedDups ?? 0} existing duplicate(s)`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isResearchRunning && researchResultSummary && (
              <button
                type="button"
                onClick={() => setActiveTab('research')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-passion hover:bg-passion/90 text-white text-xs font-bold shadow transition"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Review & Promote ({researchResultSummary.stagedCount})</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}

            {!isResearchRunning && (
              <button
                type="button"
                onClick={dismissResearchBanner}
                className="p-1.5 rounded-lg text-steel hover:text-white hover:bg-charcoal transition"
                title="Dismiss live run summary"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Animated Progress Bar */}
        <div className="w-full h-2 bg-charcoal rounded-full overflow-hidden mt-3 border border-steel/40">
          <div
            className={`h-full transition-all duration-500 ease-out ${
              isResearchRunning ? 'bg-passion' : 'bg-changingsea'
            }`}
            style={{ width: `${Math.max(5, researchProgressPct)}%` }}
          />
        </div>

        {/* 4-Stage Pipeline Pills */}
        {agentStages.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 mt-3">
            {agentStages.map((stage) => (
              <div
                key={stage.agentId}
                className={`p-2 rounded-lg border text-[11px] flex items-start gap-2 transition ${
                  stage.status === 'running'
                    ? 'bg-passion/15 border-passion text-white'
                    : stage.status === 'completed'
                    ? 'bg-changingsea/15 border-changingsea/70 text-white'
                    : 'bg-charcoal/60 border-steel/40 text-steel'
                }`}
              >
                {stage.status === 'running' ? (
                  <Loader2 className="w-3.5 h-3.5 text-passion animate-spin shrink-0 mt-0.5" />
                ) : stage.status === 'completed' ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-changingsea shrink-0 mt-0.5" />
                ) : (
                  <span className="w-3.5 h-3.5 rounded-full border border-steel/60 inline-block shrink-0 mt-0.5" />
                )}
                <div className="min-w-0">
                  <span className="font-semibold block truncate">{stage.label}</span>
                  <span className="text-[10px] font-mono text-sky/80 line-clamp-1">{stage.detail}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Rolling Activity Stream */}
        {researchLiveLog.length > 0 && (
          <div className="mt-2.5 bg-[#0f1317] border border-steel/40 rounded-lg p-2.5 max-h-28 overflow-y-auto font-mono text-[11px] space-y-1">
            {researchLiveLog.map((line, i) => (
              <div
                key={i}
                className={`${
                  i === researchLiveLog.length - 1 ? 'text-white font-semibold' : 'text-sky/80'
                }`}
              >
                {line}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
