import { describe, expect, it } from 'vitest';
import { missions } from '../missions';
import {
  CHAPTERS,
  GATE,
  chapterForOrder,
  chapterProgress,
  currentStage,
  isChapterUnlocked,
  missionGate,
  sandboxGate,
  stageLabel,
} from './chapters';

function progressWith(clearedOrders: number[], starsPer: number = 5) {
  const clearedMissionIds = missions
    .filter((m) => clearedOrders.includes(m.order))
    .map((m) => m.id);
  const stars = Object.fromEntries(
    clearedMissionIds.map((id) => [
      id,
      {
        correctness: Math.min(3, starsPer) as 0 | 1 | 2 | 3,
        speed: Math.min(3, Math.max(0, starsPer - 3)) as 0 | 1 | 2 | 3,
        cleanliness: Math.min(3, Math.max(0, starsPer - 6)) as 0 | 1 | 2 | 3,
      },
    ]),
  );
  // Normalize to exact star total when possible (5 → 2+2+1, 4 → 2+1+1, 9 → 3+3+3)
  for (const id of clearedMissionIds) {
    if (starsPer >= 9) {
      stars[id] = { correctness: 3, speed: 3, cleanliness: 3 };
    } else if (starsPer === 5) {
      stars[id] = { correctness: 2, speed: 2, cleanliness: 1 };
    } else if (starsPer === 4) {
      stars[id] = { correctness: 2, speed: 1, cleanliness: 1 };
    } else if (starsPer === 3) {
      stars[id] = { correctness: 1, speed: 1, cleanliness: 1 };
    }
  }
  return {
    version: 1 as const,
    clearedMissionIds,
    stars,
    sandboxUnlocked: false,
  };
}

describe('campaign chapters', () => {
  it('covers every mission order exactly once across more chapters', () => {
    expect(CHAPTERS.length).toBeGreaterThanOrEqual(10);
    const covered = new Set<number>();
    for (const ch of CHAPTERS) {
      for (let o = ch.from; o <= ch.to; o++) {
        expect(covered.has(o)).toBe(false);
        covered.add(o);
      }
    }
    expect([...covered].sort((a, b) => a - b)).toEqual(
      missions.map((m) => m.order),
    );
  });

  it('starts at stage 1 with empty progress', () => {
    const progress = progressWith([]);
    expect(currentStage(missions, progress)?.order).toBe(1);
    expect(stageLabel(missions, progress)).toMatchObject({
      current: 1,
      total: 22,
    });
    expect(isChapterUnlocked(CHAPTERS[0]!, missions, progress)).toBe(true);
    expect(isChapterUnlocked(CHAPTERS[1]!, missions, progress)).toBe(false);
  });

  it('blocks advance when previous stage stars are below the gate', () => {
    const weak = progressWith([1], 3);
    const gate = missionGate(2, missions, weak);
    expect(gate.unlocked).toBe(false);
    if (!gate.unlocked) expect(gate.reason).toMatch(/5★/);
  });

  it('allows advance when previous stage meets the star gate', () => {
    const ok = progressWith([1], 5);
    expect(missionGate(2, missions, ok).unlocked).toBe(true);
  });

  it('requires chapter star floor before opening the next chapter', () => {
    // Clear ch1 (1-2) with only 3★ each — stage gate from 2→3 fails first
    const weakChapter = progressWith([1, 2], 3);
    expect(missionGate(3, missions, weakChapter).unlocked).toBe(false);

    // Clear with 5★ (meets stage gate) but chapter exit needs 4★ each — 5>=4 so opens
    const okChapter = progressWith([1, 2], 5);
    expect(chapterProgress(CHAPTERS[0]!, missions, okChapter).gatedComplete).toBe(
      true,
    );
    expect(missionGate(3, missions, okChapter).unlocked).toBe(true);
    expect(chapterForOrder(3)?.title).toBe('Fault Finding');
  });

  it('sandbox stays locked until stage 5 clears the star gate', () => {
    const early = progressWith([1, 2, 3], 9);
    expect(sandboxGate(missions, early).unlocked).toBe(false);

    const ready = progressWith([1, 2, 3, 4, 5], 9);
    expect(sandboxGate(missions, ready).unlocked).toBe(true);
  });
});
