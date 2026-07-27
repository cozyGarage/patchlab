import { describe, expect, it } from 'vitest';
import {
  evaluateGoals,
  hintForGoal,
  isDevicePowered,
  resolvePair,
} from './linkSolver';
import type {
  Cable,
  Device,
  Goal,
  Port,
  RackState,
} from '../types/schema';

function copperPort(
  id: string,
  deviceId: string,
  label: string,
  extras: Partial<Port> = {},
): Port {
  return {
    id,
    deviceId,
    index: 0,
    label,
    media: 'copper_cat6',
    connector: 'rj45',
    kind: 'data',
    admin: 'up',
    role: 'network',
    vlanId: 10,
    ...extras,
  };
}

function fiberPort(
  id: string,
  deviceId: string,
  label: string,
): Port {
  return {
    id,
    deviceId,
    index: 0,
    label,
    media: 'fiber_om4',
    connector: 'lc',
    kind: 'data',
    admin: 'up',
    role: 'fiber',
  };
}

function powerPort(id: string, deviceId: string, label: string): Port {
  return {
    id,
    deviceId,
    index: 0,
    label,
    media: 'power_c13',
    connector: 'c13',
    kind: 'power',
    admin: 'up',
    role: 'power',
  };
}

describe('resolvePair', () => {
  it('faults on media mismatch', () => {
    const result = resolvePair(
      copperPort('a', 'sw', 'Gi1'),
      fiberPort('b', 'sfp', 'Te1'),
    );
    expect(result.status).toBe('fault');
    expect(result.tip?.code).toBe('MEDIA_MISMATCH');
  });

  it('faults when the cord media does not match the ports', () => {
    const a = copperPort('a', 'sw', 'Gi1');
    const b = copperPort('b', 'srv', 'eth0', { role: 'nic', accessVlan: 10, vlanId: undefined });
    const result = resolvePair(a, b, 'fiber_om4');
    expect(result.status).toBe('fault');
    expect(result.tip?.code).toBe('MEDIA_MISMATCH');
  });

  it('brings power and console pairs up without VLAN checks', () => {
    const power = resolvePair(
      powerPort('psu', 'sw', 'PSU'),
      powerPort('out1', 'pdu', 'OUT1'),
    );
    expect(power.status).toBe('up');
    expect(power.tip?.message).toMatch(/Power path/i);
  });

  it('reports no power for unpowered data devices', () => {
    const a = copperPort('a', 'sw', 'Gi1');
    const b = copperPort('b', 'srv', 'eth0', {
      role: 'nic',
      accessVlan: 10,
      vlanId: undefined,
    });
    const result = resolvePair(a, b, 'copper_cat6', false, true);
    expect(result.status).toBe('down');
    expect(result.tip?.code).toBe('NO_POWER');
  });

  it('reports admin-down and VLAN mismatch', () => {
    const down = resolvePair(
      copperPort('a', 'sw', 'Gi1', { admin: 'down' }),
      copperPort('b', 'srv', 'eth0', {
        role: 'nic',
        accessVlan: 10,
        vlanId: undefined,
      }),
    );
    expect(down.status).toBe('down');
    expect(down.tip?.code).toBe('ADMIN_DOWN');

    const vlan = resolvePair(
      copperPort('a', 'sw', 'Gi1', { vlanId: 10 }),
      copperPort('b', 'srv', 'eth0', {
        role: 'nic',
        accessVlan: 20,
        vlanId: undefined,
      }),
    );
    expect(vlan.status).toBe('down');
    expect(vlan.tip?.code).toBe('VLAN_MISMATCH');
  });

  it('skips VLAN mismatch on trunk ports', () => {
    const result = resolvePair(
      copperPort('a', 'sw', 'Gi8', { mode: 'trunk', vlanId: 10 }),
      copperPort('b', 'fw', 'LAN0', { vlanId: 20, role: 'lan', kind: 'lan' }),
    );
    expect(result.status).toBe('up');
  });
});

describe('isDevicePowered', () => {
  it('treats PDU, patch panel, and default-powered devices as live', () => {
    const rack: RackState = {
      devices: [
        {
          id: 'pdu',
          name: 'PDU',
          role: 'pdu',
          rackUnitStart: 1,
          heightU: 1,
          ports: [powerPort('out1', 'pdu', 'OUT1')],
        },
        {
          id: 'panel',
          name: 'Panel',
          role: 'patch_panel',
          rackUnitStart: 2,
          heightU: 1,
          ports: [copperPort('p1', 'panel', 'A-01', { role: 'panel' })],
        },
        {
          id: 'cloud',
          name: 'ISP',
          role: 'server',
          rackUnitStart: 3,
          heightU: 1,
          poweredByDefault: true,
          ports: [copperPort('wan', 'cloud', 'PEERING')],
        },
      ],
      cables: [],
    };
    expect(isDevicePowered(rack, 'pdu')).toBe(true);
    expect(isDevicePowered(rack, 'panel')).toBe(true);
    expect(isDevicePowered(rack, 'cloud')).toBe(true);
  });

  it('requires a power cord into a PDU outlet', () => {
    const switchDev: Device = {
      id: 'sw',
      name: 'ToR',
      role: 'switch',
      rackUnitStart: 10,
      heightU: 1,
      ports: [
        copperPort('sw1', 'sw', 'Gi1'),
        powerPort('psu', 'sw', 'PSU'),
      ],
    };
    const pdu: Device = {
      id: 'pdu',
      name: 'PDU',
      role: 'pdu',
      rackUnitStart: 1,
      heightU: 1,
      ports: [powerPort('out1', 'pdu', 'OUT1')],
    };
    const dark: RackState = { devices: [switchDev, pdu], cables: [] };
    expect(isDevicePowered(dark, 'sw')).toBe(false);

    const cable: Cable = {
      id: 'c1',
      media: 'power_c13',
      color: 'black',
      lengthM: 1,
      ends: [
        { deviceId: 'sw', portId: 'psu' },
        { deviceId: 'pdu', portId: 'out1' },
      ],
    };
    const lit: RackState = { devices: [switchDev, pdu], cables: [cable] };
    expect(isDevicePowered(lit, 'sw')).toBe(true);
  });
});

describe('evaluateGoals and hintForGoal', () => {
  it('evaluates a simple link_up goal against the link table', () => {
    const goal: Goal = {
      type: 'link_up',
      a: { deviceId: 'panel', portId: 'p1' },
      b: { deviceId: 'sw', portId: 'sw1' },
    };
    const unmet = evaluateGoals({ devices: [], cables: [] }, [goal], {});
    expect(unmet).toEqual([false]);

    const cable: Cable = {
      id: 'c-link',
      media: 'copper_cat6',
      color: 'blue',
      lengthM: 1,
      ends: [
        { deviceId: 'panel', portId: 'p1' },
        { deviceId: 'sw', portId: 'sw1' },
      ],
    };
    const met = evaluateGoals(
      { devices: [], cables: [cable] },
      [goal],
      {
        'panel::p1': 'up',
        'sw::sw1': 'up',
      },
    );
    expect(met).toEqual([true]);
  });

  it('returns useful default and goal-specific hints', () => {
    expect(hintForGoal(undefined).message).toMatch(/power, media, VLAN/i);
    expect(
      hintForGoal({
        type: 'iface_ip',
        port: { deviceId: 'sw', portId: 'sw-1' },
        address: '10.10.10.2',
        prefix: 24,
      }).message,
    ).toContain('10.10.10.2/24');
    expect(
      hintForGoal({
        type: 'link_up',
        a: { deviceId: 'a', portId: 'A-01' },
        b: { deviceId: 'b', portId: 'Gi1' },
      }).ghost,
    ).toEqual({
      a: { deviceId: 'a', portId: 'A-01' },
      b: { deviceId: 'b', portId: 'Gi1' },
    });
  });
});
