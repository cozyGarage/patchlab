import { describe, expect, it } from 'vitest';
import { missions } from '../missions';
import type { ProgressSave, Score } from '../types/schema';
import {
  CHAPTERS,
  GATE,
  chapterForOrder,
  chapterProgress,
  currentStage,
  isChapterUnlocked,
  meetsStageGate,
  missionGate,
  sandboxGate,
  stageLabel,
} from './chapters';

function progressWith(
  clearedOrders: number[],
  score?: Score,
): ProgressSave {
  const clearedMissionIds = missions
    .filter((m) => clearedOrders.includes(m.order))
    .map((m) => m.id);
  const stars = score
    ? Object.fromEntries(clearedMissionIds.map((id) => [id, score]))
    : {};
  return {
    version: 1,
    clearedMissionIds,
    stars,
    sandboxUnlocked: false,
  };
}

const zeroStars: Score = {
  correctness: 0,
  speed: 0,
  cleanliness: 0,
};

describe('campaign arcs', () => {
  it('uses the ten designed arc ranges and titles', () => {
    expect(
      CHAPTERS.map(({ from, to, title }) => ({ from, to, title })),
    ).toEqual([
      { from: 1, to: 3, title: 'First Shift: Copper Fundamentals' },
      { from: 4, to: 6, title: 'Different Paths: Fiber and Power' },
      { from: 7, to: 9, title: 'Dark Ports: Administrative Recovery' },
      {
        from: 10,
        to: 14,
        title: 'Console Room: Addressing and Operations',
      },
      { from: 15, to: 16, title: 'The Policy Desk: ACL Foundations' },
      { from: 17, to: 20, title: 'Tenant Floors: VLANs' },
      {
        from: 21,
        to: 24,
        title: 'Beyond the Rack: Gateways and Uplinks',
      },
      { from: 25, to: 26, title: 'Publishing Services: NAT' },
      { from: 27, to: 29, title: 'Route Craft: Choosing Paths' },
      {
        from: 30,
        to: 32,
        title: 'Incident Commander: Security Capstone',
      },
    ]);
  });

  it('covers every mission order exactly once', () => {
    const covered = new Set<number>();
    for (const arc of CHAPTERS) {
      for (let order = arc.from; order <= arc.to; order++) {
        expect(covered.has(order)).toBe(false);
        covered.add(order);
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
      total: 32,
    });
    expect(isChapterUnlocked(CHAPTERS[0]!, missions, progress)).toBe(true);
    expect(isChapterUnlocked(CHAPTERS[1]!, missions, progress)).toBe(false);
  });

  it('requires only the previous mission clear to advance', () => {
    const blocked = missionGate(2, missions, progressWith([]));
    expect(blocked).toEqual({
      unlocked: false,
      reason: 'Complete Stage 1 to unlock this mission',
    });

    const clearedWithoutScore = progressWith([1]);
    expect(missionGate(2, missions, clearedWithoutScore).unlocked).toBe(true);

    const clearedWithZeroStars = progressWith([1], zeroStars);
    expect(meetsStageGate(zeroStars)).toBe(true);
    expect(missionGate(2, missions, clearedWithZeroStars).unlocked).toBe(true);
  });

  it('opens the next arc and marks completion based on clears', () => {
    const progress = progressWith([1, 2, 3], zeroStars);
    const firstArc = chapterProgress(CHAPTERS[0]!, missions, progress);

    expect(firstArc).toMatchObject({
      cleared: 3,
      total: 3,
      complete: true,
      gatedComplete: true,
      stars: 0,
    });
    expect(missionGate(4, missions, progress).unlocked).toBe(true);
    expect(chapterForOrder(4)?.title).toBe(
      'Different Paths: Fiber and Power',
    );
  });

  it('unlocks Sandbox after campaign slot 3 is cleared regardless of stars', () => {
    expect(GATE.sandboxAfterOrder).toBe(3);
    expect(sandboxGate(missions, progressWith([1, 2], zeroStars))).toEqual({
      unlocked: false,
      reason: 'Complete Stage 3 to unlock Sandbox',
    });
    expect(
      sandboxGate(missions, progressWith([1, 2, 3], zeroStars)).unlocked,
    ).toBe(true);
  });
});
