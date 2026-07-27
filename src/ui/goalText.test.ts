import { describe, expect, it } from 'vitest';
import { goalText } from './MissionBrief';
import type { Goal, Mission } from '../types/schema';

function missionWith(goals: Goal[]): Mission {
  return {
    id: 'm-goals',
    title: 'Goals',
    order: 1,
    brief: 'Brief',
    constraints: [],
    parTimeSec: 60,
    hintAfterWrongAttempts: 2,
    inventory: {
      copper_cat6: 1,
      fiber_om4: 0,
      power_c13: 0,
      console_rj45: 0,
    },
    initial: { devices: [], cables: [] },
    goals,
    learning: {
      mode: 'guided',
      difficulty: 1,
      conceptsIntroduced: [],
      conceptsPracticed: [],
      enabledTools: ['patch'],
      visibleObjectives: [],
      ticketDetails: [],
      debrief: {
        outcome: 'Done',
        explanation: 'Because',
        question: 'Why?',
        answer: 'Evidence',
      },
      hints: {
        prompt: 'P',
        evidence: 'E',
        action: 'A',
        solution: 'S',
      },
    },
  };
}

describe('goalText', () => {
  it('formats link, IP, ping-fail, route, and fiber goals', () => {
    const lines = goalText(
      missionWith([
        {
          type: 'link_up',
          a: { deviceId: 'panel', portId: 'panel-1' },
          b: { deviceId: 'sw', portId: 'sw-1' },
        },
        {
          type: 'iface_ip',
          port: { deviceId: 'sw', portId: 'sw-1' },
          address: '10.10.10.2',
          prefix: 24,
          gateway: '10.10.10.1',
        },
        {
          type: 'ping_fail',
          fromDeviceId: 'server-01',
          toDeviceId: 'server-07',
        },
        {
          type: 'route_entry',
          deviceId: 'fw',
          destCidr: '198.51.100.0/24',
          nextHop: '203.0.113.2',
          adminDistance: 10,
        },
        {
          type: 'cable_media_between',
          a: { deviceId: 'tray', portId: 'f-1' },
          b: { deviceId: 'sfp', portId: 'te-1' },
          media: 'fiber_om4',
        },
      ]),
    );

    expect(lines[0]).toContain('Link up');
    expect(lines[0]).toContain('panel-1');
    expect(lines[1]).toContain('via 10.10.10.1');
    expect(lines[2]).toMatch(/Ping must fail/);
    expect(lines[3]).toContain('AD10');
    expect(lines[4]).toContain('OM4 fiber');
  });
});
