import type { Mission } from '../types/schema';

export interface TransferVariantDef {
  id: string;
  parentId: string;
  titleSuffix: string;
  brief: string;
  /** Mutate a clone of the parent mission into a transfer variant. */
  apply: (mission: Mission) => Mission;
}

/** Optional mastery transfers — unlocked after clearing the parent stage. */
export const TRANSFER_DEFS: TransferVariantDef[] = [
  {
    id: 'm1-first-lights-t1',
    parentId: 'm1-first-lights',
    titleSuffix: 'Transfer',
    brief:
      'Same copper bring-up, new labels: use A-02 → Gi1/0/3 and Gi1/0/6 → SERVER-01 eth0.',
    apply: (mission) => ({
      ...mission,
      id: 'm1-first-lights-t1',
      title: `${mission.title} · Transfer`,
      brief:
        'Same copper bring-up, new labels: use A-02 → Gi1/0/3 and Gi1/0/6 → SERVER-01 eth0.',
      goals: [
        {
          type: 'link_up',
          a: { deviceId: 'panel-a', portId: 'panel-2' },
          b: { deviceId: 'tor-1', portId: 'sw-3' },
        },
        {
          type: 'link_up',
          a: { deviceId: 'tor-1', portId: 'sw-6' },
          b: { deviceId: 'server-01', portId: 'nic-1' },
        },
      ],
      learning: {
        ...mission.learning,
        mode: 'challenge',
        visibleObjectives: [
          'Patch the reassigned panel circuit to the switch.',
          'Bring SERVER-01 online on the new access port.',
        ],
        ticketDetails: [
          'Panel A-02 → ToR Gi1/0/3.',
          'ToR Gi1/0/6 → SERVER-01 eth0.',
        ],
        debrief: {
          ...mission.learning.debrief,
          outcome: 'SERVER-01 is online on the transferred copper path.',
          question: 'What stayed the same when the port labels changed?',
          answer:
            'The need for matching media and a continuous path from panel to NIC — only the documented endpoints changed.',
        },
      },
    }),
  },
  {
    id: 'm11-subnet-ping-t1',
    parentId: 'm11-subnet-ping',
    titleSuffix: 'Transfer',
    brief: 'Address SERVER-01 as 10.10.10.40/24 and prove same-subnet reachability.',
    apply: (mission) => ({
      ...mission,
      id: 'm11-subnet-ping-t1',
      title: `${mission.title} · Transfer`,
      brief:
        'Address SERVER-01 as 10.10.10.40/24 and prove same-subnet reachability.',
      goals: mission.goals.map((goal) =>
        goal.type === 'iface_ip'
          ? { ...goal, address: '10.10.10.40' }
          : goal,
      ),
      learning: {
        ...mission.learning,
        mode: 'challenge',
        visibleObjectives: [
          'Assign 10.10.10.40/24 on SERVER-01.',
          'Confirm same-subnet ping succeeds.',
        ],
        ticketDetails: ['Use 10.10.10.40/24 with gateway 10.10.10.1 if required.'],
      },
    }),
  },
  {
    id: 'm13-access-vlan-t1',
    parentId: 'm13-access-vlan',
    titleSuffix: 'Transfer',
    brief: 'Move Gi1/0/3 to VLAN 20 and land SERVER-07 there instead.',
    apply: (mission) => ({
      ...mission,
      id: 'm13-access-vlan-t1',
      title: `${mission.title} · Transfer`,
      brief: 'Move Gi1/0/3 to VLAN 20 and land SERVER-07 there instead.',
      goals: [
        {
          type: 'port_vlan',
          port: { deviceId: 'tor-1', portId: 'sw-3' },
          vlanId: 20,
        },
        {
          type: 'link_up',
          a: { deviceId: 'tor-1', portId: 'sw-3' },
          b: { deviceId: 'server-07', portId: 'nic-1' },
        },
      ],
      learning: {
        ...mission.learning,
        mode: 'challenge',
        visibleObjectives: [
          'Set Gi1/0/3 access VLAN to 20.',
          'Patch SERVER-07 onto Gi1/0/3.',
        ],
        ticketDetails: ['Use Gi1/0/3 (not Gi1/0/6) for this transfer ticket.'],
      },
    }),
  },
  {
    id: 'm19-broken-address-t1',
    parentId: 'm19-broken-address',
    titleSuffix: 'Transfer',
    brief: 'Repair SERVER-01 addressing using 10.10.10.55/24 via 10.10.10.1.',
    apply: (mission) => ({
      ...mission,
      id: 'm19-broken-address-t1',
      title: `${mission.title} · Transfer`,
      brief: 'Repair SERVER-01 addressing using 10.10.10.55/24 via 10.10.10.1.',
      goals: mission.goals.map((goal) =>
        goal.type === 'iface_ip'
          ? { ...goal, address: '10.10.10.55', gateway: '10.10.10.1' }
          : goal,
      ),
      learning: {
        ...mission.learning,
        mode: 'challenge',
        visibleObjectives: ['Correct the host address to 10.10.10.55/24.'],
        ticketDetails: ['Gateway remains 10.10.10.1.'],
      },
    }),
  },
];

export function buildTransferMission(
  parent: Mission,
  def: TransferVariantDef,
): Mission {
  const built = def.apply(structuredClone(parent));
  return {
    ...built,
    id: def.id,
    order: parent.order,
    track: parent.track,
  };
}

export function transfersForParent(
  parentId: string,
  campaign: Mission[],
): Mission[] {
  const parent = campaign.find((m) => m.id === parentId);
  if (!parent) return [];
  return TRANSFER_DEFS.filter((d) => d.parentId === parentId).map((d) =>
    buildTransferMission(parent, d),
  );
}

export function allTransferMissions(campaign: Mission[]): Mission[] {
  return TRANSFER_DEFS.flatMap((def) => {
    const parent = campaign.find((m) => m.id === def.parentId);
    return parent ? [buildTransferMission(parent, def)] : [];
  });
}

export function getTransferMission(
  id: string,
  campaign: Mission[],
): Mission | undefined {
  const def = TRANSFER_DEFS.find((d) => d.id === id);
  if (!def) return undefined;
  const parent = campaign.find((m) => m.id === def.parentId);
  return parent ? buildTransferMission(parent, def) : undefined;
}

export function isTransferMissionId(id: string): boolean {
  return TRANSFER_DEFS.some((d) => d.id === id);
}
