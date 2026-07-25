import { describe, expect, it } from 'vitest';
import { baseRack, getMission, missions } from '../missions';
import { createEngineState, reduce } from './reducer';
import { evaluatePing, evaluateTraceroute } from './linkSolver';
import { scoreRun } from './scoring';
import { portKey } from '../types/schema';

describe('mission catalog', () => {
  it('loads 32 ordered missions with goals', () => {
    expect(missions).toHaveLength(32);
    expect(missions.map((m) => m.order)).toEqual(
      Array.from({ length: 32 }, (_, i) => i + 1),
    );
    for (const m of missions) {
      expect(m.goals.length).toBeGreaterThan(0);
      expect(getMission(m.id)?.title).toBe(m.title);
      for (const media of Object.keys(m.inventory) as (keyof typeof m.inventory)[]) {
        const initialCount = m.initial.cables.filter((c) => c.media === media).length;
        expect(
          initialCount,
          `${m.id} has more initial ${media} cables than its inventory`,
        ).toBeLessThanOrEqual(m.inventory[media]);
      }
    }
  });

  it('keeps the learning curve and tool disclosure internally consistent', () => {
    const toolForGoal = {
      link_up: undefined,
      path_up: undefined,
      port_in_path: undefined,
      no_cables_on: undefined,
      cable_color_between: undefined,
      cable_media_between: undefined,
      device_powered: undefined,
      console_attached: undefined,
      console_link: undefined,
      iface_ip: 'ip',
      ping: 'ping',
      ping_fail: 'ping',
      ping_public: 'ping',
      firewall_rule: 'acl',
      port_vlan: 'switchport',
      port_mode: 'switchport',
      trunk_vlans: 'switchport',
      nat_static: 'nat',
      nat_pat: 'pat',
      route_entry: 'route',
      traceroute_ok: 'traceroute',
    } as const;

    for (const [index, mission] of missions.entries()) {
      expect(mission.learning.conceptsIntroduced.length).toBeLessThanOrEqual(1);
      expect(mission.learning.visibleObjectives.length).toBeGreaterThan(0);
      for (const goal of mission.goals) {
        const requiredTool = toolForGoal[goal.type];
        if (!requiredTool) continue;
        expect(
          mission.learning.enabledTools,
          `${mission.id} must enable ${requiredTool} for ${goal.type}`,
        ).toContain(requiredTool);
      }
      if (index > 0) {
        expect(
          Math.abs(
            mission.learning.difficulty -
              missions[index - 1]!.learning.difficulty,
          ),
        ).toBeLessThanOrEqual(2);
      }
    }
  });
});

describe('PatchLab engine — copper path', () => {
  it('M1: patches panel and server to bring links up', () => {
    const mission = getMission('m1-first-lights')!;
    let state = createEngineState(mission, baseRack);

    state = reduce(state, {
      type: 'CONNECT',
      a: { deviceId: 'panel-a', portId: 'panel-1' },
      b: { deviceId: 'tor-1', portId: 'sw-1' },
    });
    expect(
      state.snapshot.linkTable[
        portKey({ deviceId: 'panel-a', portId: 'panel-1' })
      ],
    ).toBe('up');

    state = reduce(state, {
      type: 'CONNECT',
      a: { deviceId: 'tor-1', portId: 'sw-5' },
      b: { deviceId: 'server-01', portId: 'nic-1' },
    });

    expect(state.snapshot.complete).toBe(true);
    expect(scoreRun(state, state.startedAtMs + 30_000).correctness).toBeGreaterThanOrEqual(2);
  });

  it('M2: moves panel cross-connect to A-01 and clears A-03', () => {
    const mission = getMission('m2-wrong-port')!;
    let state = createEngineState(mission, baseRack);
    expect(state.snapshot.complete).toBe(false);

    state = reduce(state, {
      type: 'DISCONNECT_PORT',
      port: { deviceId: 'panel-a', portId: 'panel-3' },
    });
    state = reduce(state, {
      type: 'CONNECT',
      a: { deviceId: 'panel-a', portId: 'panel-1' },
      b: { deviceId: 'tor-1', portId: 'sw-1' },
    });
    expect(state.snapshot.complete).toBe(true);
  });

  it('M3: VLAN mismatch on load, fixed by moving to sw-7', () => {
    const mission = getMission('m3-vlan-trap')!;
    let state = createEngineState(mission, baseRack);
    expect(state.snapshot.lastTip?.code).toBe('VLAN_MISMATCH');

    state = reduce(state, {
      type: 'DISCONNECT_PORT',
      port: { deviceId: 'server-07', portId: 'nic-1' },
    });
    state = reduce(state, {
      type: 'CONNECT',
      a: { deviceId: 'tor-1', portId: 'sw-7' },
      b: { deviceId: 'server-07', portId: 'nic-1' },
    });
    expect(state.snapshot.complete).toBe(true);
  });

  it('M4: admin-down port stays dark until moved to Gi1/0/6', () => {
    const mission = getMission('m4-admin-down')!;
    let state = createEngineState(mission, baseRack);
    expect(state.snapshot.lastTip?.code).toBe('ADMIN_DOWN');
    expect(
      state.snapshot.linkTable[portKey({ deviceId: 'tor-1', portId: 'sw-4' })],
    ).toBe('down');

    state = reduce(state, {
      type: 'DISCONNECT_PORT',
      port: { deviceId: 'tor-1', portId: 'sw-4' },
    });
    state = reduce(state, {
      type: 'CONNECT',
      a: { deviceId: 'panel-a', portId: 'panel-4' },
      b: { deviceId: 'tor-1', portId: 'sw-6' },
    });
    expect(state.snapshot.complete).toBe(true);
  });

  it('M5: migrates panel path to A-08/Gi1/0/8 and clears old ports', () => {
    const mission = getMission('m5-change-window')!;
    let state = createEngineState(mission, baseRack);

    state = reduce(state, {
      type: 'DISCONNECT_PORT',
      port: { deviceId: 'panel-a', portId: 'panel-1' },
    });
    state = reduce(state, {
      type: 'CONNECT',
      a: { deviceId: 'panel-a', portId: 'panel-8' },
      b: { deviceId: 'tor-1', portId: 'sw-8' },
    });
    expect(state.snapshot.complete).toBe(true);
  });

  it('M8: dual servers on VLAN 10 and VLAN 20', () => {
    const mission = getMission('m8-dual-servers')!;
    let state = createEngineState(mission, baseRack);
    state = reduce(state, {
      type: 'CONNECT',
      a: { deviceId: 'panel-a', portId: 'panel-1' },
      b: { deviceId: 'tor-1', portId: 'sw-1' },
    });
    state = reduce(state, {
      type: 'CONNECT',
      a: { deviceId: 'tor-1', portId: 'sw-5' },
      b: { deviceId: 'server-01', portId: 'nic-1' },
    });
    state = reduce(state, {
      type: 'CONNECT',
      a: { deviceId: 'panel-a', portId: 'panel-2' },
      b: { deviceId: 'tor-1', portId: 'sw-3' },
    });
    state = reduce(state, {
      type: 'CONNECT',
      a: { deviceId: 'tor-1', portId: 'sw-7' },
      b: { deviceId: 'server-07', portId: 'nic-1' },
    });
    expect(state.snapshot.complete).toBe(true);
  });
});

describe('PatchLab engine — fiber / power / console', () => {
  it('M6: fiber patch lights OM4 path', () => {
    const mission = getMission('m6-fiber-first')!;
    let state = createEngineState(mission, baseRack);
    state = reduce(state, {
      type: 'CONNECT',
      a: { deviceId: 'fiber-tray', portId: 'f-1' },
      b: { deviceId: 'tor-sfp', portId: 'sfp-1' },
    });
    expect(state.snapshot.complete).toBe(true);
  });

  it('M7: replaces copper-on-fiber with OM4 and lights SERVER-09', () => {
    const mission = getMission('m7-wrong-media')!;
    let state = createEngineState(mission, baseRack);
    expect(state.snapshot.lastTip?.code).toBe('MEDIA_MISMATCH');

    state = reduce(state, {
      type: 'DISCONNECT_PORT',
      port: { deviceId: 'fiber-tray', portId: 'f-2' },
    });
    state = reduce(state, {
      type: 'CONNECT',
      a: { deviceId: 'fiber-tray', portId: 'f-2' },
      b: { deviceId: 'tor-sfp', portId: 'sfp-2' },
    });
    state = reduce(state, {
      type: 'CONNECT',
      a: { deviceId: 'server-09', portId: 'nic-f' },
      b: { deviceId: 'tor-sfp', portId: 'sfp-4' },
    });
    expect(state.snapshot.complete).toBe(true);
  });

  it('M9: unpowered gear stays dark until PDU cords land', () => {
    const mission = getMission('m9-power-up')!;
    let state = createEngineState(mission, baseRack);
    expect(state.snapshot.poweredDevices['tor-1']).toBe(false);
    expect(state.snapshot.poweredDevices['server-01']).toBe(false);

    state = reduce(state, {
      type: 'CONNECT',
      a: { deviceId: 'panel-a', portId: 'panel-1' },
      b: { deviceId: 'tor-1', portId: 'sw-1' },
    });
    expect(
      state.snapshot.linkTable[portKey({ deviceId: 'tor-1', portId: 'sw-1' })],
    ).toBe('down');
    expect(state.snapshot.lastTip?.code).toBe('NO_POWER');

    state = reduce(state, {
      type: 'CONNECT',
      a: { deviceId: 'tor-1', portId: 'sw-psu' },
      b: { deviceId: 'pdu-a', portId: 'out-1' },
    });
    state = reduce(state, {
      type: 'CONNECT',
      a: { deviceId: 'server-01', portId: 'srv1-psu' },
      b: { deviceId: 'pdu-a', portId: 'out-2' },
    });
    expect(state.snapshot.poweredDevices['tor-1']).toBe(true);

    state = reduce(state, {
      type: 'CONNECT',
      a: { deviceId: 'tor-1', portId: 'sw-5' },
      b: { deviceId: 'server-01', portId: 'nic-1' },
    });
    expect(state.snapshot.complete).toBe(true);
  });

  it('M10: requires the exact console endpoint and management gateway', () => {
    const mission = getMission('m10-console-ip')!;
    let state = createEngineState(mission, baseRack);
    state = reduce(state, {
      type: 'CONNECT',
      a: { deviceId: 'con-srv', portId: 'tty2' },
      b: { deviceId: 'tor-1', portId: 'sw-con' },
    });
    state = reduce(state, {
      type: 'SET_IP',
      port: { deviceId: 'tor-1', portId: 'sw-1' },
      address: '10.10.10.2',
      prefix: 24,
    });
    expect(state.snapshot.complete).toBe(false);

    state = reduce(state, {
      type: 'DISCONNECT_PORT',
      port: { deviceId: 'tor-1', portId: 'sw-con' },
    });
    state = reduce(state, {
      type: 'CONNECT',
      a: { deviceId: 'con-srv', portId: 'tty1' },
      b: { deviceId: 'tor-1', portId: 'sw-con' },
    });
    expect(state.snapshot.consoleAttached['tor-1']).toBe(true);
    expect(state.snapshot.complete).toBe(false);

    state = reduce(state, {
      type: 'SET_IP',
      port: { deviceId: 'tor-1', portId: 'sw-1' },
      address: '10.10.10.2',
      prefix: 24,
      gateway: '10.10.10.1',
    });
    expect(state.snapshot.complete).toBe(true);
  });
});

describe('PatchLab engine — logic / security / switching', () => {
  it('M11: same-subnet ping after addressing', () => {
    const mission = getMission('m11-subnet-ping')!;
    let state = createEngineState(mission, baseRack);
    state = reduce(state, {
      type: 'CONNECT',
      a: { deviceId: 'tor-1', portId: 'sw-5' },
      b: { deviceId: 'server-01', portId: 'nic-1' },
    });
    state = reduce(state, {
      type: 'SET_IP',
      port: { deviceId: 'server-01', portId: 'nic-1' },
      address: '10.10.10.10',
      prefix: 24,
      gateway: '10.10.10.1',
    });
    expect(state.snapshot.complete).toBe(true);
  });

  it('M12: firewall permit unlocks ping', () => {
    const mission = getMission('m12-firewall-acl')!;
    let state = createEngineState(mission, baseRack);
    state = reduce(state, {
      type: 'PING',
      fromDeviceId: 'server-01',
      toDeviceId: 'fw-1',
    });
    expect(state.snapshot.lastTip?.code).toBe('PING_FAIL');

    state = reduce(state, {
      type: 'UPSERT_FIREWALL_RULE',
      deviceId: 'fw-1',
      rule: {
        id: 'permit-lan',
        action: 'permit',
        srcCidr: '10.10.10.0/24',
        dstCidr: '10.10.10.0/24',
        enabled: true,
      },
    });
    expect(state.snapshot.complete).toBe(true);
  });

  it('M13: set access VLAN then patch SERVER-07', () => {
    const mission = getMission('m13-access-vlan')!;
    let state = createEngineState(mission, baseRack);

    // Wrong VLAN keeps link down
    state = reduce(state, {
      type: 'CONNECT',
      a: { deviceId: 'tor-1', portId: 'sw-6' },
      b: { deviceId: 'server-07', portId: 'nic-1' },
    });
    expect(state.snapshot.lastTip?.code).toBe('VLAN_MISMATCH');
    expect(state.snapshot.complete).toBe(false);

    state = reduce(state, {
      type: 'DISCONNECT_PORT',
      port: { deviceId: 'server-07', portId: 'nic-1' },
    });
    state = reduce(state, {
      type: 'SET_VLAN',
      port: { deviceId: 'tor-1', portId: 'sw-6' },
      vlanId: 20,
    });
    state = reduce(state, {
      type: 'CONNECT',
      a: { deviceId: 'tor-1', portId: 'sw-6' },
      b: { deviceId: 'server-07', portId: 'nic-1' },
    });
    expect(state.snapshot.complete).toBe(true);
  });

  it('M13 alternate: CYCLE_VLAN reaches VLAN 20', () => {
    const mission = getMission('m13-access-vlan')!;
    let state = createEngineState(mission, baseRack);
    state = reduce(state, {
      type: 'CYCLE_VLAN',
      port: { deviceId: 'tor-1', portId: 'sw-6' },
    });
    const sw6 = state.snapshot.rack.devices
      .find((d) => d.id === 'tor-1')!
      .ports.find((p) => p.id === 'sw-6');
    expect(sw6?.vlanId).toBe(20);

    state = reduce(state, {
      type: 'CONNECT',
      a: { deviceId: 'tor-1', portId: 'sw-6' },
      b: { deviceId: 'server-07', portId: 'nic-1' },
    });
    expect(state.snapshot.complete).toBe(true);
  });

  it('M14: same-subnet hosts stay isolated across access VLANs', () => {
    const mission = getMission('m14-vlan-isolation')!;
    let state = createEngineState(mission, baseRack);
    state = reduce(state, {
      type: 'CONNECT',
      a: { deviceId: 'tor-1', portId: 'sw-5' },
      b: { deviceId: 'server-01', portId: 'nic-1' },
    });
    state = reduce(state, {
      type: 'CONNECT',
      a: { deviceId: 'tor-1', portId: 'sw-7' },
      b: { deviceId: 'server-07', portId: 'nic-1' },
    });
    state = reduce(state, {
      type: 'SET_IP',
      port: { deviceId: 'server-01', portId: 'nic-1' },
      address: '10.10.10.10',
      prefix: 24,
    });
    state = reduce(state, {
      type: 'SET_IP',
      port: { deviceId: 'server-07', portId: 'nic-1' },
      address: '10.10.10.20',
      prefix: 24,
    });
    const ping = evaluatePing(state.snapshot.rack, 'server-01', 'server-07');
    expect(ping.ok).toBe(false);
    expect(ping.detail).toMatch(/Layer-2|VLAN/i);
    expect(state.snapshot.complete).toBe(true);

    state = reduce(state, {
      type: 'SET_VLAN',
      port: { deviceId: 'server-07', portId: 'nic-1' },
      vlanId: 10,
    });
    state = reduce(state, {
      type: 'SET_VLAN',
      port: { deviceId: 'tor-1', portId: 'sw-7' },
      vlanId: 10,
    });
    expect(evaluatePing(state.snapshot.rack, 'server-01', 'server-07').ok).toBe(
      true,
    );
  });

  it('M15: gateway + LAN→WAN permit reaches ISP peer', () => {
    const mission = getMission('m15-default-gateway')!;
    let state = createEngineState(mission, baseRack);
    state = reduce(state, {
      type: 'CONNECT',
      a: { deviceId: 'tor-1', portId: 'sw-5' },
      b: { deviceId: 'server-01', portId: 'nic-1' },
    });
    state = reduce(state, {
      type: 'CONNECT',
      a: { deviceId: 'fw-1', portId: 'fw-lan' },
      b: { deviceId: 'tor-1', portId: 'sw-2' },
    });
    state = reduce(state, {
      type: 'SET_IP',
      port: { deviceId: 'server-01', portId: 'nic-1' },
      address: '10.10.10.10',
      prefix: 24,
      gateway: '10.10.10.1',
    });

    // Without permit, routed ping fails
    let ping = evaluatePing(state.snapshot.rack, 'server-01', 'wan-peer');
    expect(ping.ok).toBe(false);

    state = reduce(state, {
      type: 'UPSERT_FIREWALL_RULE',
      deviceId: 'fw-1',
      rule: {
        id: 'permit-lan-wan',
        action: 'permit',
        srcCidr: '10.10.10.0/24',
        dstCidr: '203.0.113.0/30',
        enabled: true,
      },
    });
    ping = evaluatePing(state.snapshot.rack, 'server-01', 'wan-peer');
    expect(ping.ok).toBe(true);
    expect(state.snapshot.complete).toBe(true);
  });

  it('M15 fails without default gateway', () => {
    const mission = getMission('m15-default-gateway')!;
    let state = createEngineState(mission, baseRack);
    state = reduce(state, {
      type: 'CONNECT',
      a: { deviceId: 'tor-1', portId: 'sw-5' },
      b: { deviceId: 'server-01', portId: 'nic-1' },
    });
    state = reduce(state, {
      type: 'CONNECT',
      a: { deviceId: 'fw-1', portId: 'fw-lan' },
      b: { deviceId: 'tor-1', portId: 'sw-2' },
    });
    state = reduce(state, {
      type: 'SET_IP',
      port: { deviceId: 'server-01', portId: 'nic-1' },
      address: '10.10.10.10',
      prefix: 24,
    });
    state = reduce(state, {
      type: 'UPSERT_FIREWALL_RULE',
      deviceId: 'fw-1',
      rule: {
        id: 'permit-lan-wan',
        action: 'permit',
        srcCidr: '10.10.10.0/24',
        dstCidr: '203.0.113.0/30',
        enabled: true,
      },
    });
    const ping = evaluatePing(state.snapshot.rack, 'server-01', 'wan-peer');
    expect(ping.ok).toBe(false);
    expect(ping.detail).toMatch(/no default gateway/i);
    expect(state.snapshot.complete).toBe(false);
  });

  it('M16: trunk mode + uplink to firewall LAN', () => {
    const mission = getMission('m16-trunk-uplink')!;
    let state = createEngineState(mission, baseRack);
    state = reduce(state, {
      type: 'SET_PORT_MODE',
      port: { deviceId: 'tor-1', portId: 'sw-8' },
      mode: 'trunk',
    });
    const sw8 = state.snapshot.rack.devices
      .find((d) => d.id === 'tor-1')!
      .ports.find((p) => p.id === 'sw-8');
    expect(sw8?.mode).toBe('trunk');

    state = reduce(state, {
      type: 'CONNECT',
      a: { deviceId: 'tor-1', portId: 'sw-8' },
      b: { deviceId: 'fw-1', portId: 'fw-lan' },
    });
    expect(state.snapshot.complete).toBe(true);
  });

  it('M16 trunk relaxes VLAN mismatch on uplink', () => {
    const mission = getMission('m16-trunk-uplink')!;
    let state = createEngineState(mission, baseRack);
    // Put access VLAN 20 on sw-8, then trunk — should still link to FW VLAN 10
    state = reduce(state, {
      type: 'SET_VLAN',
      port: { deviceId: 'tor-1', portId: 'sw-8' },
      vlanId: 20,
    });
    state = reduce(state, {
      type: 'CONNECT',
      a: { deviceId: 'tor-1', portId: 'sw-8' },
      b: { deviceId: 'fw-1', portId: 'fw-lan' },
    });
    expect(state.snapshot.lastTip?.code).toBe('VLAN_MISMATCH');

    state = reduce(state, {
      type: 'DISCONNECT_PORT',
      port: { deviceId: 'tor-1', portId: 'sw-8' },
    });
    state = reduce(state, {
      type: 'SET_PORT_MODE',
      port: { deviceId: 'tor-1', portId: 'sw-8' },
      mode: 'trunk',
    });
    state = reduce(state, {
      type: 'CONNECT',
      a: { deviceId: 'tor-1', portId: 'sw-8' },
      b: { deviceId: 'fw-1', portId: 'fw-lan' },
    });
    expect(
      state.snapshot.linkTable[portKey({ deviceId: 'tor-1', portId: 'sw-8' })],
    ).toBe('up');
  });

  it('M17: static NAT + WAN permit unlocks inbound ping', () => {
    const mission = getMission('m17-static-nat')!;
    let state = createEngineState(mission, baseRack);
    state = reduce(state, {
      type: 'PING_IP',
      fromDeviceId: 'wan-peer',
      targetIp: '203.0.113.10',
    });
    expect(state.snapshot.lastTip?.code).toBe('PING_FAIL');

    state = reduce(state, {
      type: 'SET_NAT',
      deviceId: 'fw-1',
      insideIp: '10.10.10.10',
      outsideIp: '203.0.113.10',
    });
    // NAT alone is not enough while deny remains first-match
    expect(
      evaluatePing(state.snapshot.rack, 'wan-peer', 'server-01').ok,
    ).toBe(false);

    state = reduce(state, {
      type: 'UPSERT_FIREWALL_RULE',
      deviceId: 'fw-1',
      rule: {
        id: 'permit-wan-lan',
        action: 'permit',
        srcCidr: '203.0.113.0/30',
        dstCidr: '10.10.10.0/24',
        enabled: true,
      },
    });
    const okPing = evaluatePing(state.snapshot.rack, 'wan-peer', 'server-01');
    expect(okPing.ok).toBe(true);
    expect(okPing.detail).toMatch(/NAT/i);
    expect(state.snapshot.complete).toBe(false);

    state = reduce(state, {
      type: 'PING_IP',
      fromDeviceId: 'wan-peer',
      targetIp: '203.0.113.10',
    });
    expect(state.snapshot.lastPing?.detail).toMatch(/203\.0\.113\.10 translated/i);
    expect(state.snapshot.complete).toBe(true);
  });

  it('M17 requires NAT for WAN→LAN even when ACL permits', () => {
    const mission = getMission('m17-static-nat')!;
    let state = createEngineState(mission, baseRack);
    state = reduce(state, {
      type: 'UPSERT_FIREWALL_RULE',
      deviceId: 'fw-1',
      rule: {
        id: 'permit-wan-lan',
        action: 'permit',
        srcCidr: '203.0.113.0/30',
        dstCidr: '10.10.10.0/24',
        enabled: true,
      },
    });
    const ping = evaluatePing(state.snapshot.rack, 'wan-peer', 'server-01');
    expect(ping.ok).toBe(false);
    expect(ping.detail).toMatch(/no static NAT/i);
  });

  it('M18: specific deny blocks one host, other still reaches WAN', () => {
    const mission = getMission('m18-deny-host')!;
    let state = createEngineState(mission, baseRack);
    expect(evaluatePing(state.snapshot.rack, 'server-01', 'wan-peer').ok).toBe(
      true,
    );
    expect(evaluatePing(state.snapshot.rack, 'server-07', 'wan-peer').ok).toBe(
      true,
    );
    expect(state.snapshot.complete).toBe(false);

    state = reduce(state, {
      type: 'UPSERT_FIREWALL_RULE',
      deviceId: 'fw-1',
      rule: {
        id: 'deny-20',
        action: 'deny',
        srcCidr: '10.10.10.20/32',
        dstCidr: '203.0.113.0/30',
        enabled: true,
      },
    });
    expect(evaluatePing(state.snapshot.rack, 'server-07', 'wan-peer').ok).toBe(
      false,
    );
    expect(evaluatePing(state.snapshot.rack, 'server-01', 'wan-peer').ok).toBe(
      true,
    );
    expect(state.snapshot.complete).toBe(true);
  });
});

describe('engine helpers', () => {
  it('REQUEST_HINT provides a ghost path for unmet link goals', () => {
    const mission = getMission('m1-first-lights')!;
    let state = createEngineState(mission, baseRack);
    state = reduce(state, { type: 'REQUEST_HINT' });
    expect(state.snapshot.lastTip?.code).toBe('HINT');
    expect(state.hintLevel).toBe(1);
    expect(state.snapshot.hintGhost).toBeNull();

    state = reduce(state, { type: 'REQUEST_HINT' });
    state = reduce(state, { type: 'REQUEST_HINT' });
    state = reduce(state, { type: 'REQUEST_HINT' });
    expect(state.hintLevel).toBe(4);
    expect(state.snapshot.hintGhost?.a.portId).toBe('panel-1');
  });

  it('rejects self-patch and busy-port connects', () => {
    const mission = getMission('m1-first-lights')!;
    let state = createEngineState(mission, baseRack);
    state = reduce(state, {
      type: 'CONNECT',
      a: { deviceId: 'panel-a', portId: 'panel-1' },
      b: { deviceId: 'panel-a', portId: 'panel-1' },
    });
    expect(state.snapshot.lastTip?.code).toBe('INVALID_PORTS');

    state = reduce(state, {
      type: 'CONNECT',
      a: { deviceId: 'panel-a', portId: 'panel-1' },
      b: { deviceId: 'tor-1', portId: 'sw-1' },
    });
    state = reduce(state, {
      type: 'CONNECT',
      a: { deviceId: 'panel-a', portId: 'panel-1' },
      b: { deviceId: 'tor-1', portId: 'sw-2' },
    });
    expect(state.snapshot.lastTip?.code).toBe('PORT_BUSY');
  });

  it('TOGGLE_ADMIN flips a switchport and SET_IP rejects invalid hosts', () => {
    const mission = getMission('m1-first-lights')!;
    let state = createEngineState(mission, baseRack);
    state = reduce(state, {
      type: 'TOGGLE_ADMIN',
      port: { deviceId: 'tor-1', portId: 'sw-1' },
    });
    const sw1 = state.snapshot.rack.devices
      .find((d) => d.id === 'tor-1')!
      .ports.find((p) => p.id === 'sw-1');
    expect(sw1?.admin).toBe('down');

    state = reduce(state, {
      type: 'SET_IP',
      port: { deviceId: 'server-01', portId: 'nic-1' },
      address: '10.10.10.0',
      prefix: 24,
    });
    expect(state.snapshot.lastTip?.level).toBe('error');
    expect(state.snapshot.lastTip?.message).toMatch(/Invalid host IP/i);
    expect(
      state.snapshot.rack.devices
        .find((d) => d.id === 'server-01')!
        .ports.find((p) => p.id === 'nic-1')?.ip,
    ).toBeUndefined();
  });

  it('RESET restores mission initial rack', () => {
    const mission = getMission('m2-wrong-port')!;
    let state = createEngineState(mission, baseRack);
    state = reduce(state, {
      type: 'DISCONNECT_PORT',
      port: { deviceId: 'panel-a', portId: 'panel-3' },
    });
    expect(state.snapshot.rack.cables.some((c) => c.id === 'c-pre-1')).toBe(
      false,
    );
    state = reduce(state, { type: 'RESET' });
    expect(state.snapshot.rack.cables.some((c) => c.id === 'c-pre-1')).toBe(
      true,
    );
  });
});

describe('NetPractice-inspired routing lessons', () => {
  it('M19: fixing broken host IP unlocks ping', () => {
    const mission = getMission('m19-broken-address')!;
    let state = createEngineState(mission, baseRack);
    expect(evaluatePing(state.snapshot.rack, 'server-01', 'fw-1').ok).toBe(
      false,
    );
    state = reduce(state, {
      type: 'SET_IP',
      port: { deviceId: 'server-01', portId: 'nic-1' },
      address: '10.10.10.10',
      prefix: 24,
      gateway: '10.10.10.1',
    });
    expect(state.snapshot.complete).toBe(true);
  });

  it('M20: wrong mask blocks gateway path until /24', () => {
    const mission = getMission('m20-mask-trap')!;
    let state = createEngineState(mission, baseRack);
    const bad = evaluatePing(state.snapshot.rack, 'server-01', 'fw-1');
    expect(bad.ok).toBe(false);
    expect(bad.detail).toMatch(/prefix/i);

    state = reduce(state, {
      type: 'SET_IP',
      port: { deviceId: 'server-01', portId: 'nic-1' },
      address: '10.10.10.10',
      prefix: 24,
      gateway: '10.10.10.1',
    });
    expect(state.snapshot.complete).toBe(true);
  });

  it('M21: inter-VLAN routing via dual FW LAN interfaces', () => {
    const mission = getMission('m21-inter-vlan')!;
    let state = createEngineState(mission, baseRack);
    state = reduce(state, {
      type: 'CONNECT',
      a: { deviceId: 'tor-1', portId: 'sw-5' },
      b: { deviceId: 'server-01', portId: 'nic-1' },
    });
    state = reduce(state, {
      type: 'CONNECT',
      a: { deviceId: 'tor-1', portId: 'sw-7' },
      b: { deviceId: 'server-07', portId: 'nic-1' },
    });
    state = reduce(state, {
      type: 'CONNECT',
      a: { deviceId: 'fw-1', portId: 'fw-lan' },
      b: { deviceId: 'tor-1', portId: 'sw-2' },
    });
    state = reduce(state, {
      type: 'CONNECT',
      a: { deviceId: 'fw-1', portId: 'fw-lan20' },
      b: { deviceId: 'tor-1', portId: 'sw-8' },
    });
    state = reduce(state, {
      type: 'SET_IP',
      port: { deviceId: 'server-01', portId: 'nic-1' },
      address: '10.10.10.10',
      prefix: 24,
      gateway: '10.10.10.1',
    });
    state = reduce(state, {
      type: 'SET_IP',
      port: { deviceId: 'server-07', portId: 'nic-1' },
      address: '10.10.20.10',
      prefix: 24,
      gateway: '10.10.10.1',
    });
    expect(evaluatePing(state.snapshot.rack, 'server-01', 'server-07').ok).toBe(
      false,
    );

    state = reduce(state, {
      type: 'SET_IP',
      port: { deviceId: 'server-07', portId: 'nic-1' },
      address: '10.10.20.10',
      prefix: 24,
      gateway: '10.10.20.1',
    });
    expect(state.snapshot.complete).toBe(true);
  });

  it('M22: static route + permit reaches BRANCH-01', () => {
    const mission = getMission('m22-static-route')!;
    let state = createEngineState(mission, baseRack);
    expect(evaluatePing(state.snapshot.rack, 'server-01', 'branch-01').ok).toBe(
      false,
    );

    state = reduce(state, {
      type: 'SET_ROUTE',
      deviceId: 'fw-1',
      destCidr: '198.51.100.0/24',
      nextHop: '203.0.113.2',
    });
    state = reduce(state, {
      type: 'UPSERT_FIREWALL_RULE',
      deviceId: 'fw-1',
      rule: {
        id: 'permit-branch',
        action: 'permit',
        srcCidr: '10.10.10.0/24',
        dstCidr: '198.51.100.0/24',
        enabled: true,
      },
    });
    const ping = evaluatePing(state.snapshot.rack, 'server-01', 'branch-01');
    expect(ping.ok).toBe(true);
    expect(ping.detail).toMatch(/route/i);
    expect(state.snapshot.complete).toBe(true);
  });

  it('M23: toggle admin (no shutdown) brings Gi1/0/4 up', () => {
    const mission = getMission('m23-no-shutdown')!;
    let state = createEngineState(mission, baseRack);
    expect(
      state.snapshot.linkTable[
        portKey({ deviceId: 'tor-1', portId: 'sw-4' })
      ],
    ).toBe('down');

    state = reduce(state, {
      type: 'TOGGLE_ADMIN',
      port: { deviceId: 'tor-1', portId: 'sw-4' },
    });
    expect(state.snapshot.complete).toBe(true);
    expect(
      state.snapshot.linkTable[
        portKey({ deviceId: 'panel-a', portId: 'panel-4' })
      ],
    ).toBe('up');
  });

  it('M24: wrong gateway blocks WAN until fixed', () => {
    const mission = getMission('m24-wrong-gateway')!;
    let state = createEngineState(mission, baseRack);
    expect(evaluatePing(state.snapshot.rack, 'server-01', 'wan-peer').ok).toBe(
      false,
    );

    state = reduce(state, {
      type: 'SET_IP',
      port: { deviceId: 'server-01', portId: 'nic-1' },
      address: '10.10.10.10',
      prefix: 24,
      gateway: '10.10.10.1',
    });
    expect(evaluatePing(state.snapshot.rack, 'server-01', 'wan-peer').ok).toBe(
      true,
    );
    expect(state.snapshot.complete).toBe(true);
  });

  it('M25: host-route override beats poisoned /32', () => {
    const mission = getMission('m25-host-route')!;
    let state = createEngineState(mission, baseRack);
    expect(evaluatePing(state.snapshot.rack, 'server-01', 'branch-01').ok).toBe(
      false,
    );

    state = reduce(state, {
      type: 'SET_ROUTE',
      deviceId: 'fw-1',
      destCidr: '198.51.100.10/32',
      nextHop: '203.0.113.2',
    });
    const fw = state.snapshot.rack.devices.find((d) => d.id === 'fw-1')!;
    const hostRoutes = (fw.routes ?? []).filter(
      (r) => r.destCidr === '198.51.100.10/32',
    );
    expect(hostRoutes).toHaveLength(1);
    expect(hostRoutes[0]!.nextHop).toBe('203.0.113.2');
    expect(evaluatePing(state.snapshot.rack, 'server-01', 'branch-01').ok).toBe(
      true,
    );
    expect(state.snapshot.complete).toBe(true);
  });

  it('M26: deny host to BRANCH while peer still reaches', () => {
    const mission = getMission('m26-deny-branch')!;
    let state = createEngineState(mission, baseRack);
    expect(evaluatePing(state.snapshot.rack, 'server-01', 'branch-01').ok).toBe(
      true,
    );
    expect(evaluatePing(state.snapshot.rack, 'server-07', 'branch-01').ok).toBe(
      true,
    );

    state = reduce(state, {
      type: 'UPSERT_FIREWALL_RULE',
      deviceId: 'fw-1',
      rule: {
        id: 'deny-branch-host',
        action: 'deny',
        srcCidr: '10.10.10.20/32',
        dstCidr: '198.51.100.0/24',
        enabled: true,
      },
    });
    expect(evaluatePing(state.snapshot.rack, 'server-07', 'branch-01').ok).toBe(
      false,
    );
    expect(evaluatePing(state.snapshot.rack, 'server-01', 'branch-01').ok).toBe(
      true,
    );
    expect(state.snapshot.complete).toBe(true);
  });

  it('does not refund facility base cables into learner inventory', () => {
    const mission = getMission('m1-first-lights')!;
    let state = createEngineState(mission, baseRack);
    const before = state.snapshot.inventory.power_c13;
    state = reduce(state, {
      type: 'DISCONNECT_PORT',
      port: { deviceId: 'fw-1', portId: 'fw-psu' },
    });
    expect(state.snapshot.inventory.power_c13).toBe(before);
    expect(state.snapshot.lastTip?.message).toMatch(/facility/i);
  });

  it('rejects invalid ACL CIDRs', () => {
    const mission = getMission('m12-firewall-acl')!;
    let state = createEngineState(mission, baseRack);
    const before = state.wrongAttempts;
    state = reduce(state, {
      type: 'UPSERT_FIREWALL_RULE',
      deviceId: 'fw-1',
      rule: {
        id: 'bad',
        action: 'permit',
        srcCidr: 'not-a-cidr',
        dstCidr: '10.10.10.0/24',
        enabled: true,
      },
    });
    expect(state.wrongAttempts).toBe(before + 1);
    expect(state.snapshot.lastTip?.message).toMatch(/Invalid ACL/i);
    const fw = state.snapshot.rack.devices.find((d) => d.id === 'fw-1')!;
    expect(fw.firewallRules?.some((r) => r.id === 'bad')).toBe(false);
  });

  it('M27: console + host BRANCH exception', () => {
    const mission = getMission('m27-branch-exception')!;
    let state = createEngineState(mission, baseRack);
    expect(evaluatePing(state.snapshot.rack, 'server-01', 'branch-01').ok).toBe(
      false,
    );

    state = reduce(state, {
      type: 'CONNECT',
      a: { deviceId: 'con-srv', portId: 'tty2' },
      b: { deviceId: 'fw-1', portId: 'fw-con' },
    });
    state = reduce(state, {
      type: 'UPSERT_FIREWALL_RULE',
      deviceId: 'fw-1',
      rule: {
        id: 'host-exception',
        action: 'permit',
        srcCidr: '10.10.10.10/32',
        dstCidr: '198.51.100.10/32',
        enabled: true,
      },
    });
    expect(state.snapshot.consoleAttached['fw-1']).toBe(true);
    expect(evaluatePing(state.snapshot.rack, 'server-01', 'branch-01').ok).toBe(
      true,
    );
    expect(evaluatePing(state.snapshot.rack, 'server-07', 'branch-01').ok).toBe(
      false,
    );
    expect(state.snapshot.complete).toBe(true);
  });

  it('M28: fiber no-shutdown on Te1/0/3', () => {
    const mission = getMission('m28-fiber-no-shutdown')!;
    let state = createEngineState(mission, baseRack);
    expect(
      state.snapshot.linkTable[
        portKey({ deviceId: 'tor-sfp', portId: 'sfp-3' })
      ],
    ).toBe('down');

    state = reduce(state, {
      type: 'TOGGLE_ADMIN',
      port: { deviceId: 'tor-sfp', portId: 'sfp-3' },
    });
    expect(state.snapshot.complete).toBe(true);
  });

  it('M29: spare PDU outlets restore FW and SERVER-07', () => {
    const mission = getMission('m29-spare-pdu')!;
    let state = createEngineState(mission, baseRack);
    expect(state.snapshot.poweredDevices['fw-1']).toBe(false);
    expect(state.snapshot.poweredDevices['server-07']).toBe(false);

    state = reduce(state, {
      type: 'CONNECT',
      a: { deviceId: 'fw-1', portId: 'fw-psu' },
      b: { deviceId: 'pdu-a', portId: 'out-5' },
    });
    state = reduce(state, {
      type: 'CONNECT',
      a: { deviceId: 'server-07', portId: 'srv7-psu' },
      b: { deviceId: 'pdu-a', portId: 'out-6' },
    });
    expect(state.snapshot.poweredDevices['fw-1']).toBe(true);
    expect(state.snapshot.poweredDevices['server-07']).toBe(true);
    expect(evaluatePing(state.snapshot.rack, 'server-07', 'fw-1').ok).toBe(true);
    expect(state.snapshot.complete).toBe(true);
  });

  it('M30: floating static failover to AD10 backup', () => {
    const mission = getMission('m30-floating-static')!;
    let state = createEngineState(mission, baseRack);
    expect(evaluatePing(state.snapshot.rack, 'server-01', 'branch-01').ok).toBe(
      false,
    );
    state = reduce(state, {
      type: 'SET_ROUTE',
      deviceId: 'fw-1',
      destCidr: '198.51.100.0/24',
      nextHop: '203.0.113.2',
      adminDistance: 10,
    });
    const ping = evaluatePing(state.snapshot.rack, 'server-01', 'branch-01');
    expect(ping.ok).toBe(true);
    expect(ping.detail).toMatch(/AD10/i);
    expect(state.snapshot.complete).toBe(true);
  });

  it('M31: PAT overload required for LAN→WAN', () => {
    const mission = getMission('m31-pat-overload')!;
    let state = createEngineState(mission, baseRack);
    expect(evaluatePing(state.snapshot.rack, 'server-01', 'wan-peer').ok).toBe(
      false,
    );
    state = reduce(state, {
      type: 'SET_PAT',
      deviceId: 'fw-1',
      insideCidr: '10.10.10.0/24',
      outsideIp: '203.0.113.1',
    });
    expect(evaluatePing(state.snapshot.rack, 'server-01', 'wan-peer').ok).toBe(
      true,
    );
    expect(state.snapshot.complete).toBe(true);
  });

  it('M32: traceroute succeeds after route + permit', () => {
    const mission = getMission('m32-traceroute')!;
    let state = createEngineState(mission, baseRack);
    expect(
      evaluateTraceroute(state.snapshot.rack, 'server-01', 'branch-01').ok,
    ).toBe(false);
    state = reduce(state, {
      type: 'SET_ROUTE',
      deviceId: 'fw-1',
      destCidr: '198.51.100.0/24',
      nextHop: '203.0.113.2',
    });
    state = reduce(state, {
      type: 'UPSERT_FIREWALL_RULE',
      deviceId: 'fw-1',
      rule: {
        id: 'permit-branch',
        action: 'permit',
        srcCidr: '10.10.10.0/24',
        dstCidr: '198.51.100.0/24',
        enabled: true,
      },
    });
    expect(state.snapshot.complete).toBe(false);
    state = reduce(state, {
      type: 'TRACEROUTE',
      fromDeviceId: 'server-01',
      toDeviceId: 'branch-01',
    });
    expect(state.snapshot.lastTrace?.ok).toBe(true);
    expect(state.snapshot.complete).toBe(true);
  });

  it('rejects invalid VLAN, static NAT, and route distance intents', () => {
    const mission = getMission('m17-static-nat')!;
    let state = createEngineState(mission, baseRack);
    const rackBefore = state.snapshot.rack;

    state = reduce(state, {
      type: 'SET_VLAN',
      port: { deviceId: 'pdu-a', portId: 'out-1' },
      vlanId: 4095,
    });
    expect(state.snapshot.rack).toBe(rackBefore);
    expect(state.snapshot.lastTip?.level).toBe('error');

    state = reduce(state, {
      type: 'SET_NAT',
      deviceId: 'fw-1',
      insideIp: 'not-an-ip',
      outsideIp: '203.0.113.10',
    });
    expect(
      state.snapshot.rack.devices.find((d) => d.id === 'fw-1')?.natRules,
    ).toEqual(
      rackBefore.devices.find((d) => d.id === 'fw-1')?.natRules,
    );
    expect(state.snapshot.lastTip?.level).toBe('error');

    state = reduce(state, {
      type: 'SET_ROUTE',
      deviceId: 'fw-1',
      destCidr: '198.51.100.0/24',
      nextHop: '203.0.113.2',
      adminDistance: 0,
    });
    expect(state.snapshot.lastTip?.level).toBe('error');
  });

  it('traceroute agrees with ping on ACL-blocked connected path', () => {
    const mission = getMission('m12-firewall-acl')!;
    let state = createEngineState(mission, baseRack);
    // Pre-mission rack often already has LAN IPs; force a deny and ensure
    // traceroute does not report success when ping would fail.
    state = reduce(state, {
      type: 'UPSERT_FIREWALL_RULE',
      deviceId: 'fw-1',
      rule: {
        id: 'deny-all-lan',
        action: 'deny',
        srcCidr: '10.10.10.0/24',
        dstCidr: '10.10.10.0/24',
        enabled: true,
      },
    });
    const ping = evaluatePing(state.snapshot.rack, 'server-01', 'fw-1');
    const trace = evaluateTraceroute(state.snapshot.rack, 'server-01', 'fw-1');
    expect(ping.ok).toBe(false);
    expect(trace.ok).toBe(false);
    expect(trace.detail).toMatch(/blocked|fail/i);
  });
});
