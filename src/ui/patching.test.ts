import { describe, expect, it } from 'vitest';
import {
  HIT_RADIUS,
  isValidPatchTarget,
  nearerCableEnd,
  nearestPort,
  portIsBusy,
} from './patching';
import type { Port } from '../types/schema';

function fakePort(media: Port['media']): Port {
  return { media } as Port;
}

describe('nearestPort', () => {
  const ports = [
    {
      ref: { deviceId: 'a', portId: '1' },
      port: fakePort('copper_cat6'),
      x: 100,
      y: 40,
    },
    {
      ref: { deviceId: 'b', portId: '1' },
      port: fakePort('fiber_om4'),
      x: 140,
      y: 40,
    },
    {
      ref: { deviceId: 'c', portId: '1' },
      port: fakePort('copper_cat6'),
      x: 220,
      y: 40,
    },
  ];

  it('finds ports within the generous hit radius', () => {
    const hit = nearestPort(ports, 108, 48, HIT_RADIUS);
    expect(hit?.ref.deviceId).toBe('a');
  });

  it('hard-filters media when softMedia is false', () => {
    const hit = nearestPort(ports, 120, 48, 80, {
      preferMedia: 'fiber_om4',
      softMedia: false,
    });
    expect(hit?.ref.deviceId).toBe('b');
  });

  it('skips busy ports when requireFree is set', () => {
    const cables: { ends: [{ deviceId: string; portId: string }, { deviceId: string; portId: string }] }[] =
      [
        {
          ends: [
            { deviceId: 'a', portId: '1' },
            { deviceId: 'z', portId: '1' },
          ],
        },
      ];
    const hit = nearestPort(ports, 210, 48, 40, {
      requireFree: true,
      cables,
      preferMedia: 'copper_cat6',
      softMedia: false,
    });
    expect(hit?.ref.deviceId).toBe('c');
  });

  it('excludes the armed/source port', () => {
    const hit = nearestPort(ports, 100, 48, 20, {
      exclude: { deviceId: 'a', portId: '1' },
    });
    expect(hit).toBeUndefined();
  });
});

describe('isValidPatchTarget', () => {
  const cables: {
    ends: [
      { deviceId: string; portId: string },
      { deviceId: string; portId: string },
    ];
  }[] = [
    {
      ends: [
        { deviceId: 'a', portId: '1' },
        { deviceId: 'b', portId: '1' },
      ],
    },
  ];

  it('rejects busy destinations', () => {
    expect(
      isValidPatchTarget(
        { deviceId: 'c', portId: '1' },
        { deviceId: 'a', portId: '1' },
        cables,
      ),
    ).toBe(false);
  });

  it('allows move onto a free jack', () => {
    expect(
      isValidPatchTarget(
        { deviceId: 'a', portId: '1' },
        { deviceId: 'c', portId: '1' },
        cables,
        'copper_cat6',
        'copper_cat6',
      ),
    ).toBe(true);
  });

  it('can ignore media mismatches for engine lessons', () => {
    expect(
      isValidPatchTarget(
        { deviceId: 'c', portId: '1' },
        { deviceId: 'd', portId: '1' },
        [],
        'copper_cat6',
        'fiber_om4',
        false,
      ),
    ).toBe(true);
  });
});

describe('nearerCableEnd', () => {
  it('picks the closer end', () => {
    const ends = [
      { deviceId: 'a', portId: '1' },
      { deviceId: 'b', portId: '1' },
    ] as [{ deviceId: string; portId: string }, { deviceId: string; portId: string }];
    const centers = new Map([
      ['a::1', { x: 0, y: 0 }],
      ['b::1', { x: 100, y: 0 }],
    ]);
    expect(
      nearerCableEnd(ends, centers, 10, 0, (r) => `${r.deviceId}::${r.portId}`)
        .deviceId,
    ).toBe('a');
    expect(
      nearerCableEnd(ends, centers, 90, 0, (r) => `${r.deviceId}::${r.portId}`)
        .deviceId,
    ).toBe('b');
  });
});

describe('portIsBusy', () => {
  it('detects occupied ports', () => {
    expect(
      portIsBusy(
        [
          {
            ends: [
              { deviceId: 'a', portId: '1' },
              { deviceId: 'b', portId: '1' },
            ],
          },
        ],
        { deviceId: 'a', portId: '1' },
      ),
    ).toBe(true);
  });
});
