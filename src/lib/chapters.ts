import type { Mission, ProgressSave, Score } from '../types/schema';

export interface Chapter {
  id: string;
  index: number;
  title: string;
  blurb: string;
  /** Inclusive mission order range */
  from: number;
  to: number;
}

/** Harder campaign gates — clear alone is not enough. */
export const GATE = {
  /** Sum of correctness+speed+cleanliness (max 9) required on the previous stage. */
  minStarsToAdvance: 5,
  /** Per-mission star floor required across a chapter before the next chapter opens. */
  minStarsPerMissionForChapter: 4,
  /** Sandbox opens only after this stage is cleared AND star-gated. */
  sandboxAfterOrder: 5,
} as const;

/** More, tighter chapters — pass each to climb. */
export const CHAPTERS: Chapter[] = [
  {
    id: 'first-lights',
    index: 1,
    title: 'First Lights',
    blurb: 'Bring copper online and fix a wrong panel port.',
    from: 1,
    to: 2,
  },
  {
    id: 'faults',
    index: 2,
    title: 'Fault Finding',
    blurb: 'VLAN traps, admin-down ports, and clean change windows.',
    from: 3,
    to: 5,
  },
  {
    id: 'fiber',
    index: 3,
    title: 'Fiber Lab',
    blurb: 'OM4 first light and ripping out wrong media.',
    from: 6,
    to: 7,
  },
  {
    id: 'rack-ops',
    index: 4,
    title: 'Rack Ops',
    blurb: 'Dual servers and PDU power before the data path.',
    from: 8,
    to: 9,
  },
  {
    id: 'oob',
    index: 5,
    title: 'Out-of-Band',
    blurb: 'Console in and set a management address.',
    from: 10,
    to: 10,
  },
  {
    id: 'l3-basics',
    index: 6,
    title: 'L3 Basics',
    blurb: 'Same-subnet ping, then your first firewall permit.',
    from: 11,
    to: 12,
  },
  {
    id: 'access-vlans',
    index: 7,
    title: 'Access VLANs',
    blurb: 'Assign access VLANs and prove isolation.',
    from: 13,
    to: 14,
  },
  {
    id: 'uplinks',
    index: 8,
    title: 'Uplink Path',
    blurb: 'Default gateway off-subnet, then trunk the uplink.',
    from: 15,
    to: 16,
  },
  {
    id: 'edge',
    index: 9,
    title: 'Edge Security',
    blurb: 'Static NAT publish, then deny one host.',
    from: 17,
    to: 18,
  },
  {
    id: 'address-drills',
    index: 10,
    title: 'Address Drills',
    blurb: 'Broken host IPs and mask traps — no lazy prefixes.',
    from: 19,
    to: 20,
  },
  {
    id: 'route-craft',
    index: 11,
    title: 'Route Craft',
    blurb: 'Inter-VLAN routing and a static route to BRANCH.',
    from: 21,
    to: 22,
  },
  {
    id: 'ops-recovery',
    index: 12,
    title: 'Ops Recovery',
    blurb: 'No-shutdown a dark port, then fix a wrong gateway.',
    from: 23,
    to: 24,
  },
  {
    id: 'precision-path',
    index: 13,
    title: 'Precision Path',
    blurb: 'Host-route longest match, then deny one host to BRANCH.',
    from: 25,
    to: 26,
  },
  {
    id: 'hardening-recovery',
    index: 14,
    title: 'Hardening & Recovery',
    blurb: 'Host ACL exception, fiber no-shut, and spare PDU outlets.',
    from: 27,
    to: 29,
  },
];

export function starTotal(score?: Score): number {
  if (!score) return 0;
  return score.correctness + score.speed + score.cleanliness;
}

export function meetsStageGate(score?: Score): boolean {
  return starTotal(score) >= GATE.minStarsToAdvance;
}

export function chapterForOrder(order: number): Chapter | undefined {
  return CHAPTERS.find((c) => order >= c.from && order <= c.to);
}

export function chapterForMission(mission: Mission): Chapter | undefined {
  return chapterForOrder(mission.order);
}

export function chapterProgress(
  chapter: Chapter,
  missions: Mission[],
  progress: ProgressSave,
): {
  cleared: number;
  total: number;
  complete: boolean;
  stars: number;
  maxStars: number;
  gatedComplete: boolean;
} {
  const inChapter = missions.filter(
    (m) => m.order >= chapter.from && m.order <= chapter.to,
  );
  const cleared = inChapter.filter((m) =>
    progress.clearedMissionIds.includes(m.id),
  ).length;
  const stars = inChapter.reduce(
    (sum, m) => sum + starTotal(progress.stars[m.id]),
    0,
  );
  const maxStars = inChapter.length * 9;
  const gatedComplete =
    inChapter.length > 0 &&
    inChapter.every(
      (m) =>
        progress.clearedMissionIds.includes(m.id) &&
        starTotal(progress.stars[m.id]) >= GATE.minStarsPerMissionForChapter,
    );
  return {
    cleared,
    total: inChapter.length,
    complete: cleared >= inChapter.length && inChapter.length > 0,
    stars,
    maxStars,
    gatedComplete,
  };
}

export type GateResult =
  | { unlocked: true; reason?: undefined }
  | { unlocked: false; reason: string };

/** Hard gate: previous stage cleared + enough stars; chapter borders need chapter gate. */
export function missionGate(
  order: number,
  missions: Mission[],
  progress: ProgressSave,
): GateResult {
  if (order <= 1) return { unlocked: true };

  const prev = missions.find((m) => m.order === order - 1);
  if (!prev) return { unlocked: true };

  if (!progress.clearedMissionIds.includes(prev.id)) {
    return {
      unlocked: false,
      reason: `Clear Stage ${prev.order} first`,
    };
  }

  const prevStars = starTotal(progress.stars[prev.id]);
  if (prevStars < GATE.minStarsToAdvance) {
    return {
      unlocked: false,
      reason: `Earn ${GATE.minStarsToAdvance}★ on Stage ${prev.order} (you have ${prevStars}★) — retry for a cleaner run`,
    };
  }

  const chapter = chapterForOrder(order);
  const prevChapter = chapterForOrder(prev.order);
  if (chapter && prevChapter && chapter.id !== prevChapter.id) {
    const prog = chapterProgress(prevChapter, missions, progress);
    if (!prog.gatedComplete) {
      return {
        unlocked: false,
        reason: `Chapter ${prevChapter.index} gate: score ≥${GATE.minStarsPerMissionForChapter}★ on every stage in “${prevChapter.title}”`,
      };
    }
  }

  return { unlocked: true };
}

export function isChapterUnlocked(
  chapter: Chapter,
  missions: Mission[],
  progress: ProgressSave,
): boolean {
  return missionGate(chapter.from, missions, progress).unlocked;
}

/** Next mission the player should play (first unlocked uncleared), or null if done. */
export function currentStage(
  missions: Mission[],
  progress: ProgressSave,
): Mission | null {
  const sorted = [...missions].sort((a, b) => a.order - b.order);
  for (const m of sorted) {
    if (progress.clearedMissionIds.includes(m.id)) continue;
    if (missionGate(m.order, missions, progress).unlocked) return m;
    // Soft stuck: show the blocked stage as current focus
    return m;
  }
  return null;
}

export function stageLabel(
  missions: Mission[],
  progress: ProgressSave,
): { current: number; total: number; title: string; chapter?: Chapter } {
  const total = missions.length;
  const active = currentStage(missions, progress);
  if (!active) {
    return {
      current: total,
      total,
      title: 'Campaign complete',
      chapter: CHAPTERS[CHAPTERS.length - 1],
    };
  }
  return {
    current: active.order,
    total,
    title: active.title,
    chapter: chapterForMission(active),
  };
}

export function sandboxGate(
  missions: Mission[],
  progress: ProgressSave,
): GateResult {
  const req = missions.find((m) => m.order === GATE.sandboxAfterOrder);
  if (!req) return { unlocked: true };
  if (!progress.clearedMissionIds.includes(req.id)) {
    return {
      unlocked: false,
      reason: `Sandbox unlocks after Stage ${GATE.sandboxAfterOrder} with a solid score`,
    };
  }
  if (!meetsStageGate(progress.stars[req.id])) {
    return {
      unlocked: false,
      reason: `Sandbox needs ${GATE.minStarsToAdvance}★ on Stage ${GATE.sandboxAfterOrder}`,
    };
  }
  return { unlocked: true };
}
