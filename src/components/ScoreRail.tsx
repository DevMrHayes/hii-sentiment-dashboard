import React, { useMemo, useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  ChevronRight,
  Eye,
  Minus,
  Star,
  TrendingUp,
} from 'lucide-react';
import { useDashboard } from '../context/DashboardContext';
import {
  ALL_AUDIENCES,
  AUDIENCE_LABELS,
  bpsToDisplay,
  centiToDisplay,
  signedCenti,
  type AudienceId,
  type ImpactEvent,
} from '../engine';
import {
  PeriodBreakdownModal,
  buildSourceMixFromEvents,
  type PeriodBreakdownEvent,
} from './SentimentHoverTooltip';

const AUDIENCE_COLORS: Record<AudienceId, string> = {
  navy: '#38bdf8',
  executive: '#75abd1',
  congress: '#509ca2',
  public: '#9ca3af',
};

const STAKEHOLDER_ORDER: AudienceId[] = ['navy', 'executive', 'congress', 'public'];

export const ScoreRail: React.FC = () => {
  const { state, result, selectedPeriodId, setSelectedPeriodId, setActiveTab } = useDashboard();
  const [inspectModalOpen, setInspectModalOpen] = useState(false);

  const latestPeriod = result.timeline[result.timeline.length - 1]!;
  const priorPeriod = result.timeline[result.timeline.length - 2];
  const selectedRecord =
    result.timeline.find((r) => r.period.id === selectedPeriodId) ?? latestPeriod;
  const lastForecast = result.forecast[result.forecast.length - 1];

  const eventMap = useMemo(
    () => new Map(state.events.map((e) => [e.id, e])),
    [state.events],
  );

  // Deduplicated top drivers across all 4 audiences for the selected period
  const selectedDrivers = useMemo(() => {
    const byEvent = new Map<
      string,
      {
        eventId: string;
        title: string;
        eventDate: string;
        starred: boolean;
        dominantBps: number;
      }
    >();

    for (const aud of ALL_AUDIENCES) {
      for (const c of selectedRecord.audiences[aud].contributions) {
        const ev = eventMap.get(c.eventId);
        const existing = byEvent.get(c.eventId);
        if (!existing) {
          byEvent.set(c.eventId, {
            eventId: c.eventId,
            title: c.title,
            eventDate: ev?.eventDate ?? selectedRecord.period.endDate,
            starred: Boolean(c.starred || ev?.starred),
            dominantBps: c.effectiveBps,
          });
        } else if (Math.abs(c.effectiveBps) > Math.abs(existing.dominantBps)) {
          existing.dominantBps = c.effectiveBps;
        }
      }
    }

    return Array.from(byEvent.values())
      .sort((a, b) => Math.abs(b.dominantBps) - Math.abs(a.dominantBps))
      .slice(0, 6);
  }, [selectedRecord, eventMap]);

  // Precompute modal payload if user clicks Inspect Full Breakdown
  const selectedModalData = useMemo(() => {
    const contributingIds = new Set<string>();
    for (const aud of ALL_AUDIENCES) {
      for (const c of selectedRecord.audiences[aud].contributions) {
        contributingIds.add(c.eventId);
      }
    }
    const events: ImpactEvent[] = Array.from(contributingIds)
      .map((id) => eventMap.get(id))
      .filter((e): e is ImpactEvent => e !== undefined)
      .sort((a, b) => (b.eventDate > a.eventDate ? 1 : -1));

    const periodEvents: PeriodBreakdownEvent[] = events.map((e) => ({
      id: e.id,
      title: e.title,
      eventDate: e.eventDate,
      sourceType: e.sourceType,
      starred: e.starred,
    }));

    return {
      sourceMix: buildSourceMixFromEvents(events),
      totalImpactingEvents: events.length,
      keyEventTitles: selectedRecord.keyEventIds.map((id) => eventMap.get(id)?.title ?? id),
      periodEvents,
      subtitle: `${selectedRecord.inPeriodEventIds.length} new in period · ${events.length} active drivers`,
    };
  }, [selectedRecord, eventMap]);

  const renderDeltaBadge = (deltaCenti: number) => {
    if (deltaCenti > 0) {
      return (
        <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-xs font-mono font-semibold tabular-nums bg-[#2dd4bf]/15 text-[#2dd4bf] border border-[#2dd4bf]/40">
          <ArrowUpRight className="w-3.5 h-3.5 shrink-0" />
          {signedCenti(deltaCenti)}
        </span>
      );
    }
    if (deltaCenti < 0) {
      return (
        <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-xs font-mono font-semibold tabular-nums bg-[#f43f5e]/15 text-[#f43f5e] border border-[#f43f5e]/40">
          <ArrowDownRight className="w-3.5 h-3.5 shrink-0" />
          {signedCenti(deltaCenti)}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-xs font-mono tabular-nums text-muted bg-surface2 border border-hairline">
        <Minus className="w-3.5 h-3.5 shrink-0" />
        0.00
      </span>
    );
  };

  return (
    <aside
      aria-label="Composite Sentiment and Stakeholder Attribution"
      className="bg-[#1e2227] border border-[#2e353d] rounded-xl divide-y divide-[#2e353d] shadow-xl overflow-hidden"
    >
      {/* Section 1: Composite Sentiment Header */}
      <section className="p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-xs font-semibold text-[#98a6b3] tracking-wide">
            Composite Sentiment · {latestPeriod.period.label}
          </h2>
          <span className="text-xs font-mono tabular-nums text-[#98a6b3]">
            vs {priorPeriod?.period.label ?? 'Prior'}
          </span>
        </div>

        <div className="mt-2 flex items-baseline justify-between gap-3">
          <div className="text-4xl font-bold font-mono tabular-nums text-white tracking-tight">
            {centiToDisplay(result.latest.composite.scoreCenti)}
            <span className="text-sm font-normal text-[#98a6b3] ml-1.5">/ 100</span>
          </div>
          {renderDeltaBadge(result.latest.composite.deltaCenti)}
        </div>

        {/* Weight Distribution Bar */}
        <div className="mt-3.5">
          <div className="w-full h-1.5 rounded-full overflow-hidden flex bg-[#16191d] border border-[#2e353d]">
            <div style={{ width: `${result.weights.navy}%`, backgroundColor: AUDIENCE_COLORS.navy }} />
            <div style={{ width: `${result.weights.executive}%`, backgroundColor: AUDIENCE_COLORS.executive }} />
            <div style={{ width: `${result.weights.congress}%`, backgroundColor: AUDIENCE_COLORS.congress }} />
            <div style={{ width: `${result.weights.public}%`, backgroundColor: AUDIENCE_COLORS.public }} />
          </div>
          <div className="flex flex-wrap justify-between gap-2 text-[11px] font-mono tabular-nums text-[#98a6b3] mt-1.5">
            <span>Navy {result.weights.navy}%</span>
            <span>Exec {result.weights.executive}%</span>
            <span>Cong {result.weights.congress}%</span>
            <span>Public {result.weights.public}%</span>
          </div>
        </div>

        {/* 6-Month Forecast Summary */}
        {lastForecast && (
          <div className="mt-3 pt-3 border-t border-[#2e353d] flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-1.5 text-[#98a6b3]">
              <TrendingUp className="w-3.5 h-3.5 text-passion shrink-0" />
              <span>6-Mo Forecast ({lastForecast.period.label})</span>
            </div>
            <div className="font-mono tabular-nums text-white font-semibold text-right">
              EV {centiToDisplay(lastForecast.composite.evCenti)}{' '}
              <span className="text-[#98a6b3] font-normal">
                [{centiToDisplay(lastForecast.composite.p10Centi)}–
                {centiToDisplay(lastForecast.composite.p90Centi)}]
              </span>
            </div>
          </div>
        )}
      </section>

      {/* Section 2: 4-Row Aligned Stakeholder Table */}
      <section className="p-4">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-[#2e353d] text-xs font-medium text-[#98a6b3]">
              <th scope="col" className="pb-2 font-medium">
                Stakeholder
              </th>
              <th scope="col" className="pb-2 text-right font-medium pr-3">
                Score
              </th>
              <th scope="col" className="pb-2 text-right font-medium">
                Delta
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#2e353d]/70">
            {STAKEHOLDER_ORDER.map((aud) => {
              const cur = result.latest[aud];
              const clampedScore = Math.max(0, Math.min(100, cur.scoreCenti / 100));
              const deltaClass =
                cur.deltaCenti > 0
                  ? 'text-[#2dd4bf]'
                  : cur.deltaCenti < 0
                    ? 'text-[#f43f5e]'
                    : 'text-[#98a6b3]';

              return (
                <tr key={aud} className="hover:bg-[#252a30]/50 transition-colors">
                  <td className="py-2.5 pr-2 align-middle">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: AUDIENCE_COLORS[aud] }}
                        aria-hidden="true"
                      />
                      <span className="text-xs font-medium text-white truncate">
                        {AUDIENCE_LABELS[aud]}
                      </span>
                      <span className="text-[11px] font-mono tabular-nums text-[#98a6b3]">
                        {result.weights[aud]}%
                      </span>
                    </div>
                    <div className="mt-1.5 ml-4 h-1.5 w-24 sm:w-28 rounded-full bg-[#16191d] overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${clampedScore}%`,
                          backgroundColor: AUDIENCE_COLORS[aud],
                        }}
                      />
                    </div>
                  </td>
                  <td className="py-2.5 pr-3 text-right align-middle font-mono text-sm font-semibold tabular-nums text-white">
                    {centiToDisplay(cur.scoreCenti)}
                  </td>
                  <td
                    className={`py-2.5 text-right align-middle font-mono text-xs font-semibold tabular-nums ${deltaClass}`}
                  >
                    {cur.deltaCenti === 0 ? '0.00' : signedCenti(cur.deltaCenti)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      {/* Section 3: Selected Period Drivers */}
      <section className="p-4 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-xs font-semibold text-white font-mono tabular-nums">
            Selected Period Drivers · {selectedRecord.period.label}
          </h3>
          <div className="flex items-center gap-1.5 shrink-0">
            {selectedRecord.period.id !== latestPeriod.period.id && (
              <button
                type="button"
                onClick={() => setSelectedPeriodId(latestPeriod.period.id)}
                className="px-2 py-1 text-[11px] font-mono rounded bg-[#16191d] border border-[#2e353d] text-[#98a6b3] hover:text-white hover:border-sky transition"
              >
                Jump to Latest
              </button>
            )}
            <button
              type="button"
              onClick={() => setInspectModalOpen(true)}
              className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-mono rounded bg-[#16191d] border border-[#2e353d] text-sky hover:text-white hover:border-sky transition"
            >
              <Eye className="w-3 h-3" />
              <span>Breakdown</span>
            </button>
          </div>
        </div>

        <p className="text-xs font-mono tabular-nums text-[#98a6b3]">
          {selectedRecord.period.startDate} → {selectedRecord.period.endDate} ·{' '}
          <span className="text-white font-semibold">
            {centiToDisplay(selectedRecord.compositeCenti)}
          </span>{' '}
          composite
        </p>

        {selectedDrivers.length === 0 ? (
          <div className="py-3 text-xs text-[#98a6b3]">
            Baseline time-decay window (no direct ledger drivers in this period).
          </div>
        ) : (
          <div className="divide-y divide-[#2e353d]/70 border-y border-[#2e353d]">
            {selectedDrivers.map((d) => {
              const isPos = d.dominantBps >= 0;
              return (
                <button
                  key={d.eventId}
                  type="button"
                  onClick={() => setActiveTab('ledger')}
                  title={`Inspect "${d.title}" in Evidence Ledger`}
                  className="w-full py-2 px-1 flex items-center justify-between gap-2.5 text-left text-xs hover:bg-[#252a30]/60 transition group"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[11px] font-mono tabular-nums text-[#98a6b3] shrink-0">
                      {d.eventDate}
                    </span>
                    {d.starred && (
                      <Star className="w-3 h-3 text-passion fill-passion shrink-0" />
                    )}
                    <span className="text-gray-100 group-hover:text-white truncate">
                      {d.title}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span
                      className={`font-mono tabular-nums font-semibold ${
                        isPos ? 'text-[#2dd4bf]' : 'text-[#f43f5e]'
                      }`}
                    >
                      {bpsToDisplay(d.dominantBps)}
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 text-[#98a6b3] opacity-60 group-hover:opacity-100" />
                  </div>
                </button>
              );
            })}
          </div>
        )}

        <button
          type="button"
          onClick={() => setActiveTab('control')}
          className="w-full py-2 px-3 rounded-lg bg-[#16191d] border border-[#2e353d] hover:border-sky hover:bg-[#252a30] text-xs font-medium text-sky hover:text-white transition"
        >
          Adjust Audience Weights or Add Event →
        </button>
      </section>

      <PeriodBreakdownModal
        isOpen={inspectModalOpen}
        onClose={() => setInspectModalOpen(false)}
        label={selectedRecord.period.label}
        composite={selectedRecord.compositeCenti / 100}
        scores={{
          executive: selectedRecord.audiences.executive.scoreCenti / 100,
          congress: selectedRecord.audiences.congress.scoreCenti / 100,
          navy: selectedRecord.audiences.navy.scoreCenti / 100,
          public: selectedRecord.audiences.public.scoreCenti / 100,
        }}
        sourceMix={selectedModalData.sourceMix}
        totalImpactingEvents={selectedModalData.totalImpactingEvents}
        keyEventTitles={selectedModalData.keyEventTitles}
        periodEvents={selectedModalData.periodEvents}
        subtitle={selectedModalData.subtitle}
      />
    </aside>
  );
};
