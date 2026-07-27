import { describe, expect, it } from 'vitest';
import {
  coachTipForMission,
  effectiveSupportMode,
  normalizePace,
  shouldHideCampaignTimer,
  shouldOpenTicketDetails,
  shouldRevealDebriefAnswer,
} from './campaignPace';
import type { Mission } from '../types/schema';

function fakeMission(mode: Mission['learning']['mode']): Mission {
  return {
    id: 'm-test',
    title: 'Test',
    order: 1,
    brief: 'Brief',
    constraints: [],
    parTimeSec: 60,
    hintAfterWrongAttempts: 2,
    inventory: {
      copper_cat6: 1,
      fiber_om4: 0,
      power_c13: 0,
      console_rj45: 0,
    },
    initial: { devices: [], cables: [] },
    goals: [],
    learning: {
      mode,
      difficulty: 2,
      conceptsIntroduced: [],
      conceptsPracticed: [],
      enabledTools: ['patch'],
      visibleObjectives: ['Do the thing'],
      ticketDetails: ['Use port A'],
      debrief: {
        outcome: 'Done',
        explanation: 'Because',
        question: 'Why?',
        answer: 'Evidence',
      },
      hints: {
        prompt: 'Start at the panel label.',
        evidence: 'A-01 is documented.',
        action: 'Patch A-01.',
        solution: 'Connect A-01 to Gi1/0/1.',
      },
    },
  };
}

describe('campaignPace', () => {
  it('defaults unknown values to easy', () => {
    expect(normalizePace(undefined)).toBe('easy');
    expect(normalizePace('standard')).toBe('standard');
  });

  it('opens ticket details on easy even for challenge stages', () => {
    const mission = fakeMission('challenge');
    expect(shouldOpenTicketDetails(mission, 'easy')).toBe(true);
    expect(shouldOpenTicketDetails(mission, 'standard')).toBe(false);
  });

  it('softens challenge/boss support on easy', () => {
    expect(effectiveSupportMode(fakeMission('challenge'), 'easy')).toBe(
      'practice',
    );
    expect(effectiveSupportMode(fakeMission('boss'), 'easy')).toBe('practice');
    expect(effectiveSupportMode(fakeMission('boss'), 'standard')).toBe('boss');
  });

  it('hides campaign timers on easy', () => {
    expect(shouldHideCampaignTimer(fakeMission('boss'), 'easy', false)).toBe(
      true,
    );
    expect(
      shouldHideCampaignTimer(fakeMission('boss'), 'standard', false),
    ).toBe(false);
  });

  it('reveals debrief answers on easy and builds coach tips', () => {
    expect(shouldRevealDebriefAnswer('easy')).toBe(true);
    expect(shouldRevealDebriefAnswer('standard')).toBe(false);
    expect(coachTipForMission(fakeMission('guided'))).toMatch(/^Coach:/);
  });
});
