import { describe, expect, it } from 'vitest';
import { HIT_RADIUS, nearestPort } from './patching';

describe('nearestPort', () => {
  const ports = [
    {
      ref: { deviceId: 'a', portId: '1' },
      port: { media: 'copper_cat6' } as never,
      x: 100,
      y: 40,
    },
    {
      ref: { deviceId: 'b', portId: '1' },
      port: { media: 'fiber_om4' } as never,
      x: 140,
      y: 40,
    },
    {
      ref: { deviceId: 'c', portId: '1' },
      port: { media: 'copper_cat6' } as never,
      x: 220,
      y: 40,
    },
  ];

  it('finds ports within the generous hit radius', () => {
    // Port center is at y+8.
    const hit = nearestPort(ports, 108, 48, HIT_RADIUS);
    expect(hit?.ref.deviceId).toBe('a');
  });

  it('prefers matching media when distances are close', () => {
    const hit = nearestPort(
      ports,
      120,
      48,
      80,
      undefined,
      'fiber_om4',
    );
    expect(hit?.ref.deviceId).toBe('b');
  });

  it('excludes the armed/source port', () => {
    const hit = nearestPort(
      ports,
      100,
      48,
      HIT_RADIUS,
      { deviceId: 'a', portId: '1' },
    );
    expect(hit).toBeUndefined();
  });
});
