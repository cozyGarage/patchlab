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

/**
 * Compatibility constants for callers that display historical star targets.
 * Stars are optional achievement data and are not used to unlock content.
 */
export const GATE = {
  /** @deprecated Stars no longer control campaign progression. */
  minStarsToAdvance: 5,
  /** @deprecated Stars no longer control arc completion. */
  minStarsPerMissionForChapter: 4,
  /** Sandbox opens when campaign slot 3 is cleared. */
  sandboxAfterOrder: 3,
} as const;

/** The ten operational arcs defined by the campaign design. */
export const CHAPTERS: Chapter[] = [
  {
    id: 'first-shift',
    index: 1,
    title: 'First Shift: Copper Fundamentals',
    blurb: 'Bring copper online, correct a cross-connect, and plan a safe migration.',
    from: 1,
    to: 3,
  },
  {
    id: 'different-paths',
    index: 2,
    title: 'Different Paths: Fiber and Power',
    blurb: 'Build compatible fiber, power, and data paths.',
    from: 4,
    to: 6,
  },
  {
    id: 'dark-ports',
    index: 3,
    title: 'Dark Ports: Administrative Recovery',
    blurb: 'Diagnose and recover administratively disabled interfaces.',
    from: 7,
    to: 9,
  },
  {
    id: 'console-room',
    index: 4,
    title: 'Console Room: Addressing and Operations',
    blurb: 'Use console access, IPv4 addressing, power recovery, and ping evidence.',
    from: 10,
    to: 14,
  },
  {
    id: 'policy-desk',
    index: 5,
    title: 'The Policy Desk: ACL Foundations',
    blurb: 'Restore approved traffic and apply precise first-match policy.',
    from: 15,
    to: 16,
  },
  {
    id: 'tenant-floors',
    index: 6,
    title: 'Tenant Floors: VLANs',
    blurb: 'Assign access VLANs, prove isolation, and deploy multiple tenants.',
    from: 17,
    to: 20,
  },
  {
    id: 'beyond-the-rack',
    index: 7,
    title: 'Beyond the Rack: Gateways and Uplinks',
    blurb: 'Forward off-subnet traffic and carry VLANs across routed uplinks.',
    from: 21,
    to: 24,
  },
  {
    id: 'publishing-services',
    index: 8,
    title: 'Publishing Services: NAT',
    blurb: 'Publish inbound services and restore outbound translation.',
    from: 25,
    to: 26,
  },
  {
    id: 'route-craft',
    index: 9,
    title: 'Route Craft: Choosing Paths',
    blurb: 'Choose remote, longest-prefix, and backup paths.',
    from: 27,
    to: 29,
  },
  {
    id: 'incident-commander',
    index: 10,
    title: 'Incident Commander: Security Capstone',
    blurb: 'Diagnose and recover a layered branch security incident.',
    from: 30,
    to: 32,
  },
];

export function starTotal(score?: Score): number {
  if (!score) return 0;
  return score.correctness + score.speed + score.cleanliness;
}

/** @deprecated A mission clear now always meets the progression requirement. */
export function meetsStageGate(_score?: Score): boolean {
  return true;
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
  const complete = cleared >= inChapter.length && inChapter.length > 0;
  // Compatibility alias: the former star-gated status now follows completion.
  const gatedComplete = complete;
  return {
    cleared,
    total: inChapter.length,
    complete,
    stars,
    maxStars,
    gatedComplete,
  };
}

export type GateResult =
  | { unlocked: true; reason?: undefined }
  | { unlocked: false; reason: string };

/** A campaign mission unlocks as soon as the previous mission is cleared. */
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
      reason: `Complete Stage ${prev.order} to unlock this mission`,
    };
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
    // Show the next sequential mission as the current focus.
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
      reason: `Complete Stage ${GATE.sandboxAfterOrder} to unlock Sandbox`,
    };
  }
  return { unlocked: true };
}
