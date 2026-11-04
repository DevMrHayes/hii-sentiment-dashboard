/**
 * CLI Pending Evidence Promoter (`npm run promote`).
 * Promotes all pending candidate events into the committed ledger and records any retroactive revisions.
 */
import { approvePending } from '../src/engine/index.ts';
import { loadDiskState, saveDiskState } from '../server/diskStorage.ts';

function main() {
  let state = loadDiskState();
  if (state.pending.length === 0) {
    console.log('[Promote] No pending candidate events to promote.');
    return;
  }
  const now = '2026-11-15T12:00:00Z';
  const ids = state.pending.map((p) => p.id);
  let totalRevs = 0;
  for (const id of ids) {
    const res = approvePending(state, id, now);
    state = res.state;
    totalRevs += res.revisions.length;
  }
  saveDiskState(state);
  console.log(`[Promote] Promoted ${ids.length} pending events into ledger (${totalRevs} score revisions recorded).`);
}

main();
