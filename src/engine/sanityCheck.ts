export interface SanityCheckItem {
  id: string;
  createdAt: string;
  periodOrRange: string;
  aspect: string;
  directive: string;
  audience: 'all' | 'executive' | 'congress' | 'navy' | 'public';
  status: 'queued' | 'researching' | 'verified';
  verifiedAt?: string;
  findingsSummary?: string;
  priority: 'high' | 'normal';
}

function generateSanityCheckId(): string {
  const timestamp = Date.now();
  const randomHex = Math.floor(Math.random() * 0xffffff)
    .toString(16)
    .padStart(6, '0');
  return `sc_${timestamp}_${randomHex}`;
}

export const SEEDED_SANITY_CHECKS: SanityCheckItem[] = [
  {
    id: 'sc_1740000000000_a1f9c2',
    createdAt: '2025-01-15T08:00:00.000Z',
    periodOrRange: '2024–2025',
    aspect: 'American Public Sentiment vs. +85.5% Stock Rebound',
    directive: 'Investigate why 2024 earnings collapse was followed by massive 2025 equity surge and verify if labor retention and Golden Fleet initiatives provide durable support',
    audience: 'public',
    status: 'verified',
    verifiedAt: '2025-02-10T14:30:00.000Z',
    findingsSummary: 'Reconciled via 7 verified ledger events including Trump BBGN announcement, $3.4B Submarine Industrial Base infusion, and $460 ATH.',
    priority: 'high'
  },
  {
    id: 'sc_1740086400000_b2e8d4',
    createdAt: '2025-02-01T10:15:00.000Z',
    periodOrRange: '2025–2027',
    aspect: 'Trump-Class BBGN Nuclear Battleship Drydock Capacity',
    directive: 'Verify whether Newport News Dry Dock 12 carrier scheduling permits parallel construction of 34,000-ton nuclear battleships without delaying Ford-class CVN-80/81 deliveries',
    audience: 'navy',
    status: 'queued',
    priority: 'high'
  },
  {
    id: 'sc_1740172800000_c3d7e6',
    createdAt: '2025-02-15T16:45:00.000Z',
    periodOrRange: '2026-Q4',
    aspect: 'Fixed-Price vs. Cost-Plus-Incentive Policy Shift',
    directive: 'Confirm Pentagon Undersecretary acquisition memo transition to CPIF contracts across new naval surface combatants to insulate operating margins',
    audience: 'congress',
    status: 'queued',
    priority: 'normal'
  }
];

export function createSanityCheckItem(
  input: Omit<SanityCheckItem, 'id' | 'createdAt' | 'status'>
): SanityCheckItem {
  return {
    ...input,
    id: generateSanityCheckId(),
    createdAt: new Date().toISOString(),
    status: 'queued'
  };
}

export function formatSanityChecksForAgentPrompt(items: SanityCheckItem[]): string {
  if (items.length === 0) {
    return 'NO ACTIVE SANITY CHECKS OR RECONCILIATION DIRECTIVES FOUND.';
  }

  const header = '### DEFENSE RECONCILIATION & SANITY CHECK DIRECTIVES (HII INTELLIGENCE ENGINE)';
  
  const formattedItems = items.map((item, index) => {
    const lines = [
      `[DIRECTIVE #${index + 1}] ID: ${item.id}`,
      `STATUS: ${item.status.toUpperCase()} | PRIORITY: ${item.priority.toUpperCase()} | AUDIENCE: ${item.audience.toUpperCase()}`,
      `TEMPORAL RANGE: ${item.periodOrRange}`,
      `ASPECT: ${item.aspect}`,
      `DIRECTIVE: ${item.directive}`
    ];

    if (item.status === 'verified') {
      lines.push(`VERIFIED AT: ${item.verifiedAt ?? 'N/A'}`);
      lines.push(`FINDINGS: ${item.findingsSummary ?? 'None documented'}`);
    }

    return lines.join('\n');
  });

  return `${header}\n\n${formattedItems.join('\n\n---\n\n')}`;
}

export function markSanityCheckVerified(
  items: SanityCheckItem[],
  id: string,
  findings: string
): SanityCheckItem[] {
  const timestamp = new Date().toISOString();
  return items.map((item) => {
    if (item.id === id) {
      return {
        ...item,
        status: 'verified',
        verifiedAt: timestamp,
        findingsSummary: findings
      };
    }
    return item;
  });
}