/**
 * Retroactive revision detection. Compares two computations of the timeline and emits an immutable
 * ScoreRevision for every (period, audience|composite) whose centi score changed, with the triggering
 * events and a human-readable explanation of WHY the score moved.
 */
import type { AudienceId, ImpactEvent, LedgerComputationResult, RevisionReason, ScoreRevision } from './types';
import { ALL_AUDIENCES, AUDIENCE_LABELS } from './types';
import { canonicalJson, sha256Hex } from './hash';
import { signedCenti, centiToDisplay } from './math';

export interface RevisionContext {
  runId: string;
  timestamp: string;
  reason: RevisionReason;
  /** Events added / edited / removed by this change. */
  changedEvents: ImpactEvent[];
}

export function revisionId(runId: string, periodId: string, audience: string, oldC: number, newC: number): string {
  return 'rev_' + sha256Hex(canonicalJson({ audience, newC, oldC, periodId, runId })).slice(0, 16);
}

export function detectRevisions(prev: LedgerComputationResult, next: LedgerComputationResult, ctx: RevisionContext): ScoreRevision[] {
  const out: ScoreRevision[] = [];
  const prevById = new Map(prev.timeline.map((r) => [r.period.id, r]));
  const changedIds = new Set(ctx.changedEvents.map((e) => e.id));
  const titleOf = new Map(ctx.changedEvents.map((e) => [e.id, e]));
  // Only periods that already existed (i.e., previously scored) can be "revised".
  for (const rec of next.timeline) {
    const old = prevById.get(rec.period.id);
    if (!old) continue;
    const targets: (AudienceId | 'composite')[] = [...ALL_AUDIENCES, 'composite'];
    for (const aud of targets) {
      const oldC = aud === 'composite' ? old.compositeCenti : old.audiences[aud].scoreCenti;
      const newC = aud === 'composite' ? rec.compositeCenti : rec.audiences[aud].scoreCenti;
      if (oldC === newC) continue;
      let triggers: string[];
      if (aud === 'composite') {
        triggers = [...changedIds].sort();
      } else {
        const touching = new Set<string>();
        for (const c of rec.audiences[aud].contributions) if (changedIds.has(c.eventId)) touching.add(c.eventId);
        for (const c of old.audiences[aud].contributions) if (changedIds.has(c.eventId)) touching.add(c.eventId);
        triggers = [...touching].sort();
      }
      const delta = newC - oldC;
      const audLabel = aud === 'composite' ? 'Composite' : AUDIENCE_LABELS[aud];
      const evDesc = triggers
        .map((id) => titleOf.get(id))
        .filter(Boolean)
        .map((e) => `"${e!.title}" (${e!.eventDate})`)
        .join('; ');
      const verb: Record<RevisionReason, string> = {
        NEW_RETROACTIVE_EVIDENCE: 'Retroactive discovery of',
        RUBRIC_RECLASSIFICATION: 'Rubric reclassification of',
        SOURCE_CORROBORATION_UPGRADE: 'Source corroboration upgrade for',
        EVENT_DATE_CORRECTION: 'Event date correction for',
        EVENT_REMOVED: 'Removal of',
        WEIGHT_PROFILE_CHANGE: 'Composite weight profile change',
      };
      const explanation = ctx.reason === 'WEIGHT_PROFILE_CHANGE'
        ? `${verb[ctx.reason]} moved ${rec.period.label} ${audLabel} from ${centiToDisplay(oldC)} to ${centiToDisplay(newC)} (${signedCenti(delta)} pts).`
        : `${verb[ctx.reason]} ${evDesc || 'ledger evidence'} adjusted ${rec.period.label} ${audLabel} from ${centiToDisplay(oldC)} to ${centiToDisplay(newC)} (${signedCenti(delta)} pts).`;
      out.push({
        id: revisionId(ctx.runId, rec.period.id, aud, oldC, newC),
        timestamp: ctx.timestamp,
        runId: ctx.runId,
        periodId: rec.period.id,
        periodLabel: rec.period.label,
        audience: aud,
        oldScoreCenti: oldC,
        newScoreCenti: newC,
        deltaCenti: delta,
        triggeringEventIds: triggers,
        revisionReason: ctx.reason,
        explanation,
      });
    }
  }
  return out;
}
