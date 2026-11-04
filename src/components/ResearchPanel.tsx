import React, { useState } from 'react';
import {
  CalendarClock,
  Check,
  CheckCircle2,
  DollarSign,
  Loader2,
  Play,
  Radar,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import { useDashboard } from '../context/DashboardContext';
import {
  ALL_AUDIENCES,
  AUDIENCE_LABELS,
  baseBps,
  bpsToDisplay,
  type AudienceId,
  type BudgetConfig,
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

const BUDGET_TIERS: Array<{
  id: BudgetConfig['selectedTierId'];
  name: string;
  capUsd: number;
  mode: 'grounded_search' | 'deep_research';
  desc: string;
  estRuns: string;
}> = [
  {
    id: 'lean_2_50',
    name: 'Tier A: Lean Grounded Flash ($2.50/mo)',
    capUsd: 2.5,
    mode: 'grounded_search',
    desc: 'Gemini 3.8 Flash with Google Search grounding + Flash-Lite rubric extraction (~$0.05/sweep). Ideal for low-cost weekly polling.',
    estRuns: '~45–50 sweeps/mo',
  },
  {
    id: 'balanced_5_00',
    name: 'Tier B: Recommended Deep Research + Argon ($5.00/mo)',
    capUsd: 5.0,
    mode: 'deep_research',
    desc: 'Recommended sweet spot: 4.33 Monday morning Deep Research runs + Argon cross-audience verification + ~8 ad-hoc "Run Now" triggers (~$0.38/sweep).',
    estRuns: '~12–14 deep sweeps/mo',
  },
  {
    id: 'intensive_12_00',
    name: 'Tier C: Intensive Event-Driven Surge ($12.00/mo)',
    capUsd: 12.0,
    mode: 'deep_research',
    desc: 'High-frequency polling during NDAA markups, appropriations standoffs, or quarterly earnings weeks (within $15.00 workspace ceiling).',
    estRuns: '~30+ deep sweeps/mo',
  },
];

export const ResearchPanel: React.FC = () => {
  const {
    state,
    budget,
    scheduleConfig,
    budgetConfig,
    isResearchRunning,
    agentStages,
    updateSchedule,
    updateBudgetConfig,
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

  const handleLaunchNow = async (isMondaySim = false) => {
    const auds = ALL_AUDIENCES.filter((a) => selectedAudiences[a]);
    if (auds.length === 0) return;
    await triggerResearchRun(auds, scheduleConfig.mode, isMondaySim);
  };

  const pctUsed = Math.min(100, (budget.totalSpendUsd / budget.monthlyCapUsd) * 100);
  const costPerRun = scheduleConfig.mode === 'deep_research' ? 0.38 : 0.05;
  const estRemainingRuns = Math.max(0, Math.floor(budget.remainingUsd / costPerRun));

  return (
    <div className="space-y-6">
      {/* Top 2-Column Grid: Monday Scheduler + FinOps Monthly Budget Guard */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Column 1: Weekly Monday Morning Multi-Agent Schedule & Run Now */}
        <div className="bg-deepsea border border-steel/60 rounded-xl p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-steel/50 pb-3">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <CalendarClock className="w-5 h-5 text-passion" />
                <span>MONDAY MORNING MULTI-AGENT SCHEDULE</span>
              </h2>
              <p className="text-xs text-sky/85 mt-0.5">
                Automated weekly sentiment sweep every Monday morning via Cloud Scheduler (`0 7 * * 1` America/New_York) plus on-demand <strong>Run Now</strong> execution.
              </p>
            </div>
            <label className="inline-flex items-center gap-2 cursor-pointer px-3 py-1 rounded bg-charcoal border border-sky/50 text-xs font-mono">
              <input
                type="checkbox"
                checked={scheduleConfig.enabled}
                onChange={(e) =>
                  void updateSchedule({
                    ...scheduleConfig,
                    enabled: e.target.checked,
                  })
                }
                className="accent-passion w-4 h-4"
              />
              <span className={scheduleConfig.enabled ? 'text-changingsea font-bold' : 'text-steel'}>
                {scheduleConfig.enabled ? 'SCHEDULE ACTIVE' : 'PAUSED'}
              </span>
            </label>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs font-mono">
            <div className="bg-charcoal/80 border border-steel/50 rounded-lg p-2.5">
              <span className="text-sky block text-[10px] uppercase">Cadence & Cron</span>
              <span className="text-white font-bold mt-0.5 block">
                Every Monday · {scheduleConfig.hourEt} ET
              </span>
              <span className="text-[10px] text-steel">cron: {scheduleConfig.cronExpression}</span>
            </div>

            <div className="bg-charcoal/80 border border-steel/50 rounded-lg p-2.5">
              <span className="text-sky block text-[10px] uppercase">Next Scheduled Sweep</span>
              <span className="text-passion font-bold mt-0.5 block">Mon, Nov 9 · 07:00 ET</span>
              <span className="text-[10px] text-sky">4 Audience Agents + Extractor</span>
            </div>

            <div className="bg-charcoal/80 border border-steel/50 rounded-lg p-2.5 col-span-2 sm:col-span-1">
              <span className="text-sky block text-[10px] uppercase">Last Scheduled Sweep</span>
              <span className="text-white font-bold mt-0.5 block">
                {scheduleConfig.lastScheduledRunAt?.slice(0, 16).replace('T', ' ') ?? '2026-11-02'}
              </span>
              <span className="text-[10px] text-changingsea">Status: COMPLETED</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="text-sky block mb-1">Monday Execution Time (ET)</label>
              <select
                value={scheduleConfig.hourEt}
                onChange={(e) => {
                  const hourEt = e.target.value;
                  const hr = Number(hourEt.split(':')[0] || 7);
                  void updateSchedule({
                    ...scheduleConfig,
                    hourEt,
                    cronExpression: `0 ${hr} * * 1`,
                  });
                }}
                className="w-full bg-charcoal border border-steel rounded px-2.5 py-1.5 text-white font-mono"
              >
                <option value="06:00">06:00 AM ET (cron: 0 6 * * 1)</option>
                <option value="07:00">07:00 AM ET (cron: 0 7 * * 1)</option>
                <option value="08:00">08:00 AM ET (cron: 0 8 * * 1)</option>
                <option value="09:00">09:00 AM ET (cron: 0 9 * * 1)</option>
              </select>
            </div>

            <div>
              <label className="text-sky block mb-1">Research Agent Depth Mode</label>
              <select
                value={scheduleConfig.mode}
                onChange={(e) =>
                  void updateSchedule({
                    ...scheduleConfig,
                    mode: e.target.value as 'deep_research' | 'grounded_search',
                  })
                }
                className="w-full bg-charcoal border border-steel rounded px-2.5 py-1.5 text-white font-mono"
              >
                <option value="deep_research">
                  Gemini Deep Research + Argon (~$0.38/sweep)
                </option>
                <option value="grounded_search">
                  Gemini 3.8 Flash Grounded Search (~$0.05/sweep)
                </option>
              </select>
            </div>
          </div>

          <label className="flex items-center gap-2 text-xs text-white cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={scheduleConfig.autoPromoteCredibility3Plus}
              onChange={(e) =>
                void updateSchedule({
                  ...scheduleConfig,
                  autoPromoteCredibility3Plus: e.target.checked,
                })
              }
              className="accent-passion w-4 h-4"
            />
            <span>
              Auto-promote primary institutional discoveries (`Credibility Tier ≥ 3`) into the ledger during Monday sweeps
            </span>
          </label>

          {/* Run Now Action Buttons */}
          <div className="pt-2 border-t border-steel/40 flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              disabled={isResearchRunning || budget.totalSpendUsd >= budget.monthlyCapUsd}
              onClick={() => void handleLaunchNow(true)}
              className="px-3 py-2 rounded bg-charcoal border border-sky/60 hover:border-passion disabled:opacity-50 text-xs font-mono text-sky hover:text-white transition"
            >
              Simulate Monday 07:00 AM Sweep
            </button>

            <button
              type="button"
              disabled={isResearchRunning || budget.totalSpendUsd >= budget.monthlyCapUsd}
              onClick={() => void handleLaunchNow(false)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded bg-passion hover:bg-passion/90 disabled:opacity-50 text-xs font-bold text-white shadow-lg transition"
            >
              {isResearchRunning ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Executing 6-Node Multi-Agent Sweep…</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-white" />
                  <span>Run Multi-Agent Sweep Now</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Column 2: FinOps Monthly Budget Guard & Cost Model */}
        <div className="bg-deepsea border border-steel/60 rounded-xl p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-steel/50 pb-3">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-passion" />
                <span>MONTHLY MULTI-AGENT FINOPS BUDGET GUARD</span>
              </h2>
              <p className="text-xs text-sky/85 mt-0.5">
                Enforces a strict monthly ceiling for HII sentiment polling with automatic 80% Flash-Lite downgrade and 100% circuit-breaker cutoff.
              </p>
            </div>
            <span className="px-2.5 py-1 rounded bg-charcoal border border-changingsea font-mono text-xs text-sky font-bold">
              {budget.circuitBreaker}
            </span>
          </div>

          {/* Live Spend Meter */}
          <div className="bg-charcoal/80 border border-steel/50 rounded-lg p-3">
            <div className="flex items-center justify-between text-xs font-mono mb-1.5">
              <span className="text-sky">
                Month-to-Date Spend:{' '}
                <strong className="text-white">${budget.totalSpendUsd.toFixed(2)}</strong> / $
                {budget.monthlyCapUsd.toFixed(2)} cap
              </span>
              <span className="text-changingsea">
                ~{estRemainingRuns} sweeps remaining (${budget.remainingUsd.toFixed(2)} left)
              </span>
            </div>
            <div className="w-full h-2.5 rounded-full bg-deepsea border border-steel/50 overflow-hidden">
              <div
                className={`h-full transition-all ${
                  pctUsed >= 90 ? 'bg-passion' : pctUsed >= 80 ? 'bg-yellow-400' : 'bg-changingsea'
                }`}
                style={{ width: `${pctUsed}%` }}
              />
            </div>
          </div>

          {/* Recommended Budget Tiers */}
          <div className="space-y-2">
            <span className="text-xs font-mono uppercase text-sky block">
              Recommended Monthly Budget Tiers for HII Polling:
            </span>
            {BUDGET_TIERS.map((t) => {
              const active = Math.abs(budgetConfig.monthlyCapUsd - t.capUsd) < 0.01;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    void updateBudgetConfig({
                      ...budgetConfig,
                      monthlyCapUsd: t.capUsd,
                      selectedTierId: t.id,
                    });
                    void updateSchedule({
                      ...scheduleConfig,
                      mode: t.mode,
                    });
                  }}
                  className={`w-full text-left p-2.5 rounded-lg border transition ${
                    active
                      ? 'bg-charcoal border-passion shadow'
                      : 'bg-charcoal/60 border-steel/40 hover:border-sky'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-white flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-passion" />
                      {t.name}
                    </span>
                    <span className="font-mono text-sky">{t.estRuns}</span>
                  </div>
                  <p className="text-[11px] text-sky/80 mt-0.5">{t.desc}</p>
                </button>
              );
            })}
          </div>

          {/* Custom Slider & 80% Auto-Downgrade Rule */}
          <div className="pt-2 border-t border-steel/40 space-y-2 text-xs">
            <div className="flex items-center justify-between font-mono">
              <span className="text-sky">Custom Monthly Budget Ceiling ($1.00 – $15.00):</span>
              <span className="text-white font-bold">${budgetConfig.monthlyCapUsd.toFixed(2)} / mo</span>
            </div>
            <input
              type="range"
              min={1}
              max={15}
              step={0.5}
              value={budgetConfig.monthlyCapUsd}
              onChange={(e) =>
                void updateBudgetConfig({
                  ...budgetConfig,
                  monthlyCapUsd: Number(e.target.value),
                  selectedTierId: 'custom',
                })
              }
              className="w-full accent-passion cursor-pointer"
            />
            <label className="flex items-center gap-2 text-white cursor-pointer">
              <input
                type="checkbox"
                checked={budgetConfig.autoDowngradeAt80Pct}
                onChange={(e) =>
                  void updateBudgetConfig({
                    ...budgetConfig,
                    autoDowngradeAt80Pct: e.target.checked,
                  })
                }
                className="accent-passion w-4 h-4"
              />
              <span>
                Auto-downgrade from Deep Research ($0.38) to Flash Grounded Search ($0.05) at 80% monthly spend
              </span>
            </label>
          </div>
        </div>
      </div>

      {/* Live Multi-Agent Execution Progress Telemetry */}
      {agentStages.length > 0 && (
        <div className="bg-deepsea border border-sky/60 rounded-xl p-4 shadow-xl">
          <div className="flex items-center justify-between mb-2.5">
            <h3 className="text-xs font-mono uppercase tracking-wider text-sky flex items-center gap-2">
              <Radar className="w-4 h-4 text-passion" />
              <span>6-NODE MULTI-AGENT ORCHESTRATION TELEMETRY</span>
            </h3>
            <span className="text-[11px] font-mono text-white">
              {isResearchRunning ? 'IN PROGRESS…' : 'COMPLETED'}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2.5">
            {agentStages.map((st) => (
              <div
                key={st.agentId}
                className={`p-3 rounded-lg border text-xs ${
                  st.status === 'completed'
                    ? 'bg-charcoal border-changingsea'
                    : st.status === 'running'
                    ? 'bg-charcoal border-passion'
                    : 'bg-charcoal/50 border-steel/40 opacity-60'
                }`}
              >
                <div className="flex items-center justify-between font-semibold text-white">
                  <span>{st.label}</span>
                  {st.status === 'completed' && (
                    <CheckCircle2 className="w-4 h-4 text-changingsea shrink-0" />
                  )}
                  {st.status === 'running' && (
                    <Loader2 className="w-4 h-4 text-passion animate-spin shrink-0" />
                  )}
                </div>
                <p className="text-[11px] text-sky/85 mt-1">{st.detail}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Audience Query Pack Selector */}
      <div className="bg-deepsea border border-steel/60 rounded-xl p-5 shadow-xl">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">
            ACTIVE AUDIENCE RESEARCH PACKS ({ALL_AUDIENCES.filter((a) => selectedAudiences[a]).length} / 4)
          </h3>
          <span className="text-xs font-mono text-sky">
            Extractor: temperature=0.0 closed rubric schema
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
                  {AUDIENCE_LABELS[aud]} Agent Pack
                </div>
                <p className="text-[11px] text-sky/80 mt-0.5">{QUERY_PACK_DESCRIPTIONS[aud]}</p>
              </div>
            </label>
          ))}
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
            All discovered evidence has been reviewed. Click <strong>Run Multi-Agent Sweep Now</strong> above to discover new items.
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
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">
            RESEARCH RUN EXECUTION HISTORY ({state.runs.length})
          </h3>
          <span className="flex items-center gap-1 text-xs font-mono text-sky">
            <ShieldCheck className="w-4 h-4 text-changingsea" />
            All runs audited under FinOps ledger
          </span>
        </div>
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
