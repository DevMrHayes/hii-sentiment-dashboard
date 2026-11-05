/**
 * Vite Dev/Preview Server REST API Middleware (`/api/*`).
 * Connects the React UI directly to `data/*.json` and `research/run_research.py`.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'vite';
import {
  approvePending,
  rejectPending,
  removeEvent,
  setStar,
  takeSnapshot,
  updateWeights,
  upsertEvent,
  type AudienceId,
  type AudienceWeights,
  type BudgetConfig,
  type EventInput,
  type ForecastCatalyst,
  type ScheduleConfig,
} from '../src/engine/index.ts';
import { loadDiskState, REPO_ROOT, saveDiskState } from './diskStorage.ts';

function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
    });
    req.on('end', () => {
      if (!data.trim()) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(data) as Record<string, unknown>);
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res: ServerResponse, status: number, payload: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

function readBudgetStatus(): { monthlyCapUsd: number; totalSpendUsd: number; remainingUsd: number; circuitBreaker: string } {
  try {
    const tierBLedgerPath = path.join(REPO_ROOT, 'data', 'budget_ledger.json');
    const settingsPath = path.join(REPO_ROOT, 'data', 'settings.json');
    let cap = 5.0;
    if (fs.existsSync(settingsPath)) {
      const s = JSON.parse(fs.readFileSync(settingsPath, 'utf-8')) as { budgetConfig?: { monthlyCapUsd?: number } };
      cap = Number(s.budgetConfig?.monthlyCapUsd ?? 5.0);
    }
    if (fs.existsSync(tierBLedgerPath)) {
      const raw = JSON.parse(fs.readFileSync(tierBLedgerPath, 'utf-8')) as { monthSpendUsd?: number };
      const spent = Number(raw.monthSpendUsd ?? 0.0996);
      return {
        monthlyCapUsd: cap,
        totalSpendUsd: spent,
        remainingUsd: Math.max(0, cap - spent),
        circuitBreaker: spent >= cap ? 'TRIPPED' : spent >= 0.8 * cap ? 'AUTO-DOWNGRADE (80%)' : 'ACTIVE (TIER B)',
      };
    }
  } catch {
    // ignore
  }
  return { monthlyCapUsd: 5.0, totalSpendUsd: 0.0996, remainingUsd: 4.9004, circuitBreaker: 'ACTIVE (TIER B)' };
}

export function hiiApiPlugin(): Plugin {
  const handleApi = async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const url = req.url?.split('?')[0] ?? '';
    if (!url.startsWith('/api/')) {
      next();
      return;
    }

    try {
      if (req.method === 'GET' && url === '/api/state') {
        const state = loadDiskState();
        sendJson(res, 200, { state, budget: readBudgetStatus() });
        return;
      }

      if (req.method === 'POST' && url === '/api/weights') {
        const body = await readBody(req);
        const weights = body.weights as AudienceWeights;
        const author = String(body.author || 'Analyst');
        const reason = String(body.reason || 'Adjusted composite audience weights');
        const now = new Date().toISOString();
        const current = loadDiskState();
        const { state, revisions } = updateWeights(current, weights, author, reason, now);
        saveDiskState(state);
        sendJson(res, 200, { state, revisions });
        return;
      }

      if (req.method === 'POST' && url === '/api/as-of-date') {
        const body = await readBody(req);
        const asOfDate = String(body.asOfDate || '2026-11-15');
        const current = loadDiskState();
        const nextState = { ...current, settings: { ...current.settings, asOfDate } };
        saveDiskState(nextState);
        sendJson(res, 200, { state: nextState });
        return;
      }

      if (req.method === 'POST' && url === '/api/events/star') {
        const body = await readBody(req);
        const id = String(body.id || '');
        const starred = Boolean(body.starred);
        const current = loadDiskState();
        const nextState = setStar(current, id, starred);
        saveDiskState(nextState);
        sendJson(res, 200, { state: nextState });
        return;
      }

      if (req.method === 'POST' && url === '/api/events/upsert') {
        const body = await readBody(req);
        const event = body.event as EventInput;
        const author = String(body.author || 'Analyst');
        const reason = String(body.reason || 'Manual ledger update');
        const now = new Date().toISOString();
        const current = loadDiskState();
        const { state, revisions } = upsertEvent(current, event, author, reason, now);
        saveDiskState(state);
        sendJson(res, 200, { state, revisions });
        return;
      }

      if (req.method === 'POST' && url === '/api/events/delete') {
        const body = await readBody(req);
        const id = String(body.id || '');
        const author = String(body.author || 'Analyst');
        const reason = String(body.reason || 'Removed event from ledger');
        const now = new Date().toISOString();
        const current = loadDiskState();
        const { state, revisions } = removeEvent(current, id, author, reason, now);
        saveDiskState(state);
        sendJson(res, 200, { state, revisions });
        return;
      }

      if (req.method === 'POST' && url === '/api/catalysts') {
        const body = await readBody(req);
        const catalysts = body.catalysts as ForecastCatalyst[];
        const current = loadDiskState();
        const nextState = { ...current, catalysts };
        saveDiskState(nextState);
        sendJson(res, 200, { state: nextState });
        return;
      }

      if (req.method === 'POST' && url === '/api/pending/approve') {
        const body = await readBody(req);
        const id = String(body.id || '');
        const overrides = body.overrides as Partial<EventInput> | undefined;
        const now = new Date().toISOString();
        const current = loadDiskState();
        const { state, revisions } = approvePending(current, id, now, overrides);
        saveDiskState(state);
        sendJson(res, 200, { state, revisions });
        return;
      }

      if (req.method === 'POST' && url === '/api/pending/reject') {
        const body = await readBody(req);
        const id = String(body.id || '');
        const current = loadDiskState();
        const nextState = rejectPending(current, id);
        saveDiskState(nextState);
        sendJson(res, 200, { state: nextState });
        return;
      }

      if (req.method === 'POST' && url === '/api/snapshots') {
        const body = await readBody(req);
        const label = String(body.label || 'Manual Snapshot');
        const now = new Date().toISOString();
        const current = loadDiskState();
        const { state, snapshot } = takeSnapshot(current, label, now);
        saveDiskState(state);
        sendJson(res, 200, { state, snapshot });
        return;
      }

      if (req.method === 'POST' && url === '/api/schedule') {
        const body = await readBody(req);
        const schedule = body.schedule as ScheduleConfig;
        const current = loadDiskState();
        const nextState = { ...current, settings: { ...current.settings, schedule } };
        saveDiskState(nextState);
        sendJson(res, 200, { state: nextState });
        return;
      }

      if (req.method === 'POST' && url === '/api/budget') {
        const body = await readBody(req);
        const budgetConfig = body.budgetConfig as BudgetConfig;
        const current = loadDiskState();
        const nextState = { ...current, settings: { ...current.settings, budgetConfig } };
        saveDiskState(nextState);
        sendJson(res, 200, { state: nextState, budget: readBudgetStatus() });
        return;
      }

      if (req.method === 'POST' && (url === '/api/research/run' || url === '/api/cron/monday-sweep')) {
        const body = await readBody(req);
        const current = loadDiskState();
        const isCron = url === '/api/cron/monday-sweep';
        const audiences =
          (body.audiences as AudienceId[]) ??
          current.settings.schedule?.audiences ??
          (['executive', 'congress', 'navy', 'public'] as AudienceId[]);
        const mode = String(body.mode || current.settings.schedule?.mode || 'auto');

        const budgetStatus = readBudgetStatus();
        const configuredCap = current.settings.budgetConfig?.monthlyCapUsd ?? 5.0;
        if (budgetStatus.totalSpendUsd >= configuredCap) {
          sendJson(res, 429, {
            error: `Monthly HII Sentiment Polling budget cap ($${configuredCap.toFixed(2)}) reached. Increase cap in the FinOps Budget panel to run additional sweeps.`,
          });
          return;
        }

        const effectiveMode =
          current.settings.budgetConfig?.autoDowngradeAt80Pct &&
          budgetStatus.totalSpendUsd >= 0.8 * configuredCap
            ? 'grounded_search'
            : mode;

        const scriptPath = path.join(REPO_ROOT, 'research', 'run_research.py');
        const pyCmd = process.platform === 'win32' ? 'py' : 'python3';
        const pyArgs =
          process.platform === 'win32'
            ? ['-3', scriptPath, '--audiences', audiences.join(','), '--mode', effectiveMode]
            : [scriptPath, '--audiences', audiences.join(','), '--mode', effectiveMode];

        await new Promise<void>((resolve) => {
          execFile(pyCmd, pyArgs, { cwd: REPO_ROOT, timeout: 120_000 }, () => {
            resolve();
          });
        });

        let updated = loadDiskState();
        const nowIso = new Date().toISOString();

        // If scheduled Monday run or auto-promote is enabled, promote Credibility >= 3 discoveries automatically
        if (current.settings.schedule?.autoPromoteCredibility3Plus) {
          const highCredIds = updated.pending
            .filter((p) => p.impacts.every((i) => i.credibility >= 3))
            .map((p) => p.id);
          for (const pid of highCredIds) {
            const promoted = approvePending(updated, pid, nowIso);
            updated = promoted.state;
          }
        }

        if (isCron && updated.settings.schedule) {
          updated = {
            ...updated,
            settings: {
              ...updated.settings,
              schedule: {
                ...updated.settings.schedule,
                lastScheduledRunAt: nowIso,
              },
            },
          };
        }
        saveDiskState(updated);
        sendJson(res, 200, { state: updated, budget: readBudgetStatus() });
        return;
      }

      sendJson(res, 404, { error: `Unknown endpoint ${url}` });
    } catch (err) {
      sendJson(res, 400, { error: err instanceof Error ? err.message : String(err) });
    }
  };

  return {
    name: 'hii-local-api',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        void handleApi(req, res, next);
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        void handleApi(req, res, next);
      });
    },
  };
}
