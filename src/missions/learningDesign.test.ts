import { describe, expect, it } from 'vitest';
import {
  CAMPAIGN_MISSION_IDS,
  LEARNING_DESIGN_BY_ID,
  isCampaignMissionId,
} from './learningDesign';
import { missions } from './index';

describe('learningDesign', () => {
  it('recognizes campaign mission ids', () => {
    expect(isCampaignMissionId('m1-first-lights')).toBe(true);
    expect(isCampaignMissionId('not-a-mission')).toBe(false);
  });

  it('keeps design entries in sync with the campaign id list', () => {
    expect(CAMPAIGN_MISSION_IDS).toHaveLength(
      Object.keys(LEARNING_DESIGN_BY_ID).length,
    );
    for (const id of CAMPAIGN_MISSION_IDS) {
      expect(LEARNING_DESIGN_BY_ID[id]).toBeTruthy();
    }
  });

  it('matches the shipped mission catalog order and learning payloads', () => {
    expect(missions.map((m) => m.id)).toEqual([...CAMPAIGN_MISSION_IDS]);
    for (const mission of missions) {
      const design = LEARNING_DESIGN_BY_ID[
        mission.id as keyof typeof LEARNING_DESIGN_BY_ID
      ];
      expect(design.visibleObjectives.length).toBeGreaterThan(0);
      expect(design.enabledTools.length).toBeGreaterThan(0);
      expect(design.debrief.outcome.length).toBeGreaterThan(0);
      expect(design.debrief.explanation.length).toBeGreaterThan(0);
      expect(design.debrief.question.length).toBeGreaterThan(0);
      expect(design.debrief.answer.length).toBeGreaterThan(0);
      expect(mission.learning.mode).toBe(design.mode);
      expect(mission.learning.difficulty).toBe(design.difficulty);
    }
  });
});
