import React, { useMemo, useState } from 'react';
import { ExternalLink, Filter, Search, Star } from 'lucide-react';
import { useDashboard } from '../context/DashboardContext';
import {
  ALL_AUDIENCES,
  ALL_SOURCE_TYPES,
  AUDIENCE_LABELS,
  baseBps,
  bpsToDisplay,
  sortEvents,
  type AudienceId,
  type SourceType,
} from '../engine';

export const EventTimeline: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const {
    state,
    audienceFilter,
    setAudienceFilter,
    starredOnly,
    setStarredOnly,
    toggleStar,
  } = useDashboard();

  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState<SourceType | 'all'>('all');
  const [yearFilter, setYearFilter] = useState<string>('all');

  const years = useMemo(() => {
    const set = new Set(state.events.map((e) => e.eventDate.slice(0, 4)));
    return [...set].sort().reverse();
  }, [state.events]);

  const filteredEvents = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sortEvents(state.events)
      .reverse()
      .filter((e) => {
        if (starredOnly && !e.starred) return false;
        if (audienceFilter !== 'all' && !e.impacts.some((i) => i.audience === audienceFilter)) {
          return false;
        }
        if (sourceFilter !== 'all' && e.sourceType !== sourceFilter) return false;
        if (yearFilter !== 'all' && !e.eventDate.startsWith(yearFilter)) return false;
        if (q && !e.title.toLowerCase().includes(q) && !e.summary.toLowerCase().includes(q)) {
          return false;
        }
        return true;
      });
  }, [state.events, starredOnly, audienceFilter, sourceFilter, yearFilter, search]);

  const displayEvents = compact ? filteredEvents.slice(0, 12) : filteredEvents;

  return (
    <div className="bg-deepsea border border-steel/60 rounded-xl p-4 shadow-xl">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div>
          <h2 className="text-base font-bold text-white tracking-wide flex items-center gap-2">
            <span>EVIDENCE & IMPACT LEDGER</span>
            <span className="px-2 py-0.5 text-xs font-mono rounded bg-charcoal border border-steel text-sky">
              {filteredEvents.length} / {state.events.length} Events
            </span>
          </h2>
          <p className="text-xs text-sky/80 mt-0.5">
            Every event is content-addressed (`evt_sha256`) and classified into discrete rubric codes per audience. Starred events highlight key milestones without altering scores.
          </p>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-sky absolute left-2.5 top-2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search hearings, CVN, COVID, EO..."
              className="pl-8 pr-3 py-1.5 rounded bg-charcoal border border-steel text-white placeholder-steel focus:outline-none focus:border-passion w-56"
            />
          </div>

          <button
            onClick={() => setStarredOnly(!starredOnly)}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded border font-medium transition ${
              starredOnly
                ? 'bg-passion text-white border-passion'
                : 'bg-charcoal text-sky border-steel hover:border-sky'
            }`}
          >
            <Star className={`w-3.5 h-3.5 ${starredOnly ? 'fill-white' : ''}`} />
            <span>Key Events Only</span>
          </button>

          <select
            value={audienceFilter}
            onChange={(e) => setAudienceFilter(e.target.value as AudienceId | 'all')}
            className="bg-charcoal border border-steel rounded px-2.5 py-1.5 text-white focus:outline-none focus:border-passion"
          >
            <option value="all">All 4 Audiences</option>
            {ALL_AUDIENCES.map((a) => (
              <option key={a} value={a}>
                {AUDIENCE_LABELS[a]}
              </option>
            ))}
          </select>

          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value as SourceType | 'all')}
            className="bg-charcoal border border-steel rounded px-2.5 py-1.5 text-white focus:outline-none focus:border-passion"
          >
            <option value="all">All Source Types</option>
            {ALL_SOURCE_TYPES.map((s) => (
              <option key={s} value={s}>
                {s.replace('_', ' ')}
              </option>
            ))}
          </select>

          <select
            value={yearFilter}
            onChange={(e) => setYearFilter(e.target.value)}
            className="bg-charcoal border border-steel rounded px-2.5 py-1.5 text-white font-mono focus:outline-none focus:border-passion"
          >
            <option value="all">All Years (2011–2026)</option>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Events List */}
      <div className="space-y-2.5">
        {displayEvents.map((ev) => (
          <div
            key={ev.id}
            className={`rounded-lg p-3.5 border transition ${
              ev.starred
                ? 'bg-charcoal/95 border-passion/80 shadow-md'
                : 'bg-charcoal/75 border-steel/50 hover:border-sky/60'
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="flex items-start gap-2.5">
                <button
                  onClick={() => void toggleStar(ev.id, !ev.starred)}
                  title={ev.starred ? 'Unstar Key Event' : 'Star as Key Event (highlights on chart)'}
                  className="mt-0.5 p-1 rounded hover:bg-deepsea transition"
                >
                  <Star
                    className={`w-4 h-4 ${
                      ev.starred ? 'text-passion fill-passion' : 'text-steel hover:text-sky'
                    }`}
                  />
                </button>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-bold text-passion">
                      {ev.eventDate}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-deepsea border border-steel/60 text-sky">
                      {ev.sourceType.replace('_', ' ')}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-charcoal border border-steel/50 text-steel">
                      {ev.id}
                    </span>
                    {ev.runId && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-changingsea/20 border border-changingsea text-sky">
                        Retro Research: {ev.runId}
                      </span>
                    )}
                  </div>
                  <h3 className="text-sm font-semibold text-white mt-1">{ev.title}</h3>
                </div>
              </div>

              {ev.sourceUrls.length > 0 && (
                <a
                  href={ev.sourceUrls[0]}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] font-mono text-sky hover:text-passion"
                >
                  <span>Source</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>

            <p className="text-xs text-sky/90 mt-1.5 pl-7">{ev.summary}</p>

            {/* Audience Impact Rubric Pills */}
            <div className="mt-2.5 pl-7 flex flex-wrap items-center gap-2">
              {ev.impacts.map((imp) => {
                const raw = baseBps(imp);
                const pos = raw > 0;
                const neg = raw < 0;
                return (
                  <div
                    key={imp.audience}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-mono border ${
                      pos
                        ? 'bg-changingsea/20 border-changingsea text-white'
                        : neg
                        ? 'bg-passion/20 border-passion text-white'
                        : 'bg-deepsea border-steel text-sky'
                    }`}
                  >
                    <span className="font-bold uppercase">{AUDIENCE_LABELS[imp.audience]}:</span>
                    <span className={pos ? 'text-sky font-bold' : neg ? 'text-passion font-bold' : ''}>
                      {bpsToDisplay(raw)} raw pts
                    </span>
                    <span className="text-sky/80">
                      (M{imp.magnitude}·C{imp.credibility}·{imp.scope}·{imp.persistence})
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {filteredEvents.length === 0 && (
          <div className="text-center py-8 text-sm text-sky flex flex-col items-center gap-2">
            <Filter className="w-6 h-6 text-steel" />
            <span>No ledger events match the current filter criteria.</span>
          </div>
        )}
      </div>
    </div>
  );
};
