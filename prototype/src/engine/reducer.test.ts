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
    expect(state.snapshot.glowingPortIds.length).toBeGreaterThan(0);
    const stars = scoreRun(state, state.startedAtMs + 30_000);
    expect(stars.correctness).toBeGreaterThanOrEqual(2);
  });

  it('M3: VLAN mismatch on load, fixed by moving to sw-7', () => {
    const mission = getMission('m3-vlan-trap')!;
    let state = createEngineState(mission, baseRack);

    expect(
      state.snapshot.linkTable[
        portKey({ deviceId: 'server-07', portId: 'nic-1' })
      ],
    ).toBe('down');
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

  it('M4: admin-down port stays dark until moved', () => {
    const mission = getMission('m4-admin-down')!;
    let state = createEngineState(mission, baseRack);

    expect(
      state.snapshot.linkTable[portKey({ deviceId: 'tor-1', portId: 'sw-4' })],
    ).toBe('down');
    expect(state.snapshot.lastTip?.code).toBe('ADMIN_DOWN');

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

  it('rejects connecting to a busy port', () => {
    const mission = getMission('m1-first-lights')!;
    let state = createEngineState(mission, baseRack);
    state = reduce(state, {
      type: 'CONNECT',
      a: { deviceId: 'panel-a', portId: 'panel-1' },
      b: { deviceId: 'tor-1', portId: 'sw-1' },
    });
    state = reduce(state, {
      type: 'CONNECT',
      a: { deviceId: 'panel-a', portId: 'panel-2' },
      b: { deviceId: 'tor-1', portId: 'sw-1' },
    });
    expect(state.snapshot.lastTip?.code).toBe('PORT_BUSY');
  });

  it('M6: fiber patch lights OM4 path and consumes fiber inventory', () => {
    const mission = getMission('m6-fiber-first')!;
    let state = createEngineState(mission, baseRack);
    const fiberBefore = state.snapshot.inventory.fiber_om4;

    state = reduce(state, {
      type: 'CONNECT',
      a: { deviceId: 'fiber-tray', portId: 'f-1' },
      b: { deviceId: 'tor-sfp', portId: 'sfp-1' },
    });

    expect(state.snapshot.inventory.fiber_om4).toBe(fiberBefore - 1);
    expect(
      state.snapshot.linkTable[
        portKey({ deviceId: 'fiber-tray', portId: 'f-1' })
      ],
    ).toBe('up');
    expect(state.snapshot.complete).toBe(true);
  });

  it('M7: copper on fiber ports is a media fault until replaced', () => {
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

  it('REQUEST_HINT provides a ghost path for unmet link goals', () => {
    const mission = getMission('m1-first-lights')!;
    let state = createEngineState(mission, baseRack);
    state = reduce(state, { type: 'REQUEST_HINT' });
    expect(state.snapshot.lastTip?.code).toBe('HINT');
    expect(state.snapshot.hintGhost?.a.portId).toBe('panel-1');
    expect(state.snapshot.hintGhost?.b.portId).toBe('sw-1');
  });

  it('sandbox intents can cycle VLAN and toggle admin', () => {
    const mission = getMission('m1-first-lights')!;
    let state = createEngineState(mission, baseRack);
    state = reduce(state, {
      type: 'CYCLE_VLAN',
      port: { deviceId: 'tor-1', portId: 'sw-1' },
    });
    const port = state.snapshot.rack.devices
      .find((d) => d.id === 'tor-1')!
      .ports.find((p) => p.id === 'sw-1')!;
    expect(port.vlanId).toBe(20);

    state = reduce(state, {
      type: 'TOGGLE_ADMIN',
      port: { deviceId: 'tor-1', portId: 'sw-1' },
    });
    expect(
      state.snapshot.rack.devices
        .find((d) => d.id === 'tor-1')!
        .ports.find((p) => p.id === 'sw-1')!.admin,
    ).toBe('down');
  });
});
