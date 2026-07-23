import type { Mission, RackState } from '../types/schema';
import rackBase from './rackBase.json';
import m1 from './m1-first-lights.json';
import m2 from './m2-wrong-port.json';
import m3 from './m3-vlan-trap.json';
import m4 from './m4-admin-down.json';
import m5 from './m5-change-window.json';
import m6 from './m6-fiber-first.json';
import m7 from './m7-wrong-media.json';
import m8 from './m8-dual-servers.json';

export const baseRack = rackBase as unknown as RackState;

function asMission(data: unknown): Mission {
  const m = data as Mission;
  return {
    ...m,
    inventory: {
      copper_cat6: m.inventory?.copper_cat6 ?? 0,
      fiber_om4: m.inventory?.fiber_om4 ?? 0,
    },
  };
}

export const missions: Mission[] = [
  asMission(m1),
  asMission(m2),
  asMission(m3),
  asMission(m4),
  asMission(m5),
  asMission(m6),
  asMission(m7),
  asMission(m8),
].sort((a, b) => a.order - b.order);

export function getMission(id: string): Mission | undefined {
  return missions.find((m) => m.id === id);
}

export const SANDBOX_UNLOCK_AFTER_ORDER = 3;
