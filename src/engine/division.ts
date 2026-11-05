/**
 * Huntington Ingalls Industries (NYSE: HII)
 * Division & Program Sentiment Intelligence Module
 *
 * Deterministic breakdown by operating division:
 * - Newport News Shipbuilding (NNS)
 * - Ingalls Shipbuilding (Ingalls)
 * - Mission Technologies (Mission Tech)
 *
 * Integrates with the core 4-audience scoring engine (Executive, Congress, Navy, Public).
 */

import type { AudienceId, DashboardSettings, ImpactEvent, PeriodRecord } from './types';
import { ALL_AUDIENCES, AUDIENCE_LABELS } from './types';
import { computeTimeline } from './scorer';

export type DivisionId = 'nns' | 'ingalls' | 'mission_tech';

export const ALL_DIVISIONS: readonly DivisionId[] = ['nns', 'ingalls', 'mission_tech'] as const;

export const DIVISION_META: Record<
  DivisionId,
  {
    id: DivisionId;
    name: string;
    fullName: string;
    location: string;
    description: string;
    corePrograms: string[];
  }
> = {
  nns: {
    id: 'nns',
    name: 'Newport News',
    fullName: 'Newport News Shipbuilding (NNS)',
    location: 'Newport News, VA',
    description:
      'Sole designer and builder of U.S. Navy nuclear-powered aircraft carriers (CVN) and one of only two nuclear submarine builders (Virginia & Columbia classes).',
    corePrograms: ['Gerald R. Ford-Class CVN', 'Nimitz-Class CVN RCOH', 'Virginia-Class SSN', 'Columbia-Class SSBN'],
  },
  ingalls: {
    id: 'ingalls',
    name: 'Ingalls',
    fullName: 'Ingalls Shipbuilding',
    location: 'Pascagoula, MS',
    description:
      'Primary builder of U.S. Navy large surface combatants (Arleigh Burke DDG 51 Flight III), amphibious assault ships (LHA), amphibious transport docks (LPD), and National Security Cutters (NSC).',
    corePrograms: ['Arleigh Burke DDG 51', 'America-Class LHA', 'San Antonio-Class LPD', 'Legend-Class NSC'],
  },
  mission_tech: {
    id: 'mission_tech',
    name: 'Mission Tech',
    fullName: 'HII Mission Technologies',
    location: 'McLean, VA & Global',
    description:
      'High-margin defense technology and autonomy division delivering unmanned underwater vehicles (REMUS/Lionfish), C5ISR systems, cyber, electronic warfare, and fleet sustainment.',
    corePrograms: ['REMUS & Lionfish UUVs', 'C5ISR & Electronic Warfare', 'Cyber & AI Training', 'Fleet Modernization'],
  },
};

export type ProgramId =
  | 'cvn_ford'
  | 'cvn_rcoh'
  | 'virginia_ssn'
  | 'columbia_ssbn'
  | 'ddg_51'
  | 'lpd_amphib'
  | 'lha_amphib'
  | 'nsc_cutter'
  | 'uuv_unmanned'
  | 'c5isr_tech'
  | 'commercial_energy'
  | 'corporate_macro';

export const PROGRAM_META: Record<
  ProgramId,
  { name: string; division: DivisionId | 'shared'; shipClass: string; desc: string }
> = {
  cvn_ford: {
    name: 'Gerald R. Ford-Class CVN (78, 79, 80, 81)',
    division: 'nns',
    shipClass: 'CVN-78 / Nuclear Aircraft Carrier',
    desc: 'Next-generation nuclear aircraft carrier construction, sea trials, weapons elevators, and deliveries at Newport News.',
  },
  cvn_rcoh: {
    name: 'Nimitz-Class Carrier RCOH (CVN 72, 73, 74, 75)',
    division: 'nns',
    shipClass: 'CVN-68 / Refueling Complex Overhaul',
    desc: 'Mid-life nuclear reactor refueling and complex modernization overhauls for the carrier fleet.',
  },
  virginia_ssn: {
    name: 'Virginia-Class Fast Attack Submarine (SSN)',
    division: 'nns',
    shipClass: 'SSN-774 / Nuclear Attack Submarine',
    desc: 'Co-production with General Dynamics Electric Boat for Block IV/V/VI attack submarines and VPM modules.',
  },
  columbia_ssbn: {
    name: 'Columbia-Class Ballistic Submarine (SSBN)',
    division: 'nns',
    shipClass: 'SSBN-826 / Nuclear Ballistic Submarine',
    desc: 'Strategic nuclear deterrent bow and stern module manufacturing under sub-contract to lead builder Electric Boat.',
  },
  ddg_51: {
    name: 'Arleigh Burke-Class Guided Missile Destroyer (DDG)',
    division: 'ingalls',
    shipClass: 'DDG-51 Flight III / Large Surface Combatant',
    desc: 'Aegis Flight III surface combatants incorporating the AN/SPY-6(V)1 Air & Missile Defense Radar at Pascagoula.',
  },
  lpd_amphib: {
    name: 'San Antonio-Class Amphibious Transport Dock (LPD)',
    division: 'ingalls',
    shipClass: 'LPD-17 Flight II / Amphibious Warfare Ship',
    desc: 'Expeditionary warfare ship construction supporting USMC heavy lift, ship-to-shore connectors, and 31-amphib statutory floor.',
  },
  lha_amphib: {
    name: 'America-Class Amphibious Assault Ship (LHA)',
    division: 'ingalls',
    shipClass: 'LHA-6 / Big-Deck Amphibious Assault Ship',
    desc: 'Large-deck aviation-centric amphibious warships accommodating Marine Corps F-35B Lightning II and MV-22 Osprey.',
  },
  nsc_cutter: {
    name: 'Legend-Class National Security Cutter (NSC)',
    division: 'ingalls',
    shipClass: 'WMSL-750 / USCG Maritime Security Cutter',
    desc: 'Flagship multi-mission maritime cutters for the United States Coast Guard built at Ingalls.',
  },
  uuv_unmanned: {
    name: 'Unmanned Underwater & Maritime Systems (UUV)',
    division: 'mission_tech',
    shipClass: 'REMUS / Lionfish / Pharos UUVs',
    desc: 'Autonomous undersea vehicle production, seabed warfare systems, and naval autonomy integration.',
  },
  c5isr_tech: {
    name: 'C5ISR, Cyber & Defense IT Services',
    division: 'mission_tech',
    shipClass: 'C5ISR / Defense Technology Platform',
    desc: 'High-end defense electronic warfare, communications, tactical simulations, and enterprise cyber engineering.',
  },
  commercial_energy: {
    name: 'Commercial Energy & UPI Restructure',
    division: 'mission_tech',
    shipClass: 'Civilian Infrastructure / Energy',
    desc: 'Legacy UniversalPegasus oil & gas engineering and DOE nuclear environmental management facilities.',
  },
  corporate_macro: {
    name: 'Enterprise Industrial Base & Capital Macro',
    division: 'shared',
    shipClass: 'Corporate Policy & CapEx',
    desc: 'Federal shutdowns, full-year continuing resolutions, DOGE executive directives, skilled labor negotiations, and macro tariffs.',
  },
};

const PROGRAM_PATTERNS: Array<{ programId: ProgramId; patterns: RegExp[] }> = [
  { programId: 'cvn_ford', patterns: [/cvn[- ]?78/i, /cvn[- ]?79/i, /cvn[- ]?80/i, /cvn[- ]?81/i, /ford[- ]class/i, /kennedy/i, /enterprise/i, /doris miller/i, /advanced weapons elevator/i, /emals/i, /aag/i] },
  { programId: 'cvn_rcoh', patterns: [/rcoh/i, /refueling overhaul/i, /nimitz[- ]class/i, /cvn[- ]?72/i, /cvn[- ]?73/i, /cvn[- ]?74/i, /cvn[- ]?75/i, /george washington/i, /stennis/i, /truman/i, /abraham lincoln/i] },
  { programId: 'virginia_ssn', patterns: [/virginia[- ]class/i, /ssn[- ]?774/i, /ssn[- ]?79/i, /fast attack/i, /block iv/i, /block v/i, /block vi/i, /vpm/i, /new jersey/i, /massachusetts/i, /delaware/i] },
  { programId: 'columbia_ssbn', patterns: [/columbia[- ]class/i, /ssbn[- ]?826/i, /ballistic missile submarine/i, /strategic deterrent/i, /ssbn/i] },
  { programId: 'ddg_51', patterns: [/ddg[- ]?51/i, /arleigh burke/i, /destroyer/i, /flight iii/i, /john finn/i, /ted stevens/i, /spy[- ]6/i, /ralph johnson/i] },
  { programId: 'lpd_amphib', patterns: [/lpd[- ]?17/i, /lpd[- ]?2[0-9]/i, /lpd[- ]?3[0-9]/i, /san antonio/i, /amphibious transport/i, /somerset/i, /flight ii/i, /31[- ]amphib/i] },
  { programId: 'lha_amphib', patterns: [/lha[- ]?6/i, /lha[- ]?7/i, /lha[- ]?8/i, /lha[- ]?9/i, /lha[- ]?10/i, /america[- ]class/i, /tripoli/i, /bougainville/i, /fallujah/i, /amphibious assault/i] },
  { programId: 'nsc_cutter', patterns: [/national security cutter/i, /legend[- ]class/i, /nsc/i, /wmsl/i, /coast guard/i] },
  { programId: 'uuv_unmanned', patterns: [/uuv/i, /unmanned/i, /remus/i, /lionfish/i, /pharos/i, /autonomous/i, /undersea vehicle/i, /hydroid/i] },
  { programId: 'c5isr_tech', patterns: [/c5isr/i, /electronic warfare/i, /cyber/i, /alion/i, /advisory/i, /synthetic training/i, /mission technologies/i] },
  { programId: 'commercial_energy', patterns: [/universalpegasus/i, /oil & gas/i, /energy segment/i, /crude oil/i, /avondale/i] },
  { programId: 'corporate_macro', patterns: [/shutdown/i, /continuing resolution/i, /doge/i, /sequestration/i, /fiscal responsibility/i, /tariff/i, /covid/i, /spin[- ]off/i, /reconciliation/i] },
];

const DIVISION_PATTERNS: Array<{ division: DivisionId; patterns: RegExp[] }> = [
  { division: 'nns', patterns: [/newport news/i, /nns/i, /carrier/i, /submarine/i, /dry dock 12/i, /hampton roads/i, /cvn/i, /ssn/i, /ssbn/i] },
  { division: 'ingalls', patterns: [/ingalls/i, /pascagoula/i, /mississippi/i, /ddg/i, /destroyer/i, /lpd/i, /lha/i, /amphibious/i, /cutter/i, /nsc/i] },
  { division: 'mission_tech', patterns: [/mission technologies/i, /alion/i, /c5isr/i, /hydroid/i, /uuv/i, /unmanned/i, /remus/i, /lionfish/i, /cyber/i] },
];

/**
 * Deterministically infers an event's primary division and associated programs from its text and title.
 */
export function inferEventDivisionAndPrograms(event: {
  title: string;
  summary: string;
  id: string;
}): {
  division: DivisionId | 'corporate';
  programs: ProgramId[];
} {
  const corpus = `${event.title} ${event.summary}`;
  const matchedPrograms = new Set<ProgramId>();

  for (const entry of PROGRAM_PATTERNS) {
    for (const pat of entry.patterns) {
      if (pat.test(corpus)) {
        matchedPrograms.add(entry.programId);
        break;
      }
    }
  }

  const votes: Record<DivisionId, number> = { nns: 0, ingalls: 0, mission_tech: 0 };

  for (const entry of DIVISION_PATTERNS) {
    for (const pat of entry.patterns) {
      if (pat.test(corpus)) {
        votes[entry.division] += 2;
      }
    }
  }

  for (const p of matchedPrograms) {
    const meta = PROGRAM_META[p];
    if (meta.division !== 'shared') {
      votes[meta.division] += 1;
    }
  }

  let resolvedDiv: DivisionId | 'corporate' = 'corporate';
  let maxVotes = 0;
  for (const d of ALL_DIVISIONS) {
    if (votes[d] > maxVotes) {
      maxVotes = votes[d];
      resolvedDiv = d;
    }
  }

  const programs = [...matchedPrograms];
  if (programs.length === 0) {
    programs.push('corporate_macro');
  }

  return { division: resolvedDiv, programs };
}

export interface ProgramWaterfallItem {
  programId: ProgramId;
  name: string;
  division: DivisionId | 'shared';
  shipClass: string;
  netImpactBps: number;
  netImpactPoints: number; // e.g. -14.20 or +12.30 pts
  direction: -1 | 0 | 1;
  topEventTitle: string;
  eventCount: number;
  summary: string;
}

export interface DivisionScoreResult {
  divisionId: DivisionId;
  meta: typeof DIVISION_META[DivisionId];
  asOfDate: string;
  eventCount: number;
  latest: {
    compositeScoreCenti: number;
    compositeScore: number;
    deltaCenti: number;
    audiences: Record<AudienceId, { scoreCenti: number; score: number; deltaCenti: number }>;
  };
  timeline: PeriodRecord[];
  programWaterfall: ProgramWaterfallItem[];
}

/**
 * Computes deterministic sentiment scores and program attribution waterfall for an individual HII business division.
 */
export function computeDivisionScores(
  events: ImpactEvent[],
  divisionId: DivisionId,
  settings: DashboardSettings,
): DivisionScoreResult {
  // 1. Tag and filter events applicable to this division
  const taggedEvents = events.map((e) => {
    const inferred = inferEventDivisionAndPrograms(e);
    return {
      ...e,
      inferredDivision: inferred.division,
      inferredPrograms: inferred.programs,
    };
  });

  const relevantEvents = taggedEvents.filter((e) => {
    if (e.inferredDivision === divisionId) return true;
    if (e.inferredDivision === 'corporate') return true;
    return e.inferredPrograms.some((pid) => {
      const meta = PROGRAM_META[pid];
      return meta.division === divisionId || meta.division === 'shared';
    });
  });

  // 2. Score timeline deterministically for this division using the core engine
  const timeline = computeTimeline(relevantEvents, settings);
  const lastRecord = timeline[timeline.length - 1]!;

  const audiences = {} as Record<AudienceId, { scoreCenti: number; score: number; deltaCenti: number }>;
  for (const a of ALL_AUDIENCES) {
    const audScore = lastRecord.audiences[a];
    audiences[a] = {
      scoreCenti: audScore.scoreCenti,
      score: Number((audScore.scoreCenti / 100).toFixed(2)),
      deltaCenti: audScore.deltaCenti,
    };
  }

  // 3. Compute Program Impact Waterfall
  // Aggregates effective contributions in the latest period across all audiences
  const programMap = new Map<
    ProgramId,
    {
      netEffectiveBps: number;
      eventCount: number;
      topEventTitle: string;
      topAbsBps: number;
    }
  >();

  // Initialize all programs for this division so they appear in the waterfall
  for (const [pid, meta] of Object.entries(PROGRAM_META) as Array<[ProgramId, typeof PROGRAM_META[ProgramId]]>) {
    if (meta.division === divisionId || meta.division === 'shared') {
      programMap.set(pid, {
        netEffectiveBps: 0,
        eventCount: 0,
        topEventTitle: '',
        topAbsBps: -1,
      });
    }
  }

  // Iterate over latest period's contributions
  for (const a of ALL_AUDIENCES) {
    const audScore = lastRecord.audiences[a];
    const weight = settings.weights[a]; // 0..100
    for (const c of audScore.contributions) {
      const ev = taggedEvents.find((e) => e.id === c.eventId);
      if (!ev) continue;
      const programs = ev.inferredPrograms.filter((pid) => {
        const meta = PROGRAM_META[pid];
        return meta.division === divisionId || meta.division === 'shared';
      });
      if (programs.length === 0) continue;

      // Weighted impact from this contribution to composite
      const weightedBps = Math.round((c.effectiveBps * weight) / 100);
      const perProgBps = Math.round(weightedBps / programs.length);

      for (const pid of programs) {
        let entry = programMap.get(pid);
        if (!entry) {
          entry = { netEffectiveBps: 0, eventCount: 0, topEventTitle: '', topAbsBps: -1 };
          programMap.set(pid, entry);
        }
        entry.netEffectiveBps += perProgBps;
        entry.eventCount += 1;
        if (Math.abs(c.effectiveBps) > entry.topAbsBps) {
          entry.topAbsBps = Math.abs(c.effectiveBps);
          entry.topEventTitle = c.title;
        }
      }
    }
  }

  const programWaterfall: ProgramWaterfallItem[] = [];
  for (const [pid, data] of programMap.entries()) {
    const meta = PROGRAM_META[pid];
    // Convert basis points to display index points (10,000 bps = 1.00 index point delta)
    const netPoints = Number((data.netEffectiveBps / 10000).toFixed(2));
    let dir: -1 | 0 | 1 = 0;
    if (data.netEffectiveBps > 0) dir = 1;
    else if (data.netEffectiveBps < 0) dir = -1;

    programWaterfall.push({
      programId: pid,
      name: meta?.name ?? pid,
      division: meta?.division ?? 'shared',
      shipClass: meta?.shipClass ?? '',
      netImpactBps: data.netEffectiveBps,
      netImpactPoints: netPoints,
      direction: dir,
      topEventTitle: data.topEventTitle || 'General programmatic trend',
      eventCount: data.eventCount,
      summary: meta?.desc ?? '',
    });
  }

  // Sort descending by magnitude of net impact
  programWaterfall.sort((a, b) => Math.abs(b.netImpactBps) - Math.abs(a.netImpactBps) || (a.programId < b.programId ? -1 : 1));

  return {
    divisionId,
    meta: DIVISION_META[divisionId],
    asOfDate: settings.asOfDate,
    eventCount: relevantEvents.length,
    latest: {
      compositeScoreCenti: lastRecord.compositeCenti,
      compositeScore: Number((lastRecord.compositeCenti / 100).toFixed(2)),
      deltaCenti: lastRecord.compositeDeltaCenti,
      audiences,
    },
    timeline,
    programWaterfall,
  };
}
