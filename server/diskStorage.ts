/**
 * Headless Node Storage helper for reading/writing data/*.json.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type {
  DashboardSettings,
  ForecastCatalyst,
  ImpactEvent,
  LedgerState,
  PendingEvent,
  ResearchRunRecord,
  ScoreRevision,
  ScoreSnapshot,
} from '../src/engine/types.ts';
import { sortEvents } from '../src/engine/state.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(__dirname, '..');
export const DATA_DIR = path.join(REPO_ROOT, 'data');
export const PENDING_DIR = path.join(DATA_DIR, 'pending');

function readJson<T>(filePath: string, fallback: T): T {
  if (!fs.existsSync(filePath)) return fallback;
  return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T;
}

export function loadDiskState(): LedgerState {
  const settings = readJson<DashboardSettings>(path.join(DATA_DIR, 'settings.json'), {
    weights: { executive: 25, congress: 25, navy: 30, public: 20 },
    weightHistory: [],
    asOfDate: '2026-11-15',
    firstPeriodStart: '2011-03-31',
  });
  const events = sortEvents(readJson<ImpactEvent[]>(path.join(DATA_DIR, 'evidence_ledger.json'), []));
  const catalysts = readJson<ForecastCatalyst[]>(path.join(DATA_DIR, 'catalysts.json'), []);
  const revisions = readJson<ScoreRevision[]>(path.join(DATA_DIR, 'revisions.json'), []);
  const runs = readJson<ResearchRunRecord[]>(path.join(DATA_DIR, 'runs.json'), []);
  const snapshots = readJson<ScoreSnapshot[]>(path.join(DATA_DIR, 'snapshots.json'), []);

  const pendingMap = new Map<string, PendingEvent>();
  if (fs.existsSync(PENDING_DIR)) {
    for (const f of fs.readdirSync(PENDING_DIR).sort()) {
      if (!f.endsWith('.json')) continue;
      const arr = readJson<PendingEvent[]>(path.join(PENDING_DIR, f), []);
      for (const item of arr) {
        if (!events.some((e) => e.id === item.id)) {
          pendingMap.set(item.id, item);
        }
      }
    }
  }

  return {
    settings,
    events,
    catalysts,
    revisions,
    runs,
    pending: [...pendingMap.values()],
    snapshots,
  };
}

export function saveDiskState(state: LedgerState): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(PENDING_DIR, { recursive: true });
  fs.writeFileSync(path.join(DATA_DIR, 'settings.json'), JSON.stringify(state.settings, null, 2));
  fs.writeFileSync(path.join(DATA_DIR, 'evidence_ledger.json'), JSON.stringify(sortEvents(state.events), null, 2));
  fs.writeFileSync(path.join(DATA_DIR, 'catalysts.json'), JSON.stringify(state.catalysts, null, 2));
  fs.writeFileSync(path.join(DATA_DIR, 'revisions.json'), JSON.stringify(state.revisions, null, 2));
  fs.writeFileSync(path.join(DATA_DIR, 'runs.json'), JSON.stringify(state.runs, null, 2));
  fs.writeFileSync(path.join(DATA_DIR, 'snapshots.json'), JSON.stringify(state.snapshots, null, 2));
  // Consolidate remaining pending items into pending_seed.json and remove empty/stale files
  for (const f of fs.readdirSync(PENDING_DIR)) {
    if (f.endsWith('.json') && f !== 'pending_seed.json') {
      fs.unlinkSync(path.join(PENDING_DIR, f));
    }
  }
  fs.writeFileSync(path.join(PENDING_DIR, 'pending_seed.json'), JSON.stringify(state.pending, null, 2));
}
