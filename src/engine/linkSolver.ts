import {
  Cable,
  Device,
  FirewallRule,
  Goal,
  LinkStatus,
  PathInfo,
  Port,
  PortRef,
  RackState,
  Tip,
  TraceResult,
  samePort,
  portKey,
} from '../types/schema';
import { inCidr, parseCidr, sameSubnet } from './ip';

function indexPorts(devices: Device[]): Map<string, Port> {
  const map = new Map<string, Port>();
  for (const d of devices) {
    for (const p of d.ports) {
      map.set(portKey({ deviceId: d.id, portId: p.id }), p);
    }
  }
  return map;
}

export function findCableOnPort(
  cables: Cable[],
  ref: PortRef,
): Cable | undefined {
  return cables.find(
    (c) => samePort(c.ends[0], ref) || samePort(c.ends[1], ref),
  );
}

function otherEnd(cable: Cable, ref: PortRef): PortRef {
  return samePort(cable.ends[0], ref) ? cable.ends[1] : cable.ends[0];
}

export function getPort(rack: RackState, ref: PortRef): Port | undefined {
  return rack.devices
    .find((d) => d.id === ref.deviceId)
    ?.ports.find((p) => p.id === ref.portId);
}

export function getDevice(rack: RackState, id: string): Device | undefined {
  return rack.devices.find((d) => d.id === id);
}

/** Active gear needs a power cord into a PDU outlet (unless poweredByDefault). */
export function isDevicePowered(rack: RackState, deviceId: string): boolean {
  const device = getDevice(rack, deviceId);
  if (!device) return false;
  if (device.role === 'pdu' || device.role === 'patch_panel' || device.role === 'fiber_tray') {
    return true;
  }
  if (device.poweredByDefault) return true;

  const powerPorts = device.ports.filter((p) => p.kind === 'power');
  if (powerPorts.length === 0) return true;

  for (const pp of powerPorts) {
    const cable = findCableOnPort(rack.cables, {
      deviceId: device.id,
      portId: pp.id,
    });
    if (!cable || cable.media !== 'power_c13') continue;
    const far = otherEnd(cable, { deviceId: device.id, portId: pp.id });
    const farDev = getDevice(rack, far.deviceId);
    const farPort = getPort(rack, far);
    if (farDev?.role === 'pdu' && farPort?.kind === 'power') return true;
  }
  return false;
}

export function buildPoweredMap(rack: RackState): Record<string, boolean> {
  const map: Record<string, boolean> = {};
  for (const d of rack.devices) {
    map[d.id] = isDevicePowered(rack, d.id);
  }
  return map;
}

/** Console attached if a console cable lands on a console port of the device. */
export function isConsoleAttached(rack: RackState, deviceId: string): boolean {
  const device = getDevice(rack, deviceId);
  if (!device) return false;
  return device.ports.some((p) => {
    if (p.kind !== 'console') return false;
    const cable = findCableOnPort(rack.cables, {
      deviceId: device.id,
      portId: p.id,
    });
    return !!cable && cable.media === 'console_rj45';
  });
}

export function buildConsoleMap(rack: RackState): Record<string, boolean> {
  const map: Record<string, boolean> = {};
  for (const d of rack.devices) {
    map[d.id] = isConsoleAttached(rack, d.id);
  }
  return map;
}

export function resolvePair(
  a: Port,
  b: Port,
  cableMedia?: Cable['media'],
  poweredA = true,
  poweredB = true,
): { status: LinkStatus; tip?: Tip } {
  if (a.media !== b.media || a.connector !== b.connector) {
    return {
      status: 'fault',
      tip: {
        level: 'error',
        code: 'MEDIA_MISMATCH',
        message: `Media mismatch — ${a.label} (${a.media.replaceAll('_', ' ')}) vs ${b.label} (${b.media.replaceAll('_', ' ')})`,
      },
    };
  }

  if (cableMedia && cableMedia !== a.media) {
    return {
      status: 'fault',
      tip: {
        level: 'error',
        code: 'MEDIA_MISMATCH',
        message: `Wrong cord — need ${prettyMedia(a.media)}`,
      },
    };
  }

  // Power / console links don't need VLAN or admin in the data sense
  if (a.kind === 'power' || b.kind === 'power') {
    return {
      status: 'up',
      tip: {
        level: 'success',
        code: 'LINK_UP',
        message: `Power path — ${a.label} ↔ ${b.label}`,
      },
    };
  }
  if (a.kind === 'console' || b.kind === 'console') {
    return {
      status: 'up',
      tip: {
        level: 'success',
        code: 'LINK_UP',
        message: `Console attached — ${a.label} ↔ ${b.label}`,
      },
    };
  }

  if (!poweredA || !poweredB) {
    return {
      status: 'down',
      tip: {
        level: 'warn',
        code: 'NO_POWER',
        message: 'No link — device has no power from PDU',
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
        message: `No link — port is admin down (${downLabel})`,
      },
    };
  }

  const trunk = a.mode === 'trunk' || b.mode === 'trunk';
  const vlanA = a.role === 'nic' ? a.accessVlan : a.vlanId;
  const vlanB = b.role === 'nic' ? b.accessVlan : b.vlanId;
  if (!trunk && vlanA != null && vlanB != null && vlanA !== vlanB) {
    return {
      status: 'down',
      tip: {
        level: 'warn',
        code: 'VLAN_MISMATCH',
        message: `No link — VLAN mismatch (${vlanA} vs ${vlanB})`,
      },
    };
  }

  const kind =
    a.media === 'fiber_om4'
      ? 'Fiber'
      : a.media === 'console_rj45'
        ? 'Console'
        : 'Copper';
  return {
    status: 'up',
    tip: {
      level: 'success',
      code: 'LINK_UP',
      message: `${kind} link up — ${a.label} ↔ ${b.label}`,
    },
  };
}

function prettyMedia(m: Cable['media']): string {
  switch (m) {
    case 'fiber_om4':
      return 'OM4 fiber LC';
    case 'power_c13':
      return 'C13 power cord';
    case 'console_rj45':
      return 'console / rollover cable';
    default:
      return 'Cat6 copper';
  }
}

export function buildLinkTable(rack: RackState): {
  linkTable: Record<string, LinkStatus>;
  tips: Tip[];
  powered: Record<string, boolean>;
} {
  const ports = indexPorts(rack.devices);
  const powered = buildPoweredMap(rack);
  const linkTable: Record<string, LinkStatus> = {};
  const tips: Tip[] = [];

  for (const p of ports.keys()) linkTable[p] = 'down';

  for (const cable of rack.cables) {
    const a = ports.get(portKey(cable.ends[0]));
    const b = ports.get(portKey(cable.ends[1]));
    if (!a || !b) continue;
    const { status, tip } = resolvePair(
      a,
      b,
      cable.media,
      powered[a.deviceId] ?? true,
      powered[b.deviceId] ?? true,
    );
    // Power cables should still show up even if we later mark device powered
    // Recalculate power first for data — for power cables, both ends "powered" check uses PDU always true
    linkTable[portKey(cable.ends[0])] = status;
    linkTable[portKey(cable.ends[1])] = status;
    if (tip && (status === 'down' || status === 'fault')) tips.push(tip);
  }

  return { linkTable, tips, powered };
}

export function findPath(
  rack: RackState,
  from: PortRef,
  to: PortRef,
): PathInfo | null {
  const ports = indexPorts(rack.devices);
  const powered = buildPoweredMap(rack);
  const start = portKey(from);
  const goal = portKey(to);
  const queue: string[][] = [[start]];
  const seen = new Set<string>([start]);

  while (queue.length) {
    const path = queue.shift()!;
    const tail = path[path.length - 1]!;
    if (tail === goal) return { portIds: path, status: 'up' };

    const [deviceId, portId] = tail.split('::') as [string, string];
    const cable = findCableOnPort(rack.cables, { deviceId, portId });
    if (!cable) continue;
    if (cable.media === 'power_c13' || cable.media === 'console_rj45') continue;

    const nextRef = otherEnd(cable, { deviceId, portId });
    const nextKey = portKey(nextRef);
    if (seen.has(nextKey)) continue;

    const a = ports.get(tail);
    const b = ports.get(nextKey);
    if (!a || !b) continue;
    if (
      resolvePair(
        a,
        b,
        cable.media,
        powered[a.deviceId] ?? true,
        powered[b.deviceId] ?? true,
      ).status !== 'up'
    ) {
      continue;
    }

    seen.add(nextKey);
    queue.push([...path, nextKey]);
  }
  return null;
}

function primaryIp(device: Device): { address: string; prefix: number } | null {
  const p = device.ports.find((x) => x.ip?.address);
  return p?.ip ?? null;
}

function firewallAllows(
  rules: FirewallRule[] | undefined,
  srcIp: string,
  dstIp: string,
): { ok: boolean; detail: string } {
  const list = rules ?? [];
  for (const rule of list) {
    if (!rule.enabled) continue;
    if (inCidr(srcIp, rule.srcCidr) && inCidr(dstIp, rule.dstCidr)) {
      if (rule.action === 'permit') {
        return { ok: true, detail: `Firewall permit ${rule.srcCidr} → ${rule.dstCidr}` };
      }
      return { ok: false, detail: `Firewall deny ${rule.srcCidr} → ${rule.dstCidr}` };
    }
  }
  // Implicit deny if any rules exist; else permit for trainer simplicity when empty
  if (list.some((r) => r.enabled)) {
    return { ok: false, detail: 'Firewall implicit deny' };
  }
  return { ok: true, detail: 'No firewall filter matched (open)' };
}

function hasDataCable(device: Device, rack: RackState): boolean {
  if (device.cloudAttached) return true;
  return device.ports.some(
    (p) =>
      (p.kind === 'data' || p.kind === 'lan' || p.kind === 'wan' || p.role === 'nic') &&
      findCableOnPort(rack.cables, { deviceId: device.id, portId: p.id }),
  );
}

/** Candidate routes: longest prefix first, then lowest admin distance. */
function candidateRoutes(
  routes: NonNullable<Device['routes']>,
  destIp: string,
) {
  return routes
    .filter((route) => {
      if (!route.enabled) return false;
      const parsed = parseCidr(route.destCidr);
      return !!parsed && inCidr(destIp, route.destCidr);
    })
    .sort((a, b) => {
      const pa = parseCidr(a.destCidr)!.prefix;
      const pb = parseCidr(b.destCidr)!.prefix;
      if (pb !== pa) return pb - pa;
      return (a.adminDistance ?? 1) - (b.adminDistance ?? 1);
    });
}

function longestPrefixRoute(
  routes: NonNullable<Device['routes']>,
  destIp: string,
) {
  return candidateRoutes(routes, destIp)[0] ?? null;
}

function findPatRule(router: Device, srcIp: string) {
  return (router.natRules ?? []).find(
    (r) =>
      r.enabled &&
      r.mode === 'pat' &&
      !!r.insideCidr &&
      inCidr(srcIp, r.insideCidr),
  );
}

function tryRouteDelivery(
  rack: RackState,
  router: Device,
  to: Device,
  toIp: { address: string; prefix: number },
): { ok: true; route: NonNullable<Device['routes']>[number]; edge: Device } | {
  ok: false;
  detail: string;
} {
  const candidates = candidateRoutes(router.routes ?? [], toIp.address);
  if (candidates.length === 0) {
    return {
      ok: false,
      detail: 'Ping fail — no route on gateway to destination subnet',
    };
  }
  let lastDetail = 'Ping fail — no usable route';
  for (const route of candidates) {
    const nextHopOnLink = router.ports.some(
      (p) =>
        p.ip &&
        sameSubnet(p.ip, { address: route.nextHop, prefix: p.ip.prefix }),
    );
    if (!nextHopOnLink) {
      lastDetail = `Ping fail — next hop ${route.nextHop} is not on a connected interface`;
      continue;
    }
    const edge = deviceOwningIp(rack, route.nextHop);
    if (!edge || !isDevicePowered(rack, edge.id)) {
      lastDetail = `Ping fail — next hop ${route.nextHop} not found on a live device`;
      continue;
    }
    if (!edgeCanDeliver(rack, edge, to, toIp)) {
      lastDetail = `Ping fail — ${edge.name} has no path to ${toIp.address} (trying floating backup if any)`;
      continue;
    }
    return { ok: true, route, edge };
  }
  return { ok: false, detail: lastDetail };
}

function deviceHasConnectedRoute(
  device: Device,
  dest: { address: string; prefix: number },
): boolean {
  return device.ports.some((p) => p.ip && sameSubnet(p.ip, dest));
}

/** Next-hop device that owns this IP on a live interface. */
function deviceOwningIp(rack: RackState, ip: string): Device | undefined {
  return rack.devices.find((d) => d.ports.some((p) => p.ip?.address === ip));
}

/**
 * After a packet is delivered to `edge` (e.g. ISP-PEER), can it reach `to`?
 * Supports cloud branch hosts on a logical network behind the WAN peer.
 */
function edgeCanDeliver(
  rack: RackState,
  edge: Device,
  to: Device,
  toIp: { address: string; prefix: number },
): boolean {
  if (edge.id === to.id) return true;
  if (deviceHasConnectedRoute(edge, toIp)) return true;
  // Cloud branch: same subnet as any edge interface (including uncabled cloud NIC)
  if (to.cloudAttached) {
    return edge.ports.some((p) => p.ip && sameSubnet(p.ip, toIp));
  }
  return false;
}

export function evaluatePing(
  rack: RackState,
  fromDeviceId: string,
  toDeviceId: string,
): { ok: boolean; detail: string } {
  const from = getDevice(rack, fromDeviceId);
  const to = getDevice(rack, toDeviceId);
  if (!from || !to) return { ok: false, detail: 'Unknown device' };
  if (!isDevicePowered(rack, fromDeviceId) || !isDevicePowered(rack, toDeviceId)) {
    return { ok: false, detail: 'Ping fail — a device is unpowered' };
  }

  const fromIpFull = from.ports.find((p) => p.ip?.address)?.ip;
  const fromIp = primaryIp(from);
  const toIp = primaryIp(to);
  if (!fromIp || !toIp || !fromIpFull) {
    return { ok: false, detail: 'Ping fail — configure IPv4 on both hosts' };
  }

  if (!hasDataCable(from, rack) || !hasDataCable(to, rack)) {
    return { ok: false, detail: 'Ping fail — host missing data cable' };
  }

  const fw = rack.devices.find((d) => d.role === 'firewall');

  if (sameSubnet(fromIp, toIp)) {
    if (fw && isDevicePowered(rack, fw.id) && !from.cloudAttached && !to.cloudAttached) {
      const check = firewallAllows(fw.firewallRules, fromIp.address, toIp.address);
      if (!check.ok) return { ok: false, detail: `Ping fail — ${check.detail}` };
    }
    return {
      ok: true,
      detail: `Ping ok — ${fromIp.address} → ${toIp.address} (same subnet)`,
    };
  }

  // Routed path via default gateway, or a directly connected router/FW
  const gateway = fromIpFull.gateway;
  let router =
    gateway != null
      ? rack.devices.find((d) => d.ports.some((p) => p.ip?.address === gateway))
      : undefined;

  if (gateway) {
    if (!sameSubnet(fromIp, { address: gateway, prefix: fromIp.prefix })) {
      return { ok: false, detail: 'Ping fail — gateway is not on the local subnet' };
    }
    if (!router || !isDevicePowered(rack, router.id)) {
      return {
        ok: false,
        detail: `Ping fail — gateway ${gateway} not found on a live router/FW`,
      };
    }
    const gwIface = router.ports.find((p) => p.ip?.address === gateway)?.ip;
    if (gwIface) {
      // Mask trap lesson: host prefix must match the gateway interface mask,
      // and the host address must fall inside that interface subnet.
      if (fromIp.prefix !== gwIface.prefix) {
        return {
          ok: false,
          detail: `Ping fail — host prefix /${fromIp.prefix} does not match gateway interface /${gwIface.prefix}`,
        };
      }
      if (
        !sameSubnet(
          { address: fromIp.address, prefix: gwIface.prefix },
          gwIface,
        )
      ) {
        return {
          ok: false,
          detail: 'Ping fail — host IP is outside the gateway interface subnet',
        };
      }
    }
  } else {
    // WAN peers may use a directly attached firewall without configuring a gateway.
    // LAN hosts must set an explicit default gateway (CCNA lesson).
    router = rack.devices.find(
      (d) =>
        d.role === 'firewall' &&
        isDevicePowered(rack, d.id) &&
        d.ports.some(
          (p) => p.kind === 'wan' && p.ip && sameSubnet(fromIp, p.ip),
        ),
    );
    if (!router) {
      return {
        ok: false,
        detail: `Ping fail — different subnets and no default gateway on ${from.name}`,
      };
    }
  }

  const routerReachesDst = deviceHasConnectedRoute(router, toIp);

  const fromOnWan = router.ports.some(
    (p) => p.kind === 'wan' && p.ip && sameSubnet(fromIp, p.ip),
  );
  const toOnLan = router.ports.some(
    (p) => p.kind === 'lan' && p.ip && sameSubnet(toIp, p.ip),
  );

  // Inbound WAN→LAN requires static NAT publishing the inside host
  if (router.role === 'firewall' && fromOnWan && toOnLan) {
    const nat = (router.natRules ?? []).find(
      (r) =>
        r.enabled &&
        (!r.mode || r.mode === 'static') &&
        r.insideIp === toIp.address,
    );
    if (!nat) {
      return {
        ok: false,
        detail: 'Ping fail — no static NAT publishing the inside host',
      };
    }
    const check = firewallAllows(
      router.firewallRules,
      fromIp.address,
      toIp.address,
    );
    if (!check.ok) return { ok: false, detail: `Ping fail — ${check.detail}` };
    return {
      ok: true,
      detail: `Ping ok — ${fromIp.address} → ${toIp.address} via NAT ${nat.outsideIp}`,
    };
  }

  if (router.role === 'firewall') {
    const check = firewallAllows(router.firewallRules, fromIp.address, toIp.address);
    if (!check.ok) return { ok: false, detail: `Ping fail — ${check.detail}` };
  }

  const fromOnLan = router.ports.some(
    (p) => p.kind === 'lan' && p.ip && sameSubnet(fromIp, p.ip),
  );
  const toOnWanOrRemote =
    router.ports.some(
      (p) => p.kind === 'wan' && p.ip && sameSubnet(toIp, p.ip),
    ) || !!to.cloudAttached;

  // Outbound PAT when the firewall requires it for LAN egress
  let patNote = '';
  if (
    router.role === 'firewall' &&
    router.requiresOutboundNat &&
    fromOnLan &&
    toOnWanOrRemote
  ) {
    const pat = findPatRule(router, fromIp.address);
    if (!pat) {
      return {
        ok: false,
        detail:
          'Ping fail — outbound PAT/overload required (private source needs translation)',
      };
    }
    patNote = ` via PAT ${pat.insideCidr} → ${pat.outsideIp}`;
  }

  if (routerReachesDst) {
    const via =
      gateway ??
      router.ports.find((p) => p.ip && sameSubnet(fromIp, p.ip))?.ip?.address;
    return {
      ok: true,
      detail: `Ping ok — ${fromIp.address} → ${toIp.address} via ${via ?? router.name}${patNote}`,
    };
  }

  const delivered = tryRouteDelivery(rack, router, to, toIp);
  if (!delivered.ok) return delivered;

  const ad =
    delivered.route.adminDistance != null
      ? ` AD${delivered.route.adminDistance}`
      : '';
  return {
    ok: true,
    detail: `Ping ok — ${fromIp.address} → ${toIp.address} via route ${delivered.route.destCidr} → ${delivered.route.nextHop}${ad}${patNote}`,
  };
}

export function evaluateTraceroute(
  rack: RackState,
  fromDeviceId: string,
  toDeviceId: string,
): TraceResult {
  const hops: TraceResult['hops'] = [];
  const from = getDevice(rack, fromDeviceId);
  const to = getDevice(rack, toDeviceId);
  if (!from || !to) {
    return { ok: false, detail: 'Unknown device', hops };
  }

  const fromIpFull = from.ports.find((p) => p.ip?.address)?.ip;
  const fromIp = primaryIp(from);
  const toIp = primaryIp(to);
  if (!fromIp || !toIp || !fromIpFull) {
    return {
      ok: false,
      detail: 'Traceroute fail — configure IPv4 on both hosts',
      hops,
    };
  }

  hops.push({
    ttl: 1,
    deviceId: from.id,
    name: from.name,
    ip: fromIp.address,
    detail: 'source',
    ok: true,
  });

  if (sameSubnet(fromIp, toIp)) {
    hops.push({
      ttl: 2,
      deviceId: to.id,
      name: to.name,
      ip: toIp.address,
      detail: 'destination (same subnet)',
      ok: true,
    });
    const sameSubnetPing = evaluatePing(rack, fromDeviceId, toDeviceId);
    if (!sameSubnetPing.ok) {
      hops.push({
        ttl: hops.length + 1,
        detail: sameSubnetPing.detail.replace(/^Ping fail — /, 'blocked — '),
        ok: false,
      });
      return {
        ok: false,
        detail: `Traceroute path found but traffic blocked — ${sameSubnetPing.detail}`,
        hops,
      };
    }
    return {
      ok: true,
      detail: `Traceroute ok — ${fromIp.address} → ${toIp.address} (1 hop)`,
      hops,
    };
  }

  const gateway = fromIpFull.gateway;
  if (!gateway) {
    hops.push({
      ttl: 2,
      detail: 'no default gateway',
      ok: false,
    });
    return { ok: false, detail: 'Traceroute fail — no default gateway', hops };
  }

  const router = rack.devices.find((d) =>
    d.ports.some((p) => p.ip?.address === gateway),
  );
  if (!router || !isDevicePowered(rack, router.id)) {
    hops.push({
      ttl: 2,
      ip: gateway,
      detail: 'gateway unreachable',
      ok: false,
    });
    return {
      ok: false,
      detail: `Traceroute fail — gateway ${gateway} unreachable`,
      hops,
    };
  }

  hops.push({
    ttl: 2,
    deviceId: router.id,
    name: router.name,
    ip: gateway,
    detail: 'default gateway',
    ok: true,
  });

  if (deviceHasConnectedRoute(router, toIp)) {
    hops.push({
      ttl: 3,
      deviceId: to.id,
      name: to.name,
      ip: toIp.address,
      detail: 'destination (connected)',
      ok: true,
    });
    const connectedPing = evaluatePing(rack, fromDeviceId, toDeviceId);
    if (!connectedPing.ok) {
      hops.push({
        ttl: hops.length + 1,
        detail: connectedPing.detail.replace(/^Ping fail — /, 'blocked — '),
        ok: false,
      });
      return {
        ok: false,
        detail: `Traceroute path found but traffic blocked — ${connectedPing.detail}`,
        hops,
      };
    }
    return {
      ok: true,
      detail: `Traceroute ok — ${from.name} → ${router.name} → ${to.name}`,
      hops,
    };
  }

  const delivered = tryRouteDelivery(rack, router, to, toIp);
  if (!delivered.ok) {
    hops.push({
      ttl: 3,
      detail: delivered.detail.replace(/^Ping fail — /, ''),
      ok: false,
    });
    return {
      ok: false,
      detail: `Traceroute fail — ${delivered.detail.replace(/^Ping fail — /, '')}`,
      hops,
    };
  }

  hops.push({
    ttl: 3,
    deviceId: delivered.edge.id,
    name: delivered.edge.name,
    ip: delivered.route.nextHop,
    detail: `via ${delivered.route.destCidr}${
      delivered.route.adminDistance != null
        ? ` AD${delivered.route.adminDistance}`
        : ''
    }`,
    ok: true,
  });
  hops.push({
    ttl: 4,
    deviceId: to.id,
    name: to.name,
    ip: toIp.address,
    detail: 'destination',
    ok: true,
  });

  // Still require ping-level policy (ACL/PAT) to count as complete path
  const ping = evaluatePing(rack, fromDeviceId, toDeviceId);
  if (!ping.ok) {
    hops.push({
      ttl: hops.length + 1,
      detail: ping.detail.replace(/^Ping fail — /, 'blocked — '),
      ok: false,
    });
    return {
      ok: false,
      detail: `Traceroute path found but traffic blocked — ${ping.detail}`,
      hops,
    };
  }

  return {
    ok: true,
    detail: `Traceroute ok — ${hops
      .filter((h) => h.ok && h.name)
      .map((h) => h.name)
      .join(' → ')}`,
    hops,
  };
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
      case 'cable_media_between': {
        const cable = rack.cables.find(
          (c) =>
            (samePort(c.ends[0], g.a) && samePort(c.ends[1], g.b)) ||
            (samePort(c.ends[0], g.b) && samePort(c.ends[1], g.a)),
        );
        return !!cable && cable.media === g.media && linkTable[portKey(g.a)] === 'up';
      }
      case 'device_powered':
        return isDevicePowered(rack, g.deviceId);
      case 'console_attached':
        return isConsoleAttached(rack, g.deviceId);
      case 'iface_ip': {
        const port = getPort(rack, g.port);
        return (
          port?.ip?.address === g.address && port.ip.prefix === g.prefix
        );
      }
      case 'ping':
        return evaluatePing(rack, g.fromDeviceId, g.toDeviceId).ok;
      case 'ping_fail':
        return !evaluatePing(rack, g.fromDeviceId, g.toDeviceId).ok;
      case 'firewall_rule': {
        const fw = rack.devices.find((d) => d.role === 'firewall');
        return !!fw?.firewallRules?.some(
          (r) =>
            r.enabled &&
            r.action === g.action &&
            r.srcCidr === g.srcCidr &&
            r.dstCidr === g.dstCidr,
        );
      }
      case 'port_vlan': {
        const port = getPort(rack, g.port);
        const vlan = port?.role === 'nic' ? port.accessVlan : port?.vlanId;
        return vlan === g.vlanId;
      }
      case 'port_mode': {
        const port = getPort(rack, g.port);
        return (port?.mode ?? 'access') === g.mode;
      }
      case 'nat_static': {
        const dev = getDevice(rack, g.deviceId);
        return !!dev?.natRules?.some(
          (r) =>
            r.enabled &&
            (!r.mode || r.mode === 'static') &&
            r.insideIp === g.insideIp &&
            r.outsideIp === g.outsideIp,
        );
      }
      case 'nat_pat': {
        const dev = getDevice(rack, g.deviceId);
        return !!dev?.natRules?.some(
          (r) =>
            r.enabled &&
            r.mode === 'pat' &&
            r.insideCidr === g.insideCidr &&
            r.outsideIp === g.outsideIp,
        );
      }
      case 'route_entry': {
        const dev = getDevice(rack, g.deviceId);
        return !!dev?.routes?.some(
          (r) =>
            r.enabled &&
            r.destCidr === g.destCidr &&
            r.nextHop === g.nextHop &&
            (g.adminDistance == null ||
              (r.adminDistance ?? 1) === g.adminDistance),
        );
      }
      case 'traceroute_ok':
        return evaluateTraceroute(rack, g.fromDeviceId, g.toDeviceId).ok;
      default:
        return false;
    }
  });
}

export function glowingPortsFromGoals(
  rack: RackState,
  goals: Goal[],
  goalsMet: boolean[],
): string[] {
  const ids = new Set<string>();
  goals.forEach((g, i) => {
    if (!goalsMet[i]) return;
    if (g.type === 'link_up' || g.type === 'cable_media_between') {
      ids.add(portKey(g.a));
      ids.add(portKey(g.b));
    } else if (g.type === 'path_up') {
      findPath(rack, g.from, g.to)?.portIds.forEach((id) => ids.add(id));
    } else if (g.type === 'iface_ip' || g.type === 'port_vlan' || g.type === 'port_mode') {
      ids.add(portKey(g.port));
    }
  });
  return [...ids];
}

export function hintForGoal(goal: Goal | undefined): {
  message: string;
  ghost?: { a: PortRef; b: PortRef };
} {
  if (!goal) {
    return { message: 'Check power, media, VLAN, IP, and firewall rules' };
  }
  switch (goal.type) {
    case 'link_up':
    case 'cable_media_between':
    case 'cable_color_between':
      return {
        message: `Hint: patch ${goal.a.portId} ↔ ${goal.b.portId}`,
        ghost: { a: goal.a, b: goal.b },
      };
    case 'path_up':
      return {
        message: `Hint: build path ${goal.from.portId} → ${goal.to.portId}`,
        ghost: { a: goal.from, b: goal.to },
      };
    case 'no_cables_on':
      return {
        message: `Hint: clear ${goal.ports.map((p) => p.portId).join(', ')}`,
      };
    case 'device_powered':
      return { message: `Hint: power ${goal.deviceId} from the PDU` };
    case 'console_attached':
      return { message: `Hint: attach a console cable to ${goal.deviceId}` };
    case 'iface_ip':
      return {
        message: `Hint: set ${goal.port.portId} to ${goal.address}/${goal.prefix}`,
      };
    case 'ping':
      return {
        message: `Hint: cable + IP (+ gateway if needed), then reach ${goal.fromDeviceId} → ${goal.toDeviceId}`,
      };
    case 'ping_fail':
      return {
        message: `Hint: keep ${goal.fromDeviceId} isolated from ${goal.toDeviceId} (VLAN/ACL)`,
      };
    case 'firewall_rule':
      return {
        message: `Hint: add firewall ${goal.action} ${goal.srcCidr} → ${goal.dstCidr}`,
      };
    case 'port_vlan':
      return {
        message: `Hint: set ${goal.port.portId} access VLAN to ${goal.vlanId}`,
      };
    case 'port_mode':
      return {
        message: `Hint: set ${goal.port.portId} mode to ${goal.mode}`,
      };
    case 'nat_static':
      return {
        message: `Hint: static NAT ${goal.insideIp} → ${goal.outsideIp} on ${goal.deviceId}`,
      };
    case 'nat_pat':
      return {
        message: `Hint: PAT/overload ${goal.insideCidr} → ${goal.outsideIp} on ${goal.deviceId}`,
      };
    case 'route_entry':
      return {
        message: `Hint: add route ${goal.destCidr} via ${goal.nextHop}${
          goal.adminDistance != null ? ` AD${goal.adminDistance}` : ''
        } on ${goal.deviceId}`,
      };
    case 'traceroute_ok':
      return {
        message: `Hint: fix path then Traceroute ${goal.fromDeviceId} → ${goal.toDeviceId}`,
      };
    default:
      return { message: 'Check power, media, VLAN, IP, gateway, route, and firewall rules' };
  }
}
