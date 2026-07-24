import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  SANDBOX_PRESETS,
  clearSandboxSnapshot,
  freshSandboxState,
  loadSandboxSnapshot,
  saveSandboxSnapshot,
} from './sandboxLab';

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
});

describe('sandbox lab persistence', () => {
  it('saves and loads a rack snapshot', () => {
    const state = freshSandboxState();
    const saved = saveSandboxSnapshot(
      state.snapshot.rack,
      state.snapshot.inventory,
      'unit-test',
    );
    expect(saved.version).toBe(1);
    expect(saved.label).toBe('unit-test');

    const loaded = loadSandboxSnapshot();
    expect(loaded?.rack.devices.length).toBe(state.snapshot.rack.devices.length);
    expect(loaded?.inventory.copper_cat6).toBe(
      state.snapshot.inventory.copper_cat6,
    );
  });

  it('clears saved snapshots', () => {
    const state = freshSandboxState();
    saveSandboxSnapshot(state.snapshot.rack, state.snapshot.inventory);
    clearSandboxSnapshot();
    expect(loadSandboxSnapshot()).toBeNull();
  });

  it('builds each ticket preset without throwing', () => {
    for (const preset of SANDBOX_PRESETS) {
      const built = preset.build();
      expect(built.rack.devices.length).toBeGreaterThan(0);
      expect(built.inventory.copper_cat6).toBeGreaterThanOrEqual(0);
    }
  });
});
