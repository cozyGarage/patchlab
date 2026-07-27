import { describe, expect, it } from 'vitest';
import { scoreRun } from './scoring';
import type { EngineState } from './reducer';
import type { Mission, SimSnapshot } from '../types/schema';

function fakeMission(goals = 2): Mission {
  return {
    id: 'm-score',
    title: 'Score Test',
    order: 1,
    brief: 'Brief',
    constraints: [],
    parTimeSec: 60,
    hintAfterWrongAttempts: 2,
    inventory: {
      copper_cat6: 4,
      fiber_om4: 0,
      power_c13: 0,
      console_rj45: 0,
    },
    initial: { devices: [], cables: [] },
    goals: Array.from({ length: goals }, (_, i) => ({
      type: 'link_up' as const,
      a: { deviceId: 'a', portId: `p${i}` },
      b: { deviceId: 'b', portId: `q${i}` },
    })),
    learning: {
      mode: 'guided',
      difficulty: 1,
      conceptsIntroduced: [],
      conceptsPracticed: [],
      enabledTools: ['patch'],
      visibleObjectives: ['Link up'],
      ticketDetails: [],
      debrief: {
        outcome: 'Done',
        explanation: 'Because',
        question: 'Why?',
        answer: 'Evidence',
      },
      hints: {
        prompt: 'P',
        evidence: 'E',
        action: 'A',
        solution: 'S',
      },
    },
  };
}

function fakeState(
  overrides: {
    mission?: Mission;
    snapshot?: Partial<SimSnapshot>;
    wrongAttempts?: number;
    connectCount?: number;
    startedAtMs?: number;
  } = {},
): EngineState {
  const mission = overrides.mission ?? fakeMission();
  return {
    mission,
    baseRack: { devices: [], cables: [] },
    snapshot: {
      rack: { devices: [], cables: [] },
      linkTable: {},
      poweredDevices: {},
      consoleAttached: {},
      paths: [],
      inventory: {
        copper_cat6: 4,
        fiber_om4: 0,
        power_c13: 0,
        console_rj45: 0,
      },
      goalsMet: mission.goals.map(() => true),
      complete: true,
      glowingPortIds: [],
      ...overrides.snapshot,
    },
    wrongAttempts: overrides.wrongAttempts ?? 0,
    hintsUsed: 0,
    hintLevel: 0,
    connectCount: overrides.connectCount ?? 2,
    startedAtMs: overrides.startedAtMs ?? 1_000_000,
    loadRevision: 0,
  };
}

describe('scoreRun', () => {
  it('returns zeros when the mission is incomplete', () => {
    const state = fakeState({ snapshot: { complete: false } });
    expect(scoreRun(state, state.startedAtMs + 10_000)).toEqual({
      correctness: 0,
      speed: 0,
      cleanliness: 0,
    });
  });

  it('awards a perfect run under par with few connects', () => {
    const state = fakeState({ wrongAttempts: 0, connectCount: 2 });
    expect(scoreRun(state, state.startedAtMs + 30_000)).toEqual({
      correctness: 3,
      speed: 3,
      cleanliness: 3,
    });
  });

  it('scales correctness with wrong attempts', () => {
    expect(
      scoreRun(fakeState({ wrongAttempts: 3 }), 1_000_000 + 10_000).correctness,
    ).toBe(2);
    expect(
      scoreRun(fakeState({ wrongAttempts: 6 }), 1_000_000 + 10_000).correctness,
    ).toBe(1);
  });

  it('scales speed against par time', () => {
    const state = fakeState();
    expect(scoreRun(state, state.startedAtMs + 61_000).speed).toBe(2);
    expect(scoreRun(state, state.startedAtMs + 91_000).speed).toBe(1);
  });

  it('penalizes cleanliness for wasted copper and over-connecting', () => {
    const wasted = fakeState({
      connectCount: 5,
      snapshot: {
        complete: true,
        inventory: {
          copper_cat6: 0,
          fiber_om4: 0,
          power_c13: 0,
          console_rj45: 0,
        },
      },
    });
    expect(scoreRun(wasted, wasted.startedAtMs + 10_000).cleanliness).toBe(2);

    const overConnected = fakeState({
      mission: fakeMission(1),
      connectCount: 5,
    });
    expect(
      scoreRun(overConnected, overConnected.startedAtMs + 10_000).cleanliness,
    ).toBe(2);

    const both = fakeState({
      mission: fakeMission(1),
      connectCount: 5,
      snapshot: {
        complete: true,
        inventory: {
          copper_cat6: 0,
          fiber_om4: 0,
          power_c13: 0,
          console_rj45: 0,
        },
      },
    });
    expect(scoreRun(both, both.startedAtMs + 10_000).cleanliness).toBe(1);
  });
});
