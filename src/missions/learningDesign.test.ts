import { describe, expect, it } from 'vitest';
import type { Goal } from '../types/schema';
import {
  CAMPAIGN_MISSION_IDS,
  LEARNING_DESIGN_BY_ID,
  isCampaignMissionId,
  type CampaignMissionId,
} from './learningDesign';
import { missions } from './index';

/** Goal literals that must not appear in challenge/boss player-facing surfaces. */
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

/** Human-facing port / address recipes that must not leak into Standard-visible copy. */
const HUMAN_RECIPE_PATTERNS: RegExp[] = [
  /\b(?:Gi|Te)\d\/\d\/\d+\b/i,
  /\bA-\d{2}\b/,
  /\bF-\d{2}\b/,
  /\bOUT\d+\b/i,
  /\b\d{1,3}(?:\.\d{1,3}){3}(?:\/\d{1,2})?\b/,
];

function playerFacingSurface(mission: (typeof missions)[number]): string {
  const design = mission.learning;
  return [
    mission.brief,
    ...(mission.constraints ?? []),
    design.impact ?? '',
    ...design.visibleObjectives,
  ].join('\n');
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

  it('requires spoiler-free impact copy on challenge/boss stages', () => {
    for (const mission of missions) {
      if (
        mission.learning.mode !== 'challenge' &&
        mission.learning.mode !== 'boss'
      ) {
        continue;
      }
      expect(
        mission.learning.impact?.trim().length,
        `${mission.id} missing learning.impact`,
      ).toBeGreaterThan(0);
    }
  });

  it('keeps challenge/boss player surfaces free of goal literals and human recipes', () => {
    for (const mission of missions) {
      if (
        mission.learning.mode !== 'challenge' &&
        mission.learning.mode !== 'boss'
      ) {
        continue;
      }
      const surface = playerFacingSurface(mission);
      for (const literal of goalSpoilers(mission.goals)) {
        expect(
          surface.includes(literal),
          `${mission.id} surface spoils goal literal "${literal}"`,
        ).toBe(false);
      }
      for (const pattern of HUMAN_RECIPE_PATTERNS) {
        expect(
          pattern.test(surface),
          `${mission.id} surface matches human recipe ${pattern}`,
        ).toBe(false);
      }
    }
  });

  it('ensures challenge/boss practiced concepts were introduced earlier when catalogued', () => {
    const introducedAt = new Map<string, number>();
    for (const [index, id] of CAMPAIGN_MISSION_IDS.entries()) {
      for (const concept of LEARNING_DESIGN_BY_ID[id].conceptsIntroduced) {
        if (!introducedAt.has(concept)) introducedAt.set(concept, index);
      }
    }

    for (const [index, id] of CAMPAIGN_MISSION_IDS.entries()) {
      const design = LEARNING_DESIGN_BY_ID[id];
      if (design.mode !== 'challenge' && design.mode !== 'boss') continue;
      for (const concept of design.conceptsPracticed) {
        const introIndex = introducedAt.get(concept);
        if (introIndex == null) continue; // flavor strings without an intro entry
        expect(
          introIndex < index,
          `${id} practices "${concept}" before/without a prior introduction`,
        ).toBe(true);
      }
    }
  });

  it('requires every boss to practice at least two previously introduced concepts', () => {
    const introducedAt = new Map<string, number>();
    for (const [index, id] of CAMPAIGN_MISSION_IDS.entries()) {
      for (const concept of LEARNING_DESIGN_BY_ID[id].conceptsIntroduced) {
        if (!introducedAt.has(concept)) introducedAt.set(concept, index);
      }
    }

    for (const [index, id] of CAMPAIGN_MISSION_IDS.entries()) {
      const design = LEARNING_DESIGN_BY_ID[id];
      if (design.mode !== 'boss') continue;
      const prior = design.conceptsPracticed.filter((concept) => {
        const introIndex = introducedAt.get(concept);
        return introIndex != null && introIndex < index;
      });
      expect(
        prior.length,
        `${id} boss practices only ${prior.length} previously introduced concept(s)`,
      ).toBeGreaterThanOrEqual(2);
    }
  });

  it('limits adjacent difficulty swings to two points', () => {
    for (let i = 1; i < CAMPAIGN_MISSION_IDS.length; i++) {
      const prev = LEARNING_DESIGN_BY_ID[CAMPAIGN_MISSION_IDS[i - 1]!];
      const curr = LEARNING_DESIGN_BY_ID[CAMPAIGN_MISSION_IDS[i]!];
      expect(
        Math.abs(curr.difficulty - prev.difficulty),
        `${CAMPAIGN_MISSION_IDS[i]} difficulty jumps more than 2 from prior stage`,
      ).toBeLessThanOrEqual(2);
    }
  });
});
