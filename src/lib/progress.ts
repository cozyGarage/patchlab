import type {
  ConceptLevel,
  ConceptProgress,
  ProgressSave,
  Score,
} from '../types/schema';
import { missions } from '../missions';
import { GATE, missionGate, sandboxGate, starTotal } from './chapters';
import { TRANSFER_DEFS } from './transferVariants';

const KEY = 'patchlab.progress.v1';

const empty: ProgressSave = {
  version: 1,
  clearedMissionIds: [],
  stars: {},
  sandboxUnlocked: false,
  conceptProgress: {},
};

const knownMissionIds = new Set([
  ...missions.map((mission) => mission.id),
  ...TRANSFER_DEFS.map((def) => def.id),
]);

export type ImportProgressResult =
  | { ok: true; progress: ProgressSave }
  | { ok: false; reason: string };

function isScore(value: unknown): value is Score {
  if (!value || typeof value !== 'object') return false;
  const s = value as Record<string, unknown>;
  return (
    isStarAxis(s.correctness) &&
    isStarAxis(s.speed) &&
    isStarAxis(s.cleanliness)
  );
}

function isStarAxis(value: unknown): value is 0 | 1 | 2 | 3 {
  return value === 0 || value === 1 || value === 2 || value === 3;
}

function isConceptProgress(value: unknown): value is ConceptProgress {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  return (
    (item.level === 'introduced' ||
      item.level === 'practiced' ||
      item.level === 'independent') &&
    typeof item.successfulRuns === 'number' &&
    Number.isInteger(item.successfulRuns) &&
    item.successfulRuns >= 0 &&
    typeof item.lowestHintLevel === 'number' &&
    typeof item.lastPracticedAt === 'string'
  );
}

function sanitizeProgress(parsed: unknown): ImportProgressResult {
  if (!parsed || typeof parsed !== 'object') {
    return { ok: false, reason: 'Progress file is not a JSON object' };
  }
  const raw = parsed as Record<string, unknown>;
  if (raw.version !== 1) {
    return { ok: false, reason: 'Unsupported progress version' };
  }
  if (!Array.isArray(raw.clearedMissionIds)) {
    return { ok: false, reason: 'clearedMissionIds must be an array' };
  }

  const clearedMissionIds = raw.clearedMissionIds.filter(
    (id): id is string => typeof id === 'string' && knownMissionIds.has(id),
  );

  const stars: Record<string, Score> = {};
  if (raw.stars != null) {
    if (typeof raw.stars !== 'object' || Array.isArray(raw.stars)) {
      return { ok: false, reason: 'stars must be an object' };
    }
    for (const [missionId, score] of Object.entries(
      raw.stars as Record<string, unknown>,
    )) {
      if (!knownMissionIds.has(missionId)) continue;
      if (!isScore(score)) {
        return {
          ok: false,
          reason: `Invalid star score for ${missionId}`,
        };
      }
      stars[missionId] = score;
    }
  }

  const conceptProgress: Record<string, ConceptProgress> = {};
  if (raw.conceptProgress && typeof raw.conceptProgress === 'object') {
    for (const [concept, value] of Object.entries(
      raw.conceptProgress as Record<string, unknown>,
    )) {
      if (concept.trim() && isConceptProgress(value)) {
        conceptProgress[concept] = value;
      }
    }
  }

  return {
    ok: true,
    progress: {
      version: 1,
      clearedMissionIds,
      stars,
      sandboxUnlocked: !!raw.sandboxUnlocked,
      conceptProgress,
    },
  };
}

export function loadProgress(): ProgressSave {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...empty };
    const result = sanitizeProgress(JSON.parse(raw));
    return result.ok ? result.progress : { ...empty };
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

export function importProgress(raw: string): ImportProgressResult {
  try {
    const result = sanitizeProgress(JSON.parse(raw));
    if (!result.ok) return result;
    saveProgress(result.progress);
    return result;
  } catch {
    return { ok: false, reason: 'Invalid JSON' };
  }
}

export function resetProgress(): ProgressSave {
  const next = { ...empty, clearedMissionIds: [], stars: {} };
  saveProgress(next);
  return next;
}

const CONCEPT_LEVEL: Record<ConceptLevel, number> = {
  introduced: 1,
  practiced: 2,
  independent: 3,
};

export function recordMissionClear(
  missionId: string,
  score: Score,
  prev: ProgressSave = loadProgress(),
  hintLevel = 0,
): ProgressSave {
  const cleared = new Set(prev.clearedMissionIds);
  cleared.add(missionId);

  const existing = prev.stars[missionId];
  const stars = { ...prev.stars };
  if (!existing || starTotal(existing) < starTotal(score)) {
    stars[missionId] = score;
  }

  const conceptProgress = { ...(prev.conceptProgress ?? {}) };
  const transfer = TRANSFER_DEFS.find((item) => item.id === missionId);
  const mission =
    missions.find((candidate) => candidate.id === missionId) ??
    (transfer
      ? missions.find((item) => item.id === transfer.parentId)
      : undefined);
  if (mission) {
    const independent =
      (mission.learning.mode === 'challenge' ||
        mission.learning.mode === 'boss' ||
        !!transfer) &&
      hintLevel <= 2;
    const updates = [
      ...mission.learning.conceptsIntroduced.map(
        (concept) => [concept, 'introduced'] as const,
      ),
      ...mission.learning.conceptsPracticed.map(
        (concept) =>
          [concept, independent ? 'independent' : 'practiced'] as const,
      ),
    ];
    for (const [concept, level] of updates) {
      const previous = conceptProgress[concept];
      const bestLevel =
        previous && CONCEPT_LEVEL[previous.level] > CONCEPT_LEVEL[level]
          ? previous.level
          : level;
      conceptProgress[concept] = {
        level: bestLevel,
        successfulRuns: (previous?.successfulRuns ?? 0) + 1,
        lowestHintLevel: Math.min(previous?.lowestHintLevel ?? 4, hintLevel),
        lastPracticedAt: new Date().toISOString(),
      };
    }
  }

  const draft: ProgressSave = {
    version: 1,
    clearedMissionIds: [...cleared],
    stars,
    sandboxUnlocked: prev.sandboxUnlocked,
    conceptProgress,
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
