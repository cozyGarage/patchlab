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
      'Same copper bring-up with reassigned panel and switch labels. Bring SERVER-01 online on the new documented path.',
    apply: (mission) => ({
      ...mission,
      id: 'm1-first-lights-t1',
      title: `${mission.title} · Transfer`,
      brief:
        'Same copper bring-up with reassigned panel and switch labels. Bring SERVER-01 online on the new documented path.',
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
    brief:
      'SERVER-01 needs a reissued host address on the same LAN. Restore same-subnet reachability to FW-EDGE.',
    apply: (mission) => ({
      ...mission,
      id: 'm11-subnet-ping-t1',
      title: `${mission.title} · Transfer`,
      brief:
        'SERVER-01 needs a reissued host address on the same LAN. Restore same-subnet reachability to FW-EDGE.',
      goals: mission.goals.map((goal) =>
        goal.type === 'iface_ip'
          ? { ...goal, address: '10.10.10.40' }
          : goal,
      ),
      learning: {
        ...mission.learning,
        mode: 'challenge',
        visibleObjectives: [
          'Assign the reissued host address on SERVER-01.',
          'Confirm same-subnet ping succeeds.',
        ],
        ticketDetails: [
          'Use 10.10.10.40/24 with gateway 10.10.10.1 if required.',
        ],
      },
    }),
  },
  {
    id: 'm13-access-vlan-t1',
    parentId: 'm13-access-vlan',
    titleSuffix: 'Transfer',
    brief:
      'A different access port and VLAN were assigned for SERVER-07. Place the host on the reissued circuit.',
    apply: (mission) => ({
      ...mission,
      id: 'm13-access-vlan-t1',
      title: `${mission.title} · Transfer`,
      brief:
        'A different access port and VLAN were assigned for SERVER-07. Place the host on the reissued circuit.',
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
          'Place the reassigned switchport in the tenant VLAN.',
          'Patch SERVER-07 onto that access port.',
        ],
        ticketDetails: ['Use Gi1/0/3 access VLAN 20 for SERVER-07.'],
      },
    }),
  },
  {
    id: 'm19-broken-address-t1',
    parentId: 'm19-broken-address',
    titleSuffix: 'Transfer',
    brief:
      'SERVER-01 still cannot reach the firewall after a rushed address change. Repair host addressing for this transfer ticket.',
    apply: (mission) => ({
      ...mission,
      id: 'm19-broken-address-t1',
      title: `${mission.title} · Transfer`,
      brief:
        'SERVER-01 still cannot reach the firewall after a rushed address change. Repair host addressing for this transfer ticket.',
      goals: mission.goals.map((goal) =>
        goal.type === 'iface_ip'
          ? { ...goal, address: '10.10.10.55', gateway: '10.10.10.1' }
          : goal,
      ),
      learning: {
        ...mission.learning,
        mode: 'challenge',
        visibleObjectives: [
          'Diagnose the addressing fault and restore LAN reachability.',
        ],
        ticketDetails: ['Correct the host address to 10.10.10.55/24 via 10.10.10.1.'],
      },
    }),
  },
  {
    id: 'm18-deny-host-t1',
    parentId: 'm18-deny-host',
    titleSuffix: 'Transfer',
    brief:
      'Policy review: one approved host must keep WAN access while the other is cut off. Apply a selective host block without breaking the remaining service.',
    apply: (mission) => ({
      ...mission,
      id: 'm18-deny-host-t1',
      title: `${mission.title} · Transfer`,
      brief:
        'Policy review: one approved host must keep WAN access while the other is cut off. Apply a selective host block without breaking the remaining service.',
      goals: [
        {
          type: 'firewall_rule',
          action: 'deny',
          srcCidr: '10.10.10.10/32',
          dstCidr: '203.0.113.0/30',
        },
        {
          type: 'ping_fail',
          fromDeviceId: 'server-01',
          toDeviceId: 'wan-peer',
        },
        {
          type: 'ping',
          fromDeviceId: 'server-07',
          toDeviceId: 'wan-peer',
        },
      ],
      learning: {
        ...mission.learning,
        mode: 'challenge',
        visibleObjectives: [
          'Block only the unauthorized host from the WAN.',
          'Preserve approved WAN reachability for the other server.',
        ],
        ticketDetails: [
          'Deny 10.10.10.10/32 to 203.0.113.0/30 above the broad permit.',
          'SERVER-01 must fail to ISP-PEER; SERVER-07 must still succeed.',
        ],
      },
    }),
  },
  {
    id: 'm24-wrong-gateway-t1',
    parentId: 'm24-wrong-gateway',
    titleSuffix: 'Transfer',
    brief:
      'Off-subnet probes fail again after a host rebuild. Local fabric looks fine — restore WAN reachability.',
    apply: (mission) => {
      const devices = mission.initial.devices.map((device) => {
        if (device.id !== 'server-01') return device;
        return {
          ...device,
          ports: device.ports.map((port) =>
            port.id === 'nic-1' && port.ip
              ? {
                  ...port,
                  ip: {
                    ...port.ip,
                    address: '10.10.10.40',
                    prefix: 24,
                    gateway: '10.10.20.1',
                  },
                }
              : port,
          ),
        };
      });
      return {
        ...mission,
        id: 'm24-wrong-gateway-t1',
        title: `${mission.title} · Transfer`,
        brief:
          'Off-subnet probes fail again after a host rebuild. Local fabric looks fine — restore WAN reachability.',
        initial: { ...mission.initial, devices },
        goals: mission.goals.map((goal) =>
          goal.type === 'iface_ip'
            ? {
                ...goal,
                address: '10.10.10.40',
                prefix: 24,
                gateway: '10.10.10.1',
              }
            : goal,
        ),
        learning: {
          ...mission.learning,
          mode: 'challenge',
          visibleObjectives: [
            'Diagnose why local configuration cannot reach the WAN.',
            'Repair only the incorrect forwarding setting and verify service.',
          ],
          ticketDetails: [
            'Keep 10.10.10.40/24 and set the default gateway to 10.10.10.1.',
          ],
        },
      };
    },
  },
  {
    id: 'm25-host-route-t1',
    parentId: 'm25-host-route',
    titleSuffix: 'Transfer',
    brief:
      'BRANCH answers for other destinations, but one host path is black-holed. Fix the more-specific route poisoning that destination.',
    apply: (mission) => {
      const devices = mission.initial.devices.map((device) => {
        if (device.id !== 'fw-1') return device;
        return {
          ...device,
          routes: (device.routes ?? []).map((route) =>
            route.destCidr === '198.51.100.10/32'
              ? {
                  ...route,
                  destCidr: '198.51.100.10/32',
                  nextHop: '203.0.113.1',
                  note: 'Poisoned host route — override next hop toward ISP-PEER',
                }
              : route,
          ),
        };
      });
      return {
        ...mission,
        id: 'm25-host-route-t1',
        title: `${mission.title} · Transfer`,
        brief:
          'BRANCH answers for other destinations, but one host path is black-holed. Fix the more-specific route poisoning that destination.',
        initial: { ...mission.initial, devices },
        goals: mission.goals.map((goal) =>
          goal.type === 'route_entry'
            ? {
                ...goal,
                destCidr: '198.51.100.10/32',
                nextHop: '203.0.113.2',
              }
            : goal,
        ),
        learning: {
          ...mission.learning,
          mode: 'challenge',
          visibleObjectives: [
            'Identify why one branch host ignores the working summary path.',
            'Restore that destination without changing the WAN or ACL.',
          ],
          ticketDetails: [
            'Override the /32 for BRANCH-01 so its next hop is 203.0.113.2.',
          ],
        },
      };
    },
  },
  {
    id: 'm31-pat-overload-t1',
    parentId: 'm31-pat-overload',
    titleSuffix: 'Transfer',
    brief:
      'Egress from the private LAN still fails despite healthy route and ACL. Restore many-to-one translation for outbound access.',
    apply: (mission) => {
      const devices = mission.initial.devices.map((device) => {
        if (device.id !== 'server-01') return device;
        return {
          ...device,
          ports: device.ports.map((port) =>
            port.id === 'nic-1' && port.ip
              ? {
                  ...port,
                  ip: {
                    ...port.ip,
                    address: '10.10.10.40',
                    prefix: 24,
                    gateway: '10.10.10.1',
                  },
                }
              : port,
          ),
        };
      });
      return {
        ...mission,
        id: 'm31-pat-overload-t1',
        title: `${mission.title} · Transfer`,
        brief:
          'Egress from the private LAN still fails despite healthy route and ACL. Restore many-to-one translation for outbound access.',
        initial: { ...mission.initial, devices },
        goals: mission.goals.map((goal) =>
          goal.type === 'nat_pat'
            ? {
                ...goal,
                insideCidr: '10.10.10.0/24',
                outsideIp: '203.0.113.1',
              }
            : goal,
        ),
        learning: {
          ...mission.learning,
          mode: 'challenge',
          visibleObjectives: [
            'Restore outbound translation for private LAN hosts.',
            'Prove WAN reachability from the rebuilt server.',
          ],
          ticketDetails: [
            'Apply PAT overload for 10.10.10.0/24 using outside 203.0.113.1.',
            'SERVER-01 is at 10.10.10.40/24 via 10.10.10.1.',
          ],
        },
      };
    },
  },
  {
    id: 'm30-floating-static-t1',
    parentId: 'm30-floating-static',
    titleSuffix: 'Transfer',
    brief:
      'Preferred BRANCH path is still withdrawn. Install a higher-AD backup that restores reachability without removing the tracked primary.',
    apply: (mission) => ({
      ...mission,
      id: 'm30-floating-static-t1',
      title: `${mission.title} · Transfer`,
      brief:
        'Preferred BRANCH path is still withdrawn. Install a higher-AD backup that restores reachability without removing the tracked primary.',
      goals: mission.goals.map((goal) =>
        goal.type === 'route_entry' && goal.adminDistance === 10
          ? { ...goal, adminDistance: 20, nextHop: '203.0.113.2' }
          : goal,
      ),
      learning: {
        ...mission.learning,
        mode: 'challenge',
        visibleObjectives: [
          'Keep the tracked-down primary configured.',
          'Install a higher-AD backup that restores BRANCH reachability.',
        ],
        ticketDetails: [
          'Add floating backup 198.51.100.0/24 via 203.0.113.2 with AD 20.',
        ],
      },
    }),
  },
  {
    id: 'm32-traceroute-t1',
    parentId: 'm32-traceroute',
    titleSuffix: 'Transfer',
    brief:
      'BRANCH traceroute dies mid-path again after a change window. Restore forwarding and prove the hop chain completes.',
    apply: (mission) => ({
      ...mission,
      id: 'm32-traceroute-t1',
      title: `${mission.title} · Transfer`,
      brief:
        'BRANCH traceroute dies mid-path again after a change window. Restore forwarding and prove the hop chain completes.',
      goals: mission.goals.map((goal) =>
        goal.type === 'route_entry'
          ? {
              ...goal,
              destCidr: '198.51.100.0/24',
              nextHop: '203.0.113.2',
            }
          : goal,
      ),
      learning: {
        ...mission.learning,
        mode: 'challenge',
        visibleObjectives: [
          'Restore the broken forwarding layer.',
          'Prove the hop path with traceroute.',
        ],
        ticketDetails: [
          'Policy toward BRANCH is already open.',
          'Add route 198.51.100.0/24 via 203.0.113.2, then traceroute SERVER-01 → BRANCH-01.',
        ],
      },
    }),
  },
  {
    id: 'm6-fiber-first-t1',
    parentId: 'm6-fiber-first',
    titleSuffix: 'Transfer',
    brief:
      'A reassigned fiber circuit needs first light. Bring up the OM4 path on the new tray and SFP labels without using a disabled cage.',
    apply: (mission) => ({
      ...mission,
      id: 'm6-fiber-first-t1',
      title: `${mission.title} · Transfer`,
      brief:
        'A reassigned fiber circuit needs first light. Bring up the OM4 path on the new tray and SFP labels without using a disabled cage.',
      goals: [
        {
          type: 'cable_media_between',
          a: { deviceId: 'fiber-tray', portId: 'f-2' },
          b: { deviceId: 'tor-sfp', portId: 'sfp-2' },
          media: 'fiber_om4',
        },
        {
          type: 'link_up',
          a: { deviceId: 'fiber-tray', portId: 'f-2' },
          b: { deviceId: 'tor-sfp', portId: 'sfp-2' },
        },
        {
          type: 'no_cables_on',
          ports: [{ deviceId: 'tor-sfp', portId: 'sfp-3' }],
        },
      ],
      learning: {
        ...mission.learning,
        mode: 'challenge',
        visibleObjectives: [
          'Build the reassigned fiber tray uplink.',
          'Confirm the optical path lights without using a disabled cage.',
        ],
        ticketDetails: [
          'Patch F-02 to Te1/0/2 with OM4 fiber.',
          'Te1/0/3 remains administratively down — leave it clear.',
        ],
      },
    }),
  },
  {
    id: 'm4-admin-down-t1',
    parentId: 'm4-admin-down',
    titleSuffix: 'Transfer',
    brief:
      'The documented copper path still looks correct, but the access port stays dark. Recover service on an approved spare without leaving the dead port patched.',
    apply: (mission) => ({
      ...mission,
      id: 'm4-admin-down-t1',
      title: `${mission.title} · Transfer`,
      brief:
        'The documented copper path still looks correct, but the access port stays dark. Recover service on an approved spare without leaving the dead port patched.',
      goals: [
        {
          type: 'link_up',
          a: { deviceId: 'panel-a', portId: 'panel-4' },
          b: { deviceId: 'tor-1', portId: 'sw-8' },
        },
        {
          type: 'link_up',
          a: { deviceId: 'tor-1', portId: 'sw-5' },
          b: { deviceId: 'server-01', portId: 'nic-1' },
        },
        {
          type: 'no_cables_on',
          ports: [{ deviceId: 'tor-1', portId: 'sw-4' }],
        },
      ],
      learning: {
        ...mission.learning,
        mode: 'challenge',
        visibleObjectives: [
          'Move the panel cross-connect onto an approved live spare.',
          'Keep SERVER-01 online and clear the admin-down port.',
        ],
        ticketDetails: [
          'Gi1/0/4 is administratively down.',
          'Use Gi1/0/8 as the approved spare for this transfer.',
        ],
      },
    }),
  },
  {
    id: 'm16-trunk-uplink-t1',
    parentId: 'm16-trunk-uplink',
    titleSuffix: 'Transfer',
    brief:
      'Operations reassigned the firewall uplink. Prepare the new switchport as a multi-VLAN handoff and prove the link.',
    apply: (mission) => ({
      ...mission,
      id: 'm16-trunk-uplink-t1',
      title: `${mission.title} · Transfer`,
      brief:
        'Operations reassigned the firewall uplink. Prepare the new switchport as a multi-VLAN handoff and prove the link.',
      goals: [
        {
          type: 'port_mode',
          port: { deviceId: 'tor-1', portId: 'sw-6' },
          mode: 'trunk',
        },
        {
          type: 'trunk_vlans',
          port: { deviceId: 'tor-1', portId: 'sw-6' },
          vlanIds: [10, 20],
        },
        {
          type: 'link_up',
          a: { deviceId: 'tor-1', portId: 'sw-6' },
          b: { deviceId: 'fw-1', portId: 'fw-lan' },
        },
      ],
      learning: {
        ...mission.learning,
        mode: 'challenge',
        visibleObjectives: [
          'Prepare the reassigned uplink to carry multiple VLANs.',
          'Connect and verify the firewall handoff.',
        ],
        ticketDetails: [
          'Gi1/0/6 is the assigned trunk for this transfer.',
          'Patch Gi1/0/6 to FW-EDGE LAN0 and allow VLANs 10 and 20.',
        ],
      },
    }),
  },
  {
    id: 'm17-static-nat-t1',
    parentId: 'm17-static-nat',
    titleSuffix: 'Transfer',
    brief:
      'A different public address was issued for SERVER-01. Publish the host, authorize inbound traffic, and prove the external path.',
    apply: (mission) => ({
      ...mission,
      id: 'm17-static-nat-t1',
      title: `${mission.title} · Transfer`,
      brief:
        'A different public address was issued for SERVER-01. Publish the host, authorize inbound traffic, and prove the external path.',
      goals: mission.goals.map((goal) => {
        if (goal.type === 'nat_static') {
          return {
            ...goal,
            insideIp: '10.10.10.10',
            outsideIp: '203.0.113.11',
          };
        }
        if (goal.type === 'ping_public') {
          return { ...goal, publicIp: '203.0.113.11' };
        }
        return goal;
      }),
      learning: {
        ...mission.learning,
        mode: 'challenge',
        visibleObjectives: [
          'Publish the internal server at the reissued public address.',
          'Authorize inbound traffic and verify the external service path.',
        ],
        ticketDetails: [
          'Map inside 10.10.10.10 to outside 203.0.113.11.',
          'Permit 203.0.113.0/30 → 10.10.10.0/24, then probe the public mapping.',
        ],
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
