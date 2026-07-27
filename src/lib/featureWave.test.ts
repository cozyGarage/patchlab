import { describe, expect, it, beforeEach } from 'vitest';
import {
  applyClassroomCode,
  classroomHandout,
  loadClassroom,
  CLASSROOM_CODES,
} from './classroom';
import { loadProgress, resetProgress } from './progress';
import {
  decodeSandboxShare,
  encodeSandboxShare,
  type SandboxSnapshot,
} from './sandboxLab';
import { clearAnalytics, readAnalytics, track } from './analytics';

describe('classroom', () => {
  beforeEach(() => {
    resetProgress();
    localStorage.clear();
  });

  it('unlocks sandbox and all stages with codes', () => {
    const sandbox = applyClassroomCode(
      CLASSROOM_CODES.unlockSandbox,
      loadProgress(),
    );
    expect(sandbox.ok).toBe(true);
    if (sandbox.ok) expect(sandbox.progress?.sandboxUnlocked).toBe(true);

    const all = applyClassroomCode(CLASSROOM_CODES.unlockAll, loadProgress());
    expect(all.ok).toBe(true);
    if (all.ok) {
      expect(all.progress?.clearedMissionIds.length).toBeGreaterThan(10);
      expect(loadClassroom().unlocked).toBe(true);
    }
    expect(classroomHandout()).toContain('PATCHLAB-LAB');
  });
});

describe('sandbox share encoding', () => {
  it('round-trips a snapshot', () => {
    const snap: SandboxSnapshot = {
      version: 1,
      savedAt: new Date().toISOString(),
      label: 'Share test',
      rack: { devices: [], cables: [] },
      inventory: {
        copper_cat6: 2,
        fiber_om4: 1,
        power_c13: 0,
        console_rj45: 0,
      },
    };
    const encoded = encodeSandboxShare(snap);
    const decoded = decodeSandboxShare(encoded);
    expect(decoded?.inventory.copper_cat6).toBe(2);
    expect(decoded?.label).toBe('Share test');
  });
});

describe('analytics', () => {
  beforeEach(() => clearAnalytics());

  it('stores events locally', () => {
    track('app_open');
    track('mission_start', { missionId: 'm1-first-lights' });
    const entries = readAnalytics();
    expect(entries).toHaveLength(2);
    expect(entries[1]?.event).toBe('mission_start');
  });
});
