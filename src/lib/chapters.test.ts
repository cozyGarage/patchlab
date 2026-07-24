import { describe, expect, it } from 'vitest';
import { missions } from '../missions';
import {
  CHAPTERS,
  chapterForOrder,
  chapterProgress,
  currentStage,
  isChapterUnlocked,
  stageLabel,
} from './chapters';

describe('campaign chapters', () => {
  it('covers every mission order exactly once', () => {
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
    const progress = {
      version: 1 as const,
      clearedMissionIds: [],
      stars: {},
      sandboxUnlocked: false,
    };
    expect(currentStage(missions, progress)?.order).toBe(1);
    expect(stageLabel(missions, progress)).toMatchObject({
      current: 1,
      total: 22,
    });
    expect(isChapterUnlocked(CHAPTERS[0]!, missions, progress)).toBe(true);
    expect(isChapterUnlocked(CHAPTERS[1]!, missions, progress)).toBe(false);
  });

  it('advances stage and unlocks the next chapter after clears', () => {
    const copperIds = missions
      .filter((m) => m.order <= 5)
      .map((m) => m.id);
    const progress = {
      version: 1 as const,
      clearedMissionIds: copperIds,
      stars: {},
      sandboxUnlocked: true,
    };
    expect(currentStage(missions, progress)?.order).toBe(6);
    expect(chapterForOrder(6)?.title).toBe('Fiber & Power');
    expect(isChapterUnlocked(CHAPTERS[1]!, missions, progress)).toBe(true);
    expect(chapterProgress(CHAPTERS[0]!, missions, progress).complete).toBe(
      true,
    );
  });

  it('reports campaign complete when all stages cleared', () => {
    const progress = {
      version: 1 as const,
      clearedMissionIds: missions.map((m) => m.id),
      stars: {},
      sandboxUnlocked: true,
    };
    expect(currentStage(missions, progress)).toBeNull();
    expect(stageLabel(missions, progress).title).toBe('Campaign complete');
  });
});
