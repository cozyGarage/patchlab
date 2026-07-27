import { describe, expect, it } from 'vitest';
import { emptyInventory, portKey, samePort } from './schema';

describe('schema helpers', () => {
  it('builds stable port keys', () => {
    expect(portKey({ deviceId: 'tor-1', portId: 'sw-1' })).toBe('tor-1::sw-1');
  });

  it('compares port refs by device and port id', () => {
    const a = { deviceId: 'tor-1', portId: 'sw-1' };
    expect(samePort(a, { deviceId: 'tor-1', portId: 'sw-1' })).toBe(true);
    expect(samePort(a, { deviceId: 'tor-1', portId: 'sw-2' })).toBe(false);
    expect(samePort(a, { deviceId: 'tor-2', portId: 'sw-1' })).toBe(false);
  });

  it('returns a zeroed inventory', () => {
    expect(emptyInventory()).toEqual({
      copper_cat6: 0,
      fiber_om4: 0,
      power_c13: 0,
      console_rj45: 0,
    });
  });
});
