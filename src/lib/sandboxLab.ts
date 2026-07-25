import type { Inventory, LearningDesign, RackState } from '../types/schema';
import { baseRack } from '../missions';
import { createEngineState } from '../engine/reducer';
import type { Mission } from '../types/schema';

const SNAP_KEY = 'patchlab.sandbox.snap.v1';

export interface SandboxSnapshot {
  version: 1;
  savedAt: string;
  label: string;
  rack: RackState;
  inventory: Inventory;
}

export interface SandboxPreset {
  id: string;
  title: string;
  blurb: string;
  build: () => { rack: RackState; inventory: Inventory };
}

export const SANDBOX_LEARNING: LearningDesign = {
  mode: 'practice',
  difficulty: 1,
  conceptsIntroduced: [],
  conceptsPracticed: ['Open-ended network experimentation'],
  enabledTools: [
    'patch',
    'power',
    'console',
    'ip',
    'switchport',
    'acl',
    'nat',
    'pat',
    'route',
    'ping',
    'traceroute',
  ],
  visibleObjectives: ['Build, break, inspect, and repair the rack freely.'],
  debrief: {
    outcome: 'Sandbox session complete.',
    explanation: 'Sandbox has no required outcome or score.',
    question: 'What evidence would you inspect first in a real incident?',
    answer: 'Start with power and physical link state, then move upward through VLAN, addressing, routing, and policy.',
  },
  hints: {
    prompt: 'Inspect the lowest network layer that could explain the symptom.',
    evidence: 'Power, link LEDs, VLANs, IP settings, routes, and policy all provide evidence.',
    action: 'Test one hypothesis at a time and observe the result.',
  },
};

const freeInventory: Inventory = {
  copper_cat6: 12,
  fiber_om4: 8,
  power_c13: 6,
  console_rj45: 4,
};

function emptySandboxMission(): Mission {
  return {
    id: 'sandbox',
    title: 'Sandbox',
    order: 99,
    brief: 'Free play',
    constraints: [],
    parTimeSec: 9999,
    hintAfterWrongAttempts: 99,
    inventory: freeInventory,
    initial: { devices: [], cables: [] },
    goals: [],
    track: 'mixed',
    learning: SANDBOX_LEARNING,
  };
}

/** Fresh powered rack with inventory for free play. */
export function freshSandboxState() {
  return createEngineState(emptySandboxMission(), baseRack);
}

function dailyIncident() {
  const state = freshSandboxState();
  const rack = structuredClone(state.snapshot.rack);
  const dayKey = new Date().toISOString().slice(0, 10);
  const seed = [...dayKey].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const variant = seed % 3;

  if (variant === 0) {
    rack.cables = rack.cables.filter((cable) => cable.id !== 'pwr-tor');
  } else if (variant === 1) {
    const port = rack.devices
      .find((device) => device.id === 'tor-1')
      ?.ports.find((candidate) => candidate.id === 'sw-7');
    if (port) port.vlanId = 10;
  } else {
    const port = rack.devices
      .find((device) => device.id === 'tor-sfp')
      ?.ports.find((candidate) => candidate.id === 'sfp-3');
    if (port) port.admin = 'down';
  }

  return { rack, inventory: state.snapshot.inventory };
}

export const SANDBOX_PRESETS: SandboxPreset[] = [
  {
    id: 'daily-incident',
    title: 'Daily Incident',
    blurb: 'A date-seeded power, VLAN, or interface fault. Diagnose it from evidence.',
    build: dailyIncident,
  },
  {
    id: 'dark-tor',
    title: 'Ticket: Dark ToR',
    blurb: 'ToR lost PDU power — bring it back on OUT1.',
    build: () => {
      const state = freshSandboxState();
      const rack = structuredClone(state.snapshot.rack);
      rack.cables = rack.cables.filter((c) => c.id !== 'pwr-tor');
      return {
        rack,
        inventory: {
          ...state.snapshot.inventory,
          power_c13: state.snapshot.inventory.power_c13 + 1,
        },
      };
    },
  },
  {
    id: 'vlan-mismatch',
    title: 'Ticket: VLAN mismatch',
    blurb: 'SERVER-07 is on a VLAN 10 port — move or re-VLAN.',
    build: () => {
      const state = freshSandboxState();
      const rack = structuredClone(state.snapshot.rack);
      rack.cables.push({
        id: 'ticket-srv7',
        media: 'copper_cat6',
        color: 'blue',
        lengthM: 2,
        ends: [
          { deviceId: 'tor-1', portId: 'sw-5' },
          { deviceId: 'server-07', portId: 'nic-1' },
        ],
      });
      return {
        rack,
        inventory: {
          ...state.snapshot.inventory,
          copper_cat6: Math.max(0, state.snapshot.inventory.copper_cat6 - 1),
        },
      };
    },
  },
  {
    id: 'branch-dark',
    title: 'Ticket: BRANCH dark',
    blurb: 'LAN up, but no route/ACL to BRANCH — fix egress.',
    build: () => {
      const state = freshSandboxState();
      const rack = structuredClone(state.snapshot.rack);
      const fw = rack.devices.find((d) => d.id === 'fw-1')!;
      const tor = rack.devices.find((d) => d.id === 'tor-1')!;
      const srv = rack.devices.find((d) => d.id === 'server-01')!;
      fw.firewallRules = [
        {
          id: 'deny-branch',
          action: 'deny',
          srcCidr: '10.10.10.0/24',
          dstCidr: '198.51.100.0/24',
          enabled: true,
        },
      ];
      fw.routes = [];
      const nic = srv.ports.find((p) => p.id === 'nic-1')!;
      nic.ip = {
        address: '10.10.10.10',
        prefix: 24,
        gateway: '10.10.10.1',
      };
      rack.cables.push(
        {
          id: 'ticket-fw-lan',
          media: 'copper_cat6',
          color: 'yellow',
          lengthM: 1,
          ends: [
            { deviceId: 'fw-1', portId: 'fw-lan' },
            { deviceId: 'tor-1', portId: 'sw-2' },
          ],
        },
        {
          id: 'ticket-srv',
          media: 'copper_cat6',
          color: 'blue',
          lengthM: 2,
          ends: [
            { deviceId: 'tor-1', portId: 'sw-5' },
            { deviceId: 'server-01', portId: 'nic-1' },
          ],
        },
      );
      void tor;
      return {
        rack,
        inventory: {
          ...state.snapshot.inventory,
          copper_cat6: Math.max(0, state.snapshot.inventory.copper_cat6 - 2),
        },
      };
    },
  },
];

export function saveSandboxSnapshot(
  rack: RackState,
  inventory: Inventory,
  label = 'Manual save',
): SandboxSnapshot {
  const snap: SandboxSnapshot = {
    version: 1,
    savedAt: new Date().toISOString(),
    label,
    rack: structuredClone(rack),
    inventory: { ...inventory },
  };
  localStorage.setItem(SNAP_KEY, JSON.stringify(snap));
  return snap;
}

export function loadSandboxSnapshot(): SandboxSnapshot | null {
  try {
    const raw = localStorage.getItem(SNAP_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SandboxSnapshot;
    if (parsed.version !== 1 || !parsed.rack) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearSandboxSnapshot(): void {
  localStorage.removeItem(SNAP_KEY);
}
