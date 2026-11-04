/** Shared state primitives (split out to avoid scorer <-> forecast import cycles). */
import type { AudienceId, AudienceWeights, ImpactEvent } from './types';
import { ALL_AUDIENCES } from './types';
import { baseBps, contributionBps } from './rubric';
import { divRne, isoToEpochDays } from './math';

export function compositeCenti(scores: Record<AudienceId, number>, w: AudienceWeights): number {
  let acc = 0;
  for (const a of ALL_AUDIENCES) acc += scores[a] * w[a];
  return divRne(acc, 100);
}

/** Stable canonical ordering: eventDate ASC, id ASC. */
export function sortEvents<T extends { eventDate: string; id: string }>(events: T[]): T[] {
  return [...events].sort((a, b) =>
    a.eventDate < b.eventDate ? -1 : a.eventDate > b.eventDate ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
  );
}

export interface PreparedImpact {
  event: ImpactEvent;
  dayNumber: number;
  base: number;
  persistence: ImpactEvent['impacts'][number]['persistence'];
}

export function prepareImpacts(events: ImpactEvent[], asOfDate: string): Record<AudienceId, PreparedImpact[]> {
  const out: Record<AudienceId, PreparedImpact[]> = { executive: [], congress: [], navy: [], public: [] };
  for (const e of sortEvents(events)) {
    if (e.eventDate > asOfDate) continue; // future-dated evidence never scores history
    const seen = new Set<AudienceId>();
    for (const imp of e.impacts) {
      if (seen.has(imp.audience)) continue; // at most one impact per audience (first wins, deterministic)
      seen.add(imp.audience);
      out[imp.audience].push({ event: e, dayNumber: isoToEpochDays(e.eventDate), base: baseBps(imp), persistence: imp.persistence });
    }
  }
  return out;
}

/** Raw state (bps) of an audience at a given sample date, plus per-event contributions. */
export function stateAt(prepared: PreparedImpact[], sampleIso: string): { raw: number; parts: Map<string, number> } {
  const day = isoToEpochDays(sampleIso);
  let raw = 0;
  const parts = new Map<string, number>();
  for (const p of prepared) {
    if (p.dayNumber > day) break; // sorted by date
    const c = contributionBps(p.base, day - p.dayNumber, p.persistence);
    if (c !== 0) {
      raw += c;
      parts.set(p.event.id, c);
    }
  }
  return { raw, parts };
}
