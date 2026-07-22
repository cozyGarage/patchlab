import {
  Cable,
  Device,
  Goal,
  LinkStatus,
  PathInfo,
  Port,
  PortRef,
  RackState,
  Tip,
  samePort,
  portKey,
} from '../types/schema';

function indexPorts(devices: Device[]): Map<string, Port> {
  const map = new Map<string, Port>();
  for (const d of devices) {
    for (const p of d.ports) {
      map.set(portKey({ deviceId: d.id, portId: p.id }), p);
    }
  }
  return map;
}

function findCableOnPort(cables: Cable[], ref: PortRef): Cable | undefined {
  return cables.find(
    (c) => samePort(c.ends[0], ref) || samePort(c.ends[1], ref),
  );
}

function otherEnd(cable: Cable, ref: PortRef): PortRef {
  return samePort(cable.ends[0], ref) ? cable.ends[1] : cable.ends[0];
}

/** Resolve L1/L2 status for a direct cable between two ports. */
export function resolvePair(
  a: Port,
  b: Port,
): { status: LinkStatus; tip?: Tip } {
  if (a.media !== b.media || a.connector !== b.connector) {
    return {
      status: 'fault',
      tip: {
        level: 'error',
        code: 'MEDIA_MISMATCH',
        message: 'Media/connector mismatch — check copper vs fiber and ends',
      },
    };
  }

  if (a.admin === 'down' || b.admin === 'down') {
    const downLabel = a.admin === 'down' ? a.label : b.label;
    return {
      status: 'down',
      tip: {
        level: 'warn',
        code: 'ADMIN_DOWN',
        message: `No link — switch port is admin down (${downLabel})`,
      },
    };
  }

  const vlanA = a.role === 'nic' ? a.accessVlan : a.vlanId;
  const vlanB = b.role === 'nic' ? b.accessVlan : b.vlanId;
  if (vlanA != null && vlanB != null && vlanA !== vlanB) {
    return {
      status: 'down',
      tip: {
        level: 'warn',
        code: 'VLAN_MISMATCH',
        message: `No link — VLAN mismatch (${vlanA} vs ${vlanB})`,
      },
    };
  }

  return {
    status: 'up',
    tip: {
      level: 'success',
      code: 'LINK_UP',
      message: `Link up — ${a.label} ↔ ${b.label}`,
    },
  };
}

export function buildLinkTable(rack: RackState): {
  linkTable: Record<string, LinkStatus>;
  tips: Tip[];
} {
  const ports = indexPorts(rack.devices);
  const linkTable: Record<string, LinkStatus> = {};
  const tips: Tip[] = [];

  for (const p of ports.keys()) {
    linkTable[p] = 'down';
  }

  for (const cable of rack.cables) {
    const a = ports.get(portKey(cable.ends[0]));
    const b = ports.get(portKey(cable.ends[1]));
    if (!a || !b) continue;
    const { status, tip } = resolvePair(a, b);
    linkTable[portKey(cable.ends[0])] = status;
    linkTable[portKey(cable.ends[1])] = status;
    if (tip && (status === 'down' || status === 'fault')) {
      tips.push(tip);
    }
  }

  return { linkTable, tips };
}

/** BFS over cables; edges only traverse when that cable's link resolves up. */
export function findPath(
  rack: RackState,
  from: PortRef,
  to: PortRef,
): PathInfo | null {
  const ports = indexPorts(rack.devices);
  const start = portKey(from);
  const goal = portKey(to);
  const queue: string[][] = [[start]];
  const seen = new Set<string>([start]);

  while (queue.length) {
    const path = queue.shift()!;
    const tail = path[path.length - 1]!;
    if (tail === goal) {
      return { portIds: path, status: 'up' };
    }

    const [deviceId, portId] = tail.split('::') as [string, string];
    const cable = findCableOnPort(rack.cables, { deviceId, portId });
    if (!cable) continue;

    const nextRef = otherEnd(cable, { deviceId, portId });
    const nextKey = portKey(nextRef);
    if (seen.has(nextKey)) continue;

    const a = ports.get(tail);
    const b = ports.get(nextKey);
    if (!a || !b) continue;
    if (resolvePair(a, b).status !== 'up') continue;

    seen.add(nextKey);
    queue.push([...path, nextKey]);
  }

  return null;
}

export function evaluateGoals(
  rack: RackState,
  goals: Goal[],
  linkTable: Record<string, LinkStatus>,
): boolean[] {
  return goals.map((g) => {
    switch (g.type) {
      case 'link_up': {
        const cable = rack.cables.find(
          (c) =>
            (samePort(c.ends[0], g.a) && samePort(c.ends[1], g.b)) ||
            (samePort(c.ends[0], g.b) && samePort(c.ends[1], g.a)),
        );
        if (!cable) return false;
        return (
          linkTable[portKey(g.a)] === 'up' && linkTable[portKey(g.b)] === 'up'
        );
      }
      case 'path_up':
        return findPath(rack, g.from, g.to) != null;
      case 'port_in_path': {
        const path = findPath(rack, g.from, g.to);
        return !!path?.portIds.includes(portKey(g.port));
      }
      case 'no_cables_on':
        return g.ports.every((p) => !findCableOnPort(rack.cables, p));
      case 'cable_color_between': {
        const cable = rack.cables.find(
          (c) =>
            (samePort(c.ends[0], g.a) && samePort(c.ends[1], g.b)) ||
            (samePort(c.ends[0], g.b) && samePort(c.ends[1], g.a)),
        );
        return !!cable && cable.color === g.color;
      }
      default:
        return false;
    }
  });
}

export function getPort(rack: RackState, ref: PortRef): Port | undefined {
  return rack.devices
    .find((d) => d.id === ref.deviceId)
    ?.ports.find((p) => p.id === ref.portId);
}
