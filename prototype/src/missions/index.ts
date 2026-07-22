import type { Mission, RackState } from '../types/schema';
import rackBase from './rackBase.json';
import m1 from './m1-first-lights.json';
import m2 from './m2-wrong-port.json';
import m3 from './m3-vlan-trap.json';
import m4 from './m4-admin-down.json';
import m5 from './m5-change-window.json';

export const baseRack = rackBase as unknown as RackState;

function asMission(data: unknown): Mission {
  return data as Mission;
}

export const missions: Mission[] = [
  asMission(m1),
  asMission(m2),
  asMission(m3),
  asMission(m4),
  asMission(m5),
].sort((a, b) => a.order - b.order);

export function getMission(id: string): Mission | undefined {
  return missions.find((m) => m.id === id);
}

export const SANDBOX_UNLOCK_AFTER_ORDER = 3;
