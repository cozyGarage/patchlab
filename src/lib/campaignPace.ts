import type { Mission, MissionMode } from '../types/schema';

export type CampaignPace = 'easy' | 'standard';

export const PACE_LABEL: Record<CampaignPace, string> = {
  easy: 'Easy',
  standard: 'Standard',
};

export function normalizePace(value: unknown): CampaignPace {
  return value === 'standard' ? 'standard' : 'easy';
}

/** Easy keeps support visible; Standard follows each stage's authored mode. */
export function effectiveSupportMode(
  mission: Mission,
  pace: CampaignPace,
): MissionMode {
  if (pace === 'easy') {
    const mode = mission.learning?.mode ?? 'guided';
    if (mode === 'boss') return 'practice';
    if (mode === 'challenge') return 'practice';
    return mode === 'guided' ? 'guided' : 'practice';
  }
  return mission.learning?.mode ?? 'guided';
}

export function shouldOpenTicketDetails(
  mission: Mission,
  pace: CampaignPace,
): boolean {
  if (pace === 'easy') return true;
  return (mission.learning?.mode ?? 'guided') === 'guided';
}

export function shouldHideCampaignTimer(
  mission: Mission | null | undefined,
  pace: CampaignPace,
  sandbox: boolean,
): boolean {
  if (sandbox || !mission) return true;
  if (pace === 'easy') return true;
  const mode = mission.learning?.mode ?? 'guided';
  return mode === 'guided' || mode === 'practice';
}

export function shouldRevealDebriefAnswer(pace: CampaignPace): boolean {
  return pace === 'easy';
}

export function coachTipForMission(mission: Mission): string | undefined {
  const prompt = mission.learning?.hints?.prompt?.trim();
  if (!prompt) return undefined;
  return `Coach: ${prompt}`;
}

export function paceBlurb(pace: CampaignPace): string {
  return pace === 'easy'
    ? 'Easy pace — tickets stay open, coach tips appear up front, and timers stay off so you can learn.'
    : 'Standard pace — support fades as stages move from guided practice into challenge and boss tickets.';
}
