import type { ProgressSave, Score } from '../types/schema';
import { SANDBOX_UNLOCK_AFTER_ORDER, missions } from '../missions';

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

export function recordMissionClear(
  missionId: string,
  score: Score,
  prev: ProgressSave = loadProgress(),
): ProgressSave {
  const cleared = new Set(prev.clearedMissionIds);
  cleared.add(missionId);
  const mission = missions.find((m) => m.id === missionId);
  const sandboxUnlocked =
    prev.sandboxUnlocked ||
    (!!mission && mission.order >= SANDBOX_UNLOCK_AFTER_ORDER) ||
    [...cleared].some((id) => {
      const m = missions.find((x) => x.id === id);
      return !!m && m.order >= SANDBOX_UNLOCK_AFTER_ORDER;
    });

  const existing = prev.stars[missionId];
  const stars = { ...prev.stars };
  if (
    !existing ||
    existing.correctness + existing.speed + existing.cleanliness <
      score.correctness + score.speed + score.cleanliness
  ) {
    stars[missionId] = score;
  }

  const next: ProgressSave = {
    version: 1,
    clearedMissionIds: [...cleared],
    stars,
    sandboxUnlocked,
  };
  saveProgress(next);
  return next;
}

export function totalStars(progress: ProgressSave): number {
  return Object.values(progress.stars).reduce(
    (sum, s) => sum + s.correctness + s.speed + s.cleanliness,
    0,
  );
}

export function isMissionUnlocked(
  order: number,
  progress: ProgressSave,
): boolean {
  if (order <= 1) return true;
  const prev = missions.find((m) => m.order === order - 1);
  if (!prev) return true;
  return progress.clearedMissionIds.includes(prev.id);
}

export function starGlyph(score?: Score): string {
  if (!score) return '···';
  const n = Math.round(
    (score.correctness + score.speed + score.cleanliness) / 3,
  );
  return '★'.repeat(Math.max(1, n)).padEnd(3, '☆');
}
