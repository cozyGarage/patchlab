import type { ProgressSave, Score } from '../types/schema';
import { missions } from '../missions';
import { GATE, missionGate, sandboxGate, starTotal } from './chapters';

const KEY = 'patchlab.progress.v1';

const empty: ProgressSave = {
  version: 1,
  clearedMissionIds: [],
  stars: {},
  sandboxUnlocked: false,
};

export function loadProgress(): ProgressSave {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...empty };
    const parsed = JSON.parse(raw) as ProgressSave;
    if (parsed.version !== 1) return { ...empty };
    return parsed;
  } catch {
    return { ...empty };
  }
}

export function saveProgress(next: ProgressSave): void {
  localStorage.setItem(KEY, JSON.stringify(next));
}

export function exportProgress(progress: ProgressSave = loadProgress()): string {
  return JSON.stringify(progress, null, 2);
}

export function importProgress(raw: string): ProgressSave | null {
  try {
    const parsed = JSON.parse(raw) as ProgressSave;
    if (parsed.version !== 1 || !Array.isArray(parsed.clearedMissionIds)) {
      return null;
    }
    const next: ProgressSave = {
      version: 1,
      clearedMissionIds: parsed.clearedMissionIds,
      stars: parsed.stars ?? {},
      sandboxUnlocked: !!parsed.sandboxUnlocked,
    };
    saveProgress(next);
    return next;
  } catch {
    return null;
  }
}

export function resetProgress(): ProgressSave {
  const next = { ...empty, clearedMissionIds: [], stars: {} };
  saveProgress(next);
  return next;
}

export function recordMissionClear(
  missionId: string,
  score: Score,
  prev: ProgressSave = loadProgress(),
): ProgressSave {
  const cleared = new Set(prev.clearedMissionIds);
  cleared.add(missionId);

  const existing = prev.stars[missionId];
  const stars = { ...prev.stars };
  if (!existing || starTotal(existing) < starTotal(score)) {
    stars[missionId] = score;
  }

  const draft: ProgressSave = {
    version: 1,
    clearedMissionIds: [...cleared],
    stars,
    sandboxUnlocked: prev.sandboxUnlocked,
  };

  const sandbox = sandboxGate(missions, draft);
  const next: ProgressSave = {
    ...draft,
    sandboxUnlocked: prev.sandboxUnlocked || sandbox.unlocked,
  };
  saveProgress(next);
  return next;
}

export function totalStars(progress: ProgressSave): number {
  return Object.values(progress.stars).reduce(
    (sum, s) => sum + starTotal(s),
    0,
  );
}

export function isMissionUnlocked(
  order: number,
  progress: ProgressSave,
): boolean {
  return missionGate(order, missions, progress).unlocked;
}

export function missionUnlockReason(
  order: number,
  progress: ProgressSave,
): string | undefined {
  const gate = missionGate(order, missions, progress);
  return gate.unlocked ? undefined : gate.reason;
}

export function starGlyph(score?: Score): string {
  if (!score) return '···';
  const n = Math.round(starTotal(score) / 3);
  return '★'.repeat(Math.max(1, n)).padEnd(3, '☆');
}

export { GATE };
