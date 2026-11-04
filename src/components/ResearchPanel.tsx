import React, { useState } from 'react';
import { Check, Loader2, Play, Radar, ShieldCheck, X } from 'lucide-react';
import { useDashboard } from '../context/DashboardContext';
import {
  ALL_AUDIENCES,
  AUDIENCE_LABELS,
  baseBps,
  bpsToDisplay,
  type AudienceId,
} from '../engine';

const QUERY_PACK_DESCRIPTIONS: Record<AudienceId, string> = {
  executive:
    'White House Executive Orders, Maritime Directorate directives, OMB President’s Budget Requests, and SecDef/OSD briefings.',
  congress:
    'HASC/SASC Seapower hearings, NDAA legislative text, Defense Appropriations markups, and GAO/CRS naval shipbuilding reports.',
  navy:
    'SECNAV & CNO 30-Year Shipbuilding Plan, NAVSEA contract definitizations, INSURV sea trials, and Submarine Industrial Base awards.',
  public:
    'HII 10-Q/10-K earnings releases, Free Cash Flow & margin guidance, NYSE:HII alpha vs. GD/LMT/NOC/ITA peers, and media/labor coverage.',
};

export const ResearchPanel: React.FC = () => {
  const {
    state,
    budget,
    isResearchRunning,
    triggerResearchRun,
    approvePending,
    rejectPending,
  } = useDashboard();

  const [selectedAudiences, setSelectedAudiences] = useState<Record<AudienceId, boolean>>({
    executive: true,
    congress: true,
    navy: true,
    public: true,
  });

  const handleLaunch = async () => {
    const auds = ALL_AUDIENCES.filter((a) => selectedAudiences[a]);
    if (auds.length === 0) return;
    await triggerResearchRun(auds, 'auto');
  };

  return (
    <div className="space-y-6">
      {/* Top Control Card: Trigger Vertex AI / Gemini Deep Research */}
      <div className="bg-deepsea border border-steel/60 rounded-xl p-5 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-steel/50 pb-3 mb-4">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Radar className="w-5 h-5 text-passion" />
              <span>VERTEX AI & GEMINI DEEP RESEARCH DISCOVERY ORCHESTRATOR</span>
            </h2>
            <p className="text-xs text-sky/85 mt-0.5">
              Dispatches audience-specific deep research & Google Search grounded agents in GCP (`gen-lang-client-0353543048`), extracts discrete rubric codes at `temperature=0.0`, deduplicates by SHA-256 content ID, and stages candidates in quarantine below.
            </p>
          </div>

          <div className="flex items-center gap-2 font-mono text-xs bg-charcoal px-3 py-1.5 rounded border border-changingsea">
            <ShieldCheck className="w-4 h-4 text-sky" />
            <span>
              Monthly Cap: ${budget.totalSpendUsd.toFixed(2)} / ${budget.monthlyCapUsd.toFixed(2)} (
              {budget.circuitBreaker})
            </span>
          </div>
        </div>

        {/* Audience Query Pack Selector */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
          {ALL_AUDIENCES.map((aud) => (
            <label
              key={aud}
              className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition ${
                selectedAudiences[aud]
                  ? 'bg-charcoal border-sky/70'
                  : 'bg-charcoal/40 border-steel/40 opacity-60'
              }`}
            >
              <input
                type="checkbox"
                checked={selectedAudiences[aud]}
                onChange={(e) =>
                  setSelectedAudiences((prev) => ({ ...prev, [aud]: e.target.checked }))
                }
                className="mt-1 accent-passion w-4 h-4"
              />
              <div>
                <div className="text-xs font-bold text-white uppercase">
                  {AUDIENCE_LABELS[aud]} Query Pack
                </div>
                <p className="text-[11px] text-sky/80 mt-0.5">{QUERY_PACK_DESCRIPTIONS[aud]}</p>
              </div>
            </label>
          ))}
        </div>

        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="text-xs text-sky font-mono">
            Primary Agent: <span className="text-white">deep-research-preview-04-2026</span> ·
            Extractor: <span className="text-white">gemini-3.8-flash (temp=0.0)</span>
          </div>

          <button
            type="button"
            disabled={isResearchRunning}
            onClick={() => void handleLaunch()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded bg-passion hover:bg-passion/90 disabled:opacity-50 text-xs font-bold text-white shadow-lg transition"
          >
            {isResearchRunning ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Running Deep Research & Rubric Extraction…</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-white" />
                <span>Launch Vertex AI Deep Research Run</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Pending Evidence Quarantine Queue */}
      <div className="bg-deepsea border-2 border-passion/70 rounded-xl p-5 shadow-xl">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              PENDING EVIDENCE QUARANTINE QUEUE ({state.pending.length} CANDIDATES AWAITING APPROVAL)
            </h3>
            <p className="text-xs text-sky/85 mt-0.5">
              Approving a candidate commits it to the immutable Evidence Ledger. If its `eventDate` falls in a closed historical period, the engine automatically records and highlights the retroactive `ScoreRevision`.
            </p>
          </div>
        </div>

        {state.pending.length === 0 ? (
          <div className="p-6 text-center bg-charcoal/60 rounded-lg border border-steel/40 text-xs text-sky">
            All discovered evidence has been reviewed. Click <strong>Launch Vertex AI Deep Research Run</strong> above to discover new items.
          </div>
        ) : (
          <div className="space-y-3">
            {state.pending.map((item) => {
              const isRetro = item.eventDate < '2026-11-01';
              return (
                <div
                  key={item.id}
                  className="bg-charcoal border border-sky/50 rounded-lg p-4 flex flex-col gap-2.5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-bold text-passion">
                          {item.eventDate}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-deepsea text-sky border border-steel/50">
                          {item.sourceType.replace('_', ' ')}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-deepsea text-steel">
                          {item.id}
                        </span>
                        {isRetro && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-passion text-white">
                            RETROACTIVE IMPACT (CLOSED PERIOD)
                          </span>
                        )}
                      </div>
                      <h4 className="text-sm font-bold text-white mt-1">{item.title}</h4>
                      <p className="text-xs text-sky/90 mt-1">{item.summary}</p>
                      {item.pendingReason && (
                        <p className="text-[11px] font-mono text-changingsea mt-1">
                          Provenance: {item.pendingReason}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => void approvePending(item.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-changingsea hover:bg-changingsea/90 text-xs font-bold text-white shadow transition"
                      >
                        <Check className="w-4 h-4" />
                        <span>Approve & Commit</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => void rejectPending(item.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-charcoal border border-steel hover:border-passion text-xs text-sky hover:text-passion transition"
                      >
                        <X className="w-4 h-4" />
                        <span>Reject</span>
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 pt-1">
                    {item.impacts.map((imp) => (
                      <span
                        key={imp.audience}
                        className="px-2 py-0.5 rounded text-[11px] font-mono bg-deepsea border border-steel/50 text-white"
                      >
                        {AUDIENCE_LABELS[imp.audience]}: {bpsToDisplay(baseBps(imp))} raw pts (M
                        {imp.magnitude}·C{imp.credibility}·{imp.scope}·{imp.persistence})
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Research Run History Log */}
      <div className="bg-deepsea border border-steel/60 rounded-xl p-5 shadow-xl">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-3">
          RESEARCH RUN EXECUTION HISTORY ({state.runs.length})
        </h3>
        <div className="space-y-2.5">
          {state.runs.map((run) => (
            <div
              key={run.runId}
              className="bg-charcoal/80 border border-steel/50 rounded-lg p-3 text-xs font-mono"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 text-white font-bold">
                <span>
                  {run.runId} · Mode: <span className="text-sky">{run.mode}</span> · Audiences:{' '}
                  {run.audiences.join(', ')}
                </span>
                <span className="text-changingsea">
                  +{run.discoveredCount} candidate(s) · Cost ${run.costUsd.toFixed(4)}
                </span>
              </div>
              <ul className="mt-1.5 space-y-0.5 text-[11px] text-sky/85 list-disc list-inside">
                {run.log.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
