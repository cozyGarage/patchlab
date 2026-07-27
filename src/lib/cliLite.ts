import type { Intent, PortMode, PortRef } from '../types/schema';

export type CliParseResult =
  | { ok: true; intent: Intent; summary: string }
  | { ok: false; error: string };

function portRef(token: string, deviceId: string): PortRef | null {
  const raw = token.trim();
  if (!raw) return null;
  if (raw.includes('/')) {
    // device/port form: tor-1/sw-1
    const [dev, port] = raw.split('/');
    if (!dev || !port) return null;
    return { deviceId: dev, portId: port };
  }
  return { deviceId, portId: raw };
}

/**
 * Parse a small Cisco-inspired command subset into engine intents.
 * Commands operate on the focused device unless a device/port path is given.
 */
export function parseCliCommand(
  line: string,
  focusedDeviceId: string,
): CliParseResult {
  const text = line.trim().replace(/\s+/g, ' ');
  if (!text) return { ok: false, error: 'Enter a command' };
  const lower = text.toLowerCase();

  if (lower === 'no shutdown' || lower === 'no shut') {
    return {
      ok: true,
      intent: {
        type: 'TOGGLE_ADMIN',
        port: { deviceId: focusedDeviceId, portId: 'sw-1' },
      },
      summary: 'Toggle admin on first switchport (use: no shut <portId>)',
    };
  }

  let m = lower.match(/^no\s+shut(?:down)?\s+(\S+)$/);
  if (m) {
    const ref = portRef(m[1]!, focusedDeviceId);
    if (!ref) return { ok: false, error: 'Bad port' };
    return {
      ok: true,
      intent: { type: 'TOGGLE_ADMIN', port: ref },
      summary: `Toggle admin on ${ref.deviceId}/${ref.portId}`,
    };
  }

  m = lower.match(/^shutdown\s+(\S+)$/);
  if (m) {
    const ref = portRef(m[1]!, focusedDeviceId);
    if (!ref) return { ok: false, error: 'Bad port' };
    return {
      ok: true,
      intent: { type: 'TOGGLE_ADMIN', port: ref },
      summary: `Toggle admin on ${ref.deviceId}/${ref.portId}`,
    };
  }

  m = lower.match(/^switchport\s+access\s+vlan\s+(\d+)(?:\s+(\S+))?$/);
  if (m) {
    const vlanId = Number(m[1]);
    const ref = portRef(m[2] ?? 'sw-1', focusedDeviceId);
    if (!ref || !Number.isFinite(vlanId)) return { ok: false, error: 'Bad VLAN command' };
    return {
      ok: true,
      intent: { type: 'SET_VLAN', port: ref, vlanId },
      summary: `Set ${ref.portId} access VLAN ${vlanId}`,
    };
  }

  m = lower.match(/^switchport\s+mode\s+(access|trunk)(?:\s+(\S+))?$/);
  if (m) {
    const mode = m[1] as PortMode;
    const ref = portRef(m[2] ?? 'sw-1', focusedDeviceId);
    if (!ref) return { ok: false, error: 'Bad port' };
    return {
      ok: true,
      intent: { type: 'SET_PORT_MODE', port: ref, mode },
      summary: `Set ${ref.portId} mode ${mode}`,
    };
  }

  m = lower.match(
    /^ip\s+address\s+(\d+\.\d+\.\d+\.\d+)\s+(\d+)(?:\s+(\d+\.\d+\.\d+\.\d+))?(?:\s+(\S+))?$/,
  );
  if (m) {
    const address = m[1]!;
    const prefix = Number(m[2]);
    const gateway = m[3];
    const ref = portRef(m[4] ?? 'nic-1', focusedDeviceId);
    if (!ref || !Number.isFinite(prefix)) return { ok: false, error: 'Bad IP command' };
    return {
      ok: true,
      intent: {
        type: 'SET_IP',
        port: ref,
        address,
        prefix,
        gateway,
      },
      summary: `Set ${ref.portId} = ${address}/${prefix}${gateway ? ` via ${gateway}` : ''}`,
    };
  }

  m = lower.match(
    /^ip\s+route\s+(\d+\.\d+\.\d+\.\d+\/\d+)\s+(\d+\.\d+\.\d+\.\d+)(?:\s+(\d+))?$/,
  );
  if (m) {
    return {
      ok: true,
      intent: {
        type: 'SET_ROUTE',
        deviceId: focusedDeviceId,
        destCidr: m[1]!,
        nextHop: m[2]!,
        adminDistance: m[3] ? Number(m[3]) : undefined,
      },
      summary: `Route ${m[1]} via ${m[2]}${m[3] ? ` AD${m[3]}` : ''}`,
    };
  }

  m = lower.match(/^ping\s+(\S+)$/);
  if (m) {
    const target = m[1]!;
    if (/^\d+\.\d+\.\d+\.\d+$/.test(target)) {
      return {
        ok: true,
        intent: {
          type: 'PING_IP',
          fromDeviceId: focusedDeviceId,
          targetIp: target,
        },
        summary: `Ping ${target}`,
      };
    }
    return {
      ok: true,
      intent: {
        type: 'PING',
        fromDeviceId: focusedDeviceId,
        toDeviceId: target,
      },
      summary: `Ping ${target}`,
    };
  }

  m = lower.match(/^traceroute\s+(\S+)$/);
  if (m) {
    return {
      ok: true,
      intent: {
        type: 'TRACEROUTE',
        fromDeviceId: focusedDeviceId,
        toDeviceId: m[1]!,
      },
      summary: `Traceroute ${m[1]}`,
    };
  }

  if (lower === 'help' || lower === '?') {
    return {
      ok: false,
      error:
        'Commands: no shut <port>, switchport access vlan <n> [port], switchport mode trunk [port], ip address <ip> <prefix> [gw] [port], ip route <cidr> <nh> [ad], ping <device|ip>, traceroute <device>',
    };
  }

  return {
    ok: false,
    error: `Unknown command. Type help`,
  };
}
