import type { Mission, ProgressSave } from '../types/schema';

export interface Chapter {
  id: string;
  index: number;
  title: string;
  blurb: string;
  /** Inclusive mission order range */
  from: number;
  to: number;
}

/** Campaign chapters — pass each stage to climb. */
export const CHAPTERS: Chapter[] = [
  {
    id: 'copper',
    index: 1,
    title: 'Copper Path',
    blurb: 'Patch Cat6, read link lights, fix wrong ports and VLANs.',
    from: 1,
    to: 5,
  },
  {
    id: 'media',
    index: 2,
    title: 'Fiber & Power',
    blurb: 'OM4 fiber, dual bring-up, and PDU power before data.',
    from: 6,
    to: 9,
  },
  {
    id: 'logic',
    index: 3,
    title: 'Address & ACL',
    blurb: 'Console, subnet ping, and your first firewall permit.',
    from: 10,
    to: 12,
  },
  {
    id: 'switching',
    index: 4,
    title: 'VLANs & Uplinks',
    blurb: 'Access VLANs, isolation, gateway, and trunk uplinks.',
    from: 13,
    to: 16,
  },
  {
    id: 'edge',
    index: 5,
    title: 'NAT & Policy',
    blurb: 'Publish a host with static NAT, then deny one offender.',
    from: 17,
    to: 18,
  },
  {
    id: 'routing',
    index: 6,
    title: 'Routing Lab',
    blurb: 'Fix addresses and masks, route between VLANs, add static routes.',
    from: 19,
    to: 22,
  },
];

export function chapterForOrder(order: number): Chapter | undefined {
  return CHAPTERS.find((c) => order >= c.from && order <= c.to);
}

export function chapterForMission(mission: Mission): Chapter | undefined {
  return chapterForOrder(mission.order);
}

/** Next mission the player should play (first unlocked uncleared), or null if done. */
export function currentStage(
  missions: Mission[],
  progress: ProgressSave,
): Mission | null {
  const sorted = [...missions].sort((a, b) => a.order - b.order);
  for (const m of sorted) {
    if (!progress.clearedMissionIds.includes(m.id)) return m;
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

export function chapterProgress(
  chapter: Chapter,
  missions: Mission[],
  progress: ProgressSave,
): { cleared: number; total: number; complete: boolean } {
  const inChapter = missions.filter(
    (m) => m.order >= chapter.from && m.order <= chapter.to,
  );
  const cleared = inChapter.filter((m) =>
    progress.clearedMissionIds.includes(m.id),
  ).length;
  return {
    cleared,
    total: inChapter.length,
    complete: cleared >= inChapter.length && inChapter.length > 0,
  };
}

export function isChapterUnlocked(
  chapter: Chapter,
  missions: Mission[],
  progress: ProgressSave,
): boolean {
  if (chapter.from <= 1) return true;
  const prev = missions.find((m) => m.order === chapter.from - 1);
  if (!prev) return true;
  return progress.clearedMissionIds.includes(prev.id);
}
