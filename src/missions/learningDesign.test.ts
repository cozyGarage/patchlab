import { describe, expect, it } from 'vitest';
import type { Goal } from '../types/schema';
import {
  CAMPAIGN_MISSION_IDS,
  LEARNING_DESIGN_BY_ID,
  isCampaignMissionId,
  type CampaignMissionId,
} from './learningDesign';
import { missions } from './index';

/** Goal literals that must not appear in challenge/boss briefs or constraints. */
function goalSpoilers(goals: Goal[]): string[] {
  const spoilers = new Set<string>();
  for (const goal of goals) {
    switch (goal.type) {
      case 'link_up':
      case 'path_up':
      case 'port_in_path':
      case 'cable_color_between':
      case 'cable_media_between':
      case 'console_link':
        if ('a' in goal) spoilers.add(goal.a.portId);
        if ('b' in goal) spoilers.add(goal.b.portId);
        if ('port' in goal) spoilers.add(goal.port.portId);
        if ('from' in goal) spoilers.add(goal.from.portId);
        if ('to' in goal) spoilers.add(goal.to.portId);
        break;
      case 'no_cables_on':
        for (const port of goal.ports) spoilers.add(port.portId);
        break;
      case 'iface_ip':
        spoilers.add(goal.port.portId);
        spoilers.add(goal.address);
        spoilers.add(`${goal.address}/${goal.prefix}`);
        if (goal.gateway) spoilers.add(goal.gateway);
        break;
      case 'firewall_rule':
        spoilers.add(goal.action);
        spoilers.add(goal.srcCidr);
        spoilers.add(goal.dstCidr);
        break;
      case 'port_vlan':
      case 'port_mode':
      case 'trunk_vlans':
        spoilers.add(goal.port.portId);
        break;
      case 'nat_static':
        spoilers.add(goal.insideIp);
        spoilers.add(goal.outsideIp);
        break;
      case 'nat_pat':
        spoilers.add(goal.insideCidr);
        spoilers.add(goal.outsideIp);
        break;
      case 'route_entry':
        spoilers.add(goal.destCidr);
        spoilers.add(goal.nextHop);
        break;
      default:
        break;
    }
  }
  return [...spoilers].filter((value) => value.length > 0);
}

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

  it('introduces at most one concept per stage', () => {
    for (const id of CAMPAIGN_MISSION_IDS) {
      const design = LEARNING_DESIGN_BY_ID[id];
      expect(
        design.conceptsIntroduced.length,
        `${id} introduces too many concepts`,
      ).toBeLessThanOrEqual(1);
    }
  });

  it('keeps challenge count at a diagnosis-friendly floor', () => {
    const challenges = CAMPAIGN_MISSION_IDS.filter(
      (id) => LEARNING_DESIGN_BY_ID[id].mode === 'challenge',
    );
    expect(challenges.length).toBeGreaterThanOrEqual(6);
  });

  it('revisits every introduced concept later (except campaign finale)', () => {
    const finalId = CAMPAIGN_MISSION_IDS[CAMPAIGN_MISSION_IDS.length - 1]!;
    const introducedAt = new Map<string, CampaignMissionId>();

    for (const id of CAMPAIGN_MISSION_IDS) {
      for (const concept of LEARNING_DESIGN_BY_ID[id].conceptsIntroduced) {
        if (!introducedAt.has(concept)) introducedAt.set(concept, id);
      }
    }

    for (const [concept, introId] of introducedAt) {
      if (introId === finalId) continue;
      const introIndex = CAMPAIGN_MISSION_IDS.indexOf(introId);
      const practicedLater = CAMPAIGN_MISSION_IDS.slice(introIndex + 1).some(
        (id) =>
          (LEARNING_DESIGN_BY_ID[id].conceptsPracticed as readonly string[]).includes(
            concept,
          ),
      );
      expect(
        practicedLater,
        `"${concept}" introduced on ${introId} never appears in later conceptsPracticed`,
      ).toBe(true);
    }
  });

  it('keeps challenge/boss briefs free of goal literals', () => {
    for (const mission of missions) {
      if (
        mission.learning.mode !== 'challenge' &&
        mission.learning.mode !== 'boss'
      ) {
        continue;
      }
      const surface = [mission.brief, ...(mission.constraints ?? [])].join('\n');
      for (const literal of goalSpoilers(mission.goals)) {
        expect(
          surface.includes(literal),
          `${mission.id} ${mission.learning.mode} surface spoils goal literal "${literal}"`,
        ).toBe(false);
      }
    }
  });
});
