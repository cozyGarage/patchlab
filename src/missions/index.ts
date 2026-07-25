import type { Mission, RackState } from '../types/schema';
import {
  CAMPAIGN_MISSION_IDS,
  isCampaignMissionId,
  LEARNING_DESIGN_BY_ID,
} from './learningDesign';
import rackBase from './rackBase.json';
import m1 from './m1-first-lights.json';
import m2 from './m2-wrong-port.json';
import m3 from './m3-vlan-trap.json';
import m4 from './m4-admin-down.json';
import m5 from './m5-change-window.json';
import m6 from './m6-fiber-first.json';
import m7 from './m7-wrong-media.json';
import m8 from './m8-dual-servers.json';
import m9 from './m9-power-up.json';
import m10 from './m10-console-ip.json';
import m11 from './m11-subnet-ping.json';
import m12 from './m12-firewall-acl.json';
import m13 from './m13-access-vlan.json';
import m14 from './m14-vlan-isolation.json';
import m15 from './m15-default-gateway.json';
import m16 from './m16-trunk-uplink.json';
import m17 from './m17-static-nat.json';
import m18 from './m18-deny-host.json';
import m19 from './m19-broken-address.json';
import m20 from './m20-mask-trap.json';
import m21 from './m21-inter-vlan.json';
import m22 from './m22-static-route.json';
import m23 from './m23-no-shutdown.json';
import m24 from './m24-wrong-gateway.json';
import m25 from './m25-host-route.json';
import m26 from './m26-deny-branch.json';
import m27 from './m27-branch-exception.json';
import m28 from './m28-fiber-no-shutdown.json';
import m29 from './m29-spare-pdu.json';
import m30 from './m30-floating-static.json';
import m31 from './m31-pat-overload.json';
import m32 from './m32-traceroute.json';

export const baseRack = rackBase as unknown as RackState;

const missionData: unknown[] = [
  m1,
  m2,
  m3,
  m4,
  m5,
  m6,
  m7,
  m8,
  m9,
  m10,
  m11,
  m12,
  m13,
  m14,
  m15,
  m16,
  m17,
  m18,
  m19,
  m20,
  m21,
  m22,
  m23,
  m24,
  m25,
  m26,
  m27,
  m28,
  m29,
  m30,
  m31,
  m32,
];

function missionId(data: unknown): string {
  const id = (data as { id?: unknown }).id;
  if (typeof id !== 'string') throw new Error('Mission data is missing a string id');
  return id;
}

function validateMissionCatalog(data: unknown[]): void {
  const sourceIds = data.map(missionId);
  const sourceIdSet = new Set(sourceIds);
  const campaignIdSet = new Set<string>(CAMPAIGN_MISSION_IDS);
  const learningIds = Object.keys(LEARNING_DESIGN_BY_ID);

  if (sourceIdSet.size !== sourceIds.length) {
    throw new Error('Mission catalog contains duplicate mission ids');
  }
  if (campaignIdSet.size !== CAMPAIGN_MISSION_IDS.length) {
    throw new Error('Campaign order contains duplicate mission ids');
  }
  if (
    sourceIdSet.size !== campaignIdSet.size ||
    sourceIds.some((id) => !campaignIdSet.has(id)) ||
    CAMPAIGN_MISSION_IDS.some((id) => !sourceIdSet.has(id))
  ) {
    throw new Error('Campaign order must contain every mission id exactly once');
  }
  if (
    learningIds.length !== campaignIdSet.size ||
    learningIds.some((id) => !campaignIdSet.has(id))
  ) {
    throw new Error('Learning design must contain exactly one entry per mission id');
  }
}

function asMission(data: unknown, order: number): Mission {
  const m = data as Mission;
  if (!isCampaignMissionId(m.id)) {
    throw new Error(`Missing learning design for mission ${m.id}`);
  }
  return {
    ...m,
    order,
    learning: LEARNING_DESIGN_BY_ID[m.id],
    inventory: {
      copper_cat6: m.inventory?.copper_cat6 ?? 0,
      fiber_om4: m.inventory?.fiber_om4 ?? 0,
      power_c13: m.inventory?.power_c13 ?? 0,
      console_rj45: m.inventory?.console_rj45 ?? 0,
    },
  };
}

validateMissionCatalog(missionData);
const missionDataById = new Map(missionData.map((data) => [missionId(data), data]));

export const missions: Mission[] = CAMPAIGN_MISSION_IDS.map((id, index) => {
  const data = missionDataById.get(id);
  if (!data) throw new Error(`Missing mission data for ${id}`);
  return asMission(data, index + 1);
});

export function getMission(id: string): Mission | undefined {
  return missions.find((m) => m.id === id);
}

/** @deprecated Prefer GATE.sandboxAfterOrder from lib/chapters — kept for docs. */
export const SANDBOX_UNLOCK_AFTER_ORDER = 5;
