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
    expect(state.snapshot.linkTable[portKey({ deviceId: 'panel-a', portId: 'panel-1' })]).toBe(
      'up',
    );

    state = reduce(state, {
      type: 'CONNECT',
      a: { deviceId: 'tor-1', portId: 'sw-5' },
      b: { deviceId: 'server-01', portId: 'nic-1' },
    });

    expect(state.snapshot.complete).toBe(true);
    expect(state.snapshot.lastTip?.code).toMatch(/LINK_UP|GOAL_COMPLETE|CONNECTED/);
    const stars = scoreRun(state, state.startedAtMs + 30_000);
    expect(stars.correctness).toBeGreaterThanOrEqual(2);
  });

  it('M3: VLAN mismatch on load, fixed by moving to sw-7', () => {
    const mission = getMission('m3-vlan-trap')!;
    let state = createEngineState(mission, baseRack);

    expect(
      state.snapshot.linkTable[portKey({ deviceId: 'server-07', portId: 'nic-1' })],
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
    expect(
      state.snapshot.linkTable[portKey({ deviceId: 'server-07', portId: 'nic-1' })],
    ).toBe('up');
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
});
