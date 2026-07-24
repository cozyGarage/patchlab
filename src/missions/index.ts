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

export const baseRack = rackBase as unknown as RackState;

function asMission(data: unknown): Mission {
  const m = data as Mission;
  return {
    ...m,
    inventory: {
      copper_cat6: m.inventory?.copper_cat6 ?? 0,
      fiber_om4: m.inventory?.fiber_om4 ?? 0,
      power_c13: m.inventory?.power_c13 ?? 0,
      console_rj45: m.inventory?.console_rj45 ?? 0,
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
  asMission(m9),
  asMission(m10),
  asMission(m11),
  asMission(m12),
  asMission(m13),
  asMission(m14),
  asMission(m15),
  asMission(m16),
  asMission(m17),
  asMission(m18),
  asMission(m19),
  asMission(m20),
  asMission(m21),
  asMission(m22),
  asMission(m23),
  asMission(m24),
  asMission(m25),
  asMission(m26),
  asMission(m27),
  asMission(m28),
  asMission(m29),
].sort((a, b) => a.order - b.order);

export function getMission(id: string): Mission | undefined {
  return missions.find((m) => m.id === id);
}

/** @deprecated Prefer GATE.sandboxAfterOrder from lib/chapters — kept for docs. */
export const SANDBOX_UNLOCK_AFTER_ORDER = 5;
