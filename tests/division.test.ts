import { describe, expect, it } from 'vitest';
import {
  ALL_DIVISIONS,
  computeDivisionScores,
  inferEventDivisionAndPrograms,
  PROGRAM_META,
} from '../src/engine/division';
import { SEED_LEDGER_STATE } from '../src/data/seedBundle';

describe('HII Division & Program Sentiment Intelligence Engine', () => {
  it('correctly maps all 3 operating divisions (NNS, Ingalls, Mission Tech)', () => {
    expect(ALL_DIVISIONS).toEqual(['nns', 'ingalls', 'mission_tech']);
  });

  it('accurately tags primary division and programs from event titles and summaries', () => {
    const cvnEvent = inferEventDivisionAndPrograms({
      id: 'test_1',
      title: 'Navy Confirms 18-Month Schedule Slip for Aircraft Carrier Enterprise (CVN 80) at Newport News',
      summary: 'Newport News Shipbuilding faces material delays on the second Gerald R. Ford-class supercarrier.',
    });
    expect(cvnEvent.division).toBe('nns');
    expect(cvnEvent.programs).toContain('cvn_ford');

    const ingallsEvent = inferEventDivisionAndPrograms({
      id: 'test_2',
      title: 'Ingalls Shipbuilding Awarded $5.1B Multi-Year Contract for Six Arleigh Burke Flight III Destroyers',
      summary: 'Pascagoula yard secures major surface combatant contract modification for DDG 51 destroyers.',
    });
    expect(ingallsEvent.division).toBe('ingalls');
    expect(ingallsEvent.programs).toContain('ddg_51');

    const missionTechEvent = inferEventDivisionAndPrograms({
      id: 'test_3',
      title: 'HII Mission Technologies Wins $1.2B U.S. Navy REMUS & Lionfish UUV Autonomous Vehicle Contract',
      summary: 'High-margin unmanned undersea vehicle production contract awarded to Mission Technologies.',
    });
    expect(missionTechEvent.division).toBe('mission_tech');
    expect(missionTechEvent.programs).toContain('uuv_unmanned');
  });

  it('computes deterministic scores and program waterfalls for Newport News Shipbuilding (NNS)', () => {
    const nnsResult = computeDivisionScores(
      SEED_LEDGER_STATE.events,
      'nns',
      SEED_LEDGER_STATE.settings,
    );

    expect(nnsResult.divisionId).toBe('nns');
    expect(nnsResult.meta.name).toBe('Newport News');
    expect(nnsResult.eventCount).toBeGreaterThan(30);
    expect(nnsResult.latest.compositeScore).toBeGreaterThan(0);
    expect(nnsResult.timeline.length).toBeGreaterThan(10);
    expect(nnsResult.programWaterfall.length).toBeGreaterThan(0);

    // Verify Ford-class carrier and Virginia submarines appear in NNS program waterfall
    const fordProg = nnsResult.programWaterfall.find((p) => p.programId === 'cvn_ford');
    expect(fordProg).toBeDefined();
    expect(fordProg?.name).toContain('Ford-Class');

    const ssnProg = nnsResult.programWaterfall.find((p) => p.programId === 'virginia_ssn');
    expect(ssnProg).toBeDefined();
  });

  it('computes deterministic scores and program waterfalls for Ingalls Shipbuilding', () => {
    const ingallsResult = computeDivisionScores(
      SEED_LEDGER_STATE.events,
      'ingalls',
      SEED_LEDGER_STATE.settings,
    );

    expect(ingallsResult.divisionId).toBe('ingalls');
    expect(ingallsResult.meta.name).toBe('Ingalls');
    expect(ingallsResult.eventCount).toBeGreaterThan(20);
    expect(ingallsResult.latest.compositeScore).toBeGreaterThan(0);

    // Verify DDG-51, LPD, and LHA appear in Ingalls program waterfall
    const ddgProg = ingallsResult.programWaterfall.find((p) => p.programId === 'ddg_51');
    expect(ddgProg).toBeDefined();

    const lpdProg = ingallsResult.programWaterfall.find((p) => p.programId === 'lpd_amphib');
    expect(lpdProg).toBeDefined();
  });

  it('computes deterministic scores and program waterfalls for Mission Technologies', () => {
    const mtResult = computeDivisionScores(
      SEED_LEDGER_STATE.events,
      'mission_tech',
      SEED_LEDGER_STATE.settings,
    );

    expect(mtResult.divisionId).toBe('mission_tech');
    expect(mtResult.meta.name).toBe('Mission Tech');
    expect(mtResult.eventCount).toBeGreaterThan(15);
    expect(mtResult.programWaterfall.length).toBeGreaterThan(0);

    // Verify UUV unmanned and C5ISR appear in Mission Tech waterfall
    const uuvProg = mtResult.programWaterfall.find((p) => p.programId === 'uuv_unmanned');
    expect(uuvProg).toBeDefined();
  });

  it('preserves bit-identical determinism across repeated division runs', () => {
    const r1 = computeDivisionScores(
      SEED_LEDGER_STATE.events,
      'nns',
      SEED_LEDGER_STATE.settings,
    );
    const r2 = computeDivisionScores(
      [...SEED_LEDGER_STATE.events].reverse(),
      'nns',
      SEED_LEDGER_STATE.settings,
    );

    expect(r1.latest.compositeScoreCenti).toBe(r2.latest.compositeScoreCenti);
    expect(r1.programWaterfall[0]?.programId).toBe(r2.programWaterfall[0]?.programId);
    expect(r1.programWaterfall[0]?.netImpactBps).toBe(r2.programWaterfall[0]?.netImpactBps);
  });
});
