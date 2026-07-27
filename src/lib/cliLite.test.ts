import { describe, expect, it } from 'vitest';
import { parseCliCommand } from './cliLite';

describe('parseCliCommand', () => {
  it('parses VLAN and trunk commands', () => {
    const vlan = parseCliCommand('switchport access vlan 20 sw-6', 'tor-1');
    expect(vlan.ok).toBe(true);
    if (vlan.ok) {
      expect(vlan.intent).toMatchObject({
        type: 'SET_VLAN',
        vlanId: 20,
        port: { deviceId: 'tor-1', portId: 'sw-6' },
      });
    }
    const trunk = parseCliCommand('switchport mode trunk sw-8', 'tor-1');
    expect(trunk.ok).toBe(true);
    if (trunk.ok) expect(trunk.intent.type).toBe('SET_PORT_MODE');
  });

  it('parses IP, route, and ping', () => {
    const ip = parseCliCommand('ip address 10.10.10.10 24 10.10.10.1 nic-1', 'server-01');
    expect(ip.ok).toBe(true);
    if (ip.ok) {
      expect(ip.intent).toMatchObject({
        type: 'SET_IP',
        address: '10.10.10.10',
        prefix: 24,
        gateway: '10.10.10.1',
      });
    }
    const route = parseCliCommand('ip route 198.51.100.0/24 203.0.113.2 10', 'fw-1');
    expect(route.ok).toBe(true);
    const ping = parseCliCommand('ping server-07', 'server-01');
    expect(ping.ok).toBe(true);
    if (ping.ok) expect(ping.intent.type).toBe('PING');
  });

  it('returns help text for unknown commands', () => {
    const help = parseCliCommand('help', 'tor-1');
    expect(help.ok).toBe(false);
    if (!help.ok) expect(help.error).toMatch(/Commands:/);
    const bad = parseCliCommand('configure terminal', 'tor-1');
    expect(bad.ok).toBe(false);
  });
});
