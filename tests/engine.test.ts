import { describe, expect, it } from 'vitest';
import {
  approvePending,
  computeEventId,
  computeLedgerScores,
  findFuzzyDuplicate,
  generateMarkdownExport,
  normalizeWeights,
  setStar,
  updateWeights,
  upsertEvent,
  validateWeights,
} from '../src/engine';
import { SEED_LEDGER_STATE } from '../src/data/seedBundle';

describe('HII Deterministic Sentiment Engine (engine-v1.0.0)', () => {
  it('produces bit-identical ledgerHash and outputHash across repeated runs and shuffled event orderings', () => {
    const base = computeLedgerScores(
      SEED_LEDGER_STATE.events,
      SEED_LEDGER_STATE.catalysts,
      SEED_LEDGER_STATE.settings,
    );

    for (let i = 0; i < 5; i++) {
      const reversed = [...SEED_LEDGER_STATE.events].reverse();
      const interleaved = SEED_LEDGER_STATE.events
        .filter((_, idx) => idx % 2 === 0)
        .concat(SEED_LEDGER_STATE.events.filter((_, idx) => idx % 2 === 1));

      const rRev = computeLedgerScores(
        reversed,
        [...SEED_LEDGER_STATE.catalysts].reverse(),
        SEED_LEDGER_STATE.settings,
      );
      const rInt = computeLedgerScores(
        interleaved,
        SEED_LEDGER_STATE.catalysts,
        SEED_LEDGER_STATE.settings,
      );

      expect(rRev.ledgerHash).toBe(base.ledgerHash);
      expect(rRev.outputHash).toBe(base.outputHash);
      expect(rInt.outputHash).toBe(base.outputHash);
    }
  });

  it('constructs exact variable-granularity periods (2011-2025 annual, 2026 Q1-Q3 quarterly, Oct-Nov 2026 monthly)', () => {
    const res = computeLedgerScores(
      SEED_LEDGER_STATE.events,
      SEED_LEDGER_STATE.catalysts,
      SEED_LEDGER_STATE.settings,
    );
    const annual = res.timeline.filter((p) => p.period.granularity === 'annual');
    const quarterly = res.timeline.filter((p) => p.period.granularity === 'quarterly');
    const monthly = res.timeline.filter((p) => p.period.granularity === 'monthly');

    expect(annual.length).toBe(15); // 2011..2025
    expect(annual[0]?.period.id).toBe('2011');
    expect(annual[14]?.period.id).toBe('2025');

    expect(quarterly.map((q) => q.period.id)).toEqual(['2026-Q1', '2026-Q2', '2026-Q3']);
    expect(monthly.map((m) => m.period.id)).toEqual(['2026-10', '2026-11']);
    expect(res.forecast.map((f) => f.period.id)).toEqual([
      '2026-12',
      '2027-01',
      '2027-02',
      '2027-03',
      '2027-04',
      '2027-05',
    ]);
  });

  it('guarantees starring/unstarring key events never alters any numeric score or outputHash', () => {
    const base = computeLedgerScores(
      SEED_LEDGER_STATE.events,
      SEED_LEDGER_STATE.catalysts,
      SEED_LEDGER_STATE.settings,
    );
    const firstId = SEED_LEDGER_STATE.events[0]!.id;
    const toggledState = setStar(SEED_LEDGER_STATE, firstId, !SEED_LEDGER_STATE.events[0]!.starred);
    const after = computeLedgerScores(
      toggledState.events,
      toggledState.catalysts,
      toggledState.settings,
    );

    expect(after.ledgerHash).toBe(base.ledgerHash);
    expect(after.outputHash).toBe(base.outputHash);
  });

  it('detects retroactive score revisions when a past-dated event is added or approved from pending', () => {
    const pendingRetro = SEED_LEDGER_STATE.pending.find((p) => p.eventDate.startsWith('2026-05'));
    expect(pendingRetro).toBeDefined();

    const { state: nextState, revisions } = approvePending(
      SEED_LEDGER_STATE,
      pendingRetro!.id,
      '2026-11-15T18:00:00Z',
    );

    expect(revisions.length).toBeGreaterThan(0);
    const q2CongRev = revisions.find(
      (r) => r.periodId === '2026-Q2' && r.audience === 'congress',
    );
    expect(q2CongRev).toBeDefined();
    expect(q2CongRev!.deltaCenti).toBeGreaterThan(0);
    expect(q2CongRev!.explanation).toContain('Q2 2026');
    expect(nextState.pending.some((p) => p.id === pendingRetro!.id)).toBe(false);
  });

  it('records versioned editHistory when an existing event rubric is modified', () => {
    const target = SEED_LEDGER_STATE.events[5]!;
    const { state: editedState, revisions } = upsertEvent(
      SEED_LEDGER_STATE,
      {
        id: target.id,
        title: target.title,
        eventDate: target.eventDate,
        sourceType: target.sourceType,
        impacts: target.impacts.map((i) => ({ ...i, magnitude: 5 })),
      },
      'Test Auditor',
      'Upgraded magnitude to 5 for unit test',
      '2026-11-15T19:00:00Z',
    );

    const updated = editedState.events.find((e) => e.id === target.id)!;
    expect(updated.editHistory.length).toBe(1);
    expect(updated.editHistory[0]?.author).toBe('Test Auditor');
    expect(revisions.length).toBeGreaterThan(0);
  });

  it('normalizes and validates integer audience weights summing to 100%', () => {
    expect(validateWeights({ executive: 25, congress: 25, navy: 30, public: 20 })).toBe(true);
    expect(validateWeights({ executive: 25, congress: 25, navy: 30, public: 15 })).toBe(false);

    const norm = normalizeWeights({ executive: 10, congress: 10, navy: 10, public: 10 });
    expect(norm).toEqual({ executive: 25, congress: 25, navy: 25, public: 25 });

    const { state: wState } = updateWeights(
      SEED_LEDGER_STATE,
      { executive: 20, congress: 40, navy: 30, public: 10 },
      'Test Analyst',
      'Shift weight to Congress',
      '2026-11-15T20:00:00Z',
    );
    expect(wState.settings.weights.congress).toBe(40);
    expect(wState.settings.weightHistory.length).toBe(2);
  });

  it('maintains p10Centi <= evCenti <= p90Centi ordering across all 6 forecast months', () => {
    const res = computeLedgerScores(
      SEED_LEDGER_STATE.events,
      SEED_LEDGER_STATE.catalysts,
      SEED_LEDGER_STATE.settings,
    );
    for (const fp of res.forecast) {
      expect(fp.composite.p10Centi).toBeLessThanOrEqual(fp.composite.evCenti);
      expect(fp.composite.evCenti).toBeLessThanOrEqual(fp.composite.p90Centi);
      for (const aud of ['executive', 'congress', 'navy', 'public'] as const) {
        expect(fp.audiences[aud].p10Centi).toBeLessThanOrEqual(fp.audiences[aud].evCenti);
        expect(fp.audiences[aud].evCenti).toBeLessThanOrEqual(fp.audiences[aud].p90Centi);
      }
    }
  });

  it('exports complete audit-grade Markdown report with hashes, timeline, forecast, and revisions', () => {
    const res = computeLedgerScores(
      SEED_LEDGER_STATE.events,
      SEED_LEDGER_STATE.catalysts,
      SEED_LEDGER_STATE.settings,
    );
    const md = generateMarkdownExport(
      res,
      SEED_LEDGER_STATE.events,
      SEED_LEDGER_STATE.catalysts,
      SEED_LEDGER_STATE.revisions,
    );

    expect(md).toContain(res.ledgerHash);
    expect(md).toContain(res.outputHash);
    expect(md).toContain('## 2. Historical Sentiment Timeline');
    expect(md).toContain('## 3. 6-Month Deterministic Scenario Forecast');
    expect(md).toContain('## 4. Starred Key Events');
    expect(md).toContain('## 6. Retroactive Score Revisions Audit Log');

    const sampleId = computeEventId({
      title: 'HII Completes Spin-Off from Northrop Grumman and Begins NYSE Trading',
      eventDate: '2011-03-31',
      sourceType: 'earnings',
    });
    expect(sampleId).toMatch(/^evt_[0-9a-f]{16}$/);
  });

  it('catches fuzzy/near-duplicate events during Monday sweeps across paraphrased headlines, URLs, and same-quarter earnings', () => {
    // 1. Paraphrased Q3 2026 earnings headline on same or nearby date
    const dupEarnings = findFuzzyDuplicate(
      {
        title: 'HII Q3 2026 Earnings Beat Consensus on Record $51B Backlog and Mission Tech Growth',
        eventDate: '2026-11-05',
        sourceType: 'news_media',
        sourceUrls: ['https://www.reuters.com/business/aerospace-defense/'],
      },
      SEED_LEDGER_STATE.events,
    );
    expect(dupEarnings).toBeDefined();
    expect(dupEarnings?.title).toMatch(/Q3 2026/i);

    // 2. Different headline but matching specific article permalink URL
    const existingWithUrl = SEED_LEDGER_STATE.events[0]!;
    const dupUrl = findFuzzyDuplicate(
      {
        title: 'Completely Different Paraphrased Headline From Secondary Aggregator',
        eventDate: '2026-11-10',
        sourceType: 'news_media',
        sourceUrls: existingWithUrl.sourceUrls,
      },
      SEED_LEDGER_STATE.events,
    );
    expect(dupUrl).toBeDefined();
    expect(dupUrl?.id).toBe(existingWithUrl.id);

    // 3. Truly distinct new event is NOT flagged as duplicate
    const distinct = findFuzzyDuplicate(
      {
        title: 'U.S. Navy Commissions USS Massachusetts (SSN-798) Ahead of Fleet Deployment Schedule',
        eventDate: '2026-11-18',
        sourceType: 'navy_statement',
        sourceUrls: ['https://www.navy.mil/Press-Office/Press-Releases/ssn-798-commissioned'],
      },
      SEED_LEDGER_STATE.events,
    );
    expect(distinct).toBeUndefined();
  });
});
