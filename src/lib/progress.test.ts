import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  exportProgress,
  importProgress,
  isMissionUnlocked,
  loadProgress,
  missionUnlockReason,
  recordMissionClear,
  resetProgress,
} from './progress';

const KEY = 'patchlab.progress.v1';

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
});

describe('completion-based progression', () => {
  const zeroStars = {
    correctness: 0 as const,
    speed: 0 as const,
    cleanliness: 0 as const,
  };

  it('unlocks the next mission after a clear regardless of stars', () => {
    const progress = recordMissionClear('m1-first-lights', zeroStars);

    expect(isMissionUnlocked(2, progress)).toBe(true);
    expect(missionUnlockReason(2, progress)).toBeUndefined();
    expect(progress.stars['m1-first-lights']).toEqual(zeroStars);
  });

  it('unlocks Sandbox when campaign slot 3 is cleared regardless of stars', () => {
    let progress = recordMissionClear('m1-first-lights', zeroStars);
    progress = recordMissionClear('m2-wrong-port', zeroStars, progress);
    progress = recordMissionClear('m5-change-window', zeroStars, progress);

    expect(progress.sandboxUnlocked).toBe(true);
  });

  it('tracks concept independence separately from completion and stars', () => {
    const progress = recordMissionClear(
      'm5-change-window',
      zeroStars,
      undefined,
      0,
    );

    expect(
      progress.conceptProgress?.['Physical endpoints and link-state evidence']
        ?.level,
    ).toBe('independent');
    expect(
      progress.conceptProgress?.['Safe cross-connect migration']?.level,
    ).toBe('introduced');
  });
});

describe('progress import/export', () => {
  it('round-trips a valid save', () => {
    const seeded = recordMissionClear('m1-first-lights', {
      correctness: 3,
      speed: 2,
      cleanliness: 2,
    });
    const raw = exportProgress(seeded);
    resetProgress();
    expect(loadProgress().clearedMissionIds).toEqual([]);

    const result = importProgress(raw);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.progress.clearedMissionIds).toContain('m1-first-lights');
    expect(result.progress.stars['m1-first-lights']?.correctness).toBe(3);
    expect(loadProgress().clearedMissionIds).toContain('m1-first-lights');
  });

  it('rejects invalid JSON', () => {
    const result = importProgress('{not-json');
    expect(result).toEqual({ ok: false, reason: 'Invalid JSON' });
  });

  it('rejects unsupported version', () => {
    const result = importProgress(
      JSON.stringify({
        version: 99,
        clearedMissionIds: [],
        stars: {},
        sandboxUnlocked: false,
      }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toMatch(/version/i);
  });

  it('rejects malformed star scores', () => {
    const result = importProgress(
      JSON.stringify({
        version: 1,
        clearedMissionIds: ['m1-first-lights'],
        stars: {
          'm1-first-lights': { correctness: 9, speed: 1, cleanliness: 1 },
        },
        sandboxUnlocked: false,
      }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toMatch(/star score/i);
  });

  it('drops unknown mission ids but keeps known ones', () => {
    const result = importProgress(
      JSON.stringify({
        version: 1,
        clearedMissionIds: ['m1-first-lights', 'not-a-real-mission'],
        stars: {
          'm1-first-lights': { correctness: 2, speed: 2, cleanliness: 1 },
          'ghost-mission': { correctness: 3, speed: 3, cleanliness: 3 },
        },
        sandboxUnlocked: true,
      }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.progress.clearedMissionIds).toEqual(['m1-first-lights']);
    expect(result.progress.stars['m1-first-lights']).toBeTruthy();
    expect(result.progress.stars['ghost-mission']).toBeUndefined();
    expect(result.progress.sandboxUnlocked).toBe(true);
  });

  it('loads empty progress when storage is corrupt', () => {
    localStorage.setItem(KEY, '{broken');
    expect(loadProgress()).toEqual({
      version: 1,
      clearedMissionIds: [],
      stars: {},
      sandboxUnlocked: false,
      conceptProgress: {},
    });
  });
});
