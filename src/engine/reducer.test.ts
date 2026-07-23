import { describe, expect, it } from 'vitest';
import { baseRack, getMission } from '../missions';
import { createEngineState, reduce } from './reducer';
import { scoreRun } from './scoring';
import { portKey } from '../types/schema';

describe('PatchLab engine', () => {
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

  it('M10: console + management IP', () => {
    const mission = getMission('m10-console-ip')!;
    let state = createEngineState(mission, baseRack);
    state = reduce(state, {
      type: 'CONNECT',
      a: { deviceId: 'con-srv', portId: 'tty1' },
      b: { deviceId: 'tor-1', portId: 'sw-con' },
    });
    expect(state.snapshot.consoleAttached['tor-1']).toBe(true);
    state = reduce(state, {
      type: 'SET_IP',
      port: { deviceId: 'tor-1', portId: 'sw-1' },
      address: '10.10.10.2',
      prefix: 24,
      gateway: '10.10.10.1',
    });
    expect(state.snapshot.complete).toBe(true);
  });

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

  it('REQUEST_HINT provides a ghost path for unmet link goals', () => {
    const mission = getMission('m1-first-lights')!;
    let state = createEngineState(mission, baseRack);
    state = reduce(state, { type: 'REQUEST_HINT' });
    expect(state.snapshot.lastTip?.code).toBe('HINT');
    expect(state.snapshot.hintGhost?.a.portId).toBe('panel-1');
  });

  it('M13: set access VLAN then patch SERVER-07', () => {
    const mission = getMission('m13-access-vlan')!;
    let state = createEngineState(mission, baseRack);
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

  it('M14: different VLANs stay isolated at L3', () => {
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
      address: '10.10.20.10',
      prefix: 24,
    });
    expect(state.snapshot.complete).toBe(true);
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
    expect(state.snapshot.complete).toBe(true);
  });

  it('M16: trunk mode + uplink to firewall LAN', () => {
    const mission = getMission('m16-trunk-uplink')!;
    let state = createEngineState(mission, baseRack);
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
    expect(state.snapshot.complete).toBe(true);
  });

  it('M17: static NAT + WAN permit unlocks inbound ping', () => {
    const mission = getMission('m17-static-nat')!;
    let state = createEngineState(mission, baseRack);
    state = reduce(state, {
      type: 'PING',
      fromDeviceId: 'wan-peer',
      toDeviceId: 'server-01',
    });
    expect(state.snapshot.lastTip?.code).toBe('PING_FAIL');

    state = reduce(state, {
      type: 'SET_NAT',
      deviceId: 'fw-1',
      insideIp: '10.10.10.10',
      outsideIp: '203.0.113.10',
    });
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
    expect(state.snapshot.complete).toBe(true);
  });

  it('M18: specific deny blocks one host, other still reaches WAN', () => {
    const mission = getMission('m18-deny-host')!;
    let state = createEngineState(mission, baseRack);
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
    expect(state.snapshot.complete).toBe(true);
  });
});
