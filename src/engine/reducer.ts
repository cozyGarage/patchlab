import {
  Cable,
  CableColor,
  Intent,
  Inventory,
  MediaType,
  Mission,
  PortRef,
  RackState,
  SimSnapshot,
  Tip,
  emptyInventory,
  samePort,
  portKey,
} from '../types/schema';
import { isValidHostIp, parseCidr, parseIpv4 } from './ip';
import {
  buildConsoleMap,
  buildLinkTable,
  evaluateGoals,
  evaluatePing,
  evaluatePingToPublicIp,
  evaluateTraceroute,
  findPath,
  getPort,
  glowingPortsFromGoals,
  hintForGoal,
  resolvePair,
} from './linkSolver';

function cloneRack(rack: RackState): RackState {
  return structuredClone(rack);
}

function mergeInitial(base: RackState, mission: Mission): RackState {
  const devices = structuredClone(base.devices);
  for (const override of mission.initial.devices) {
    const idx = devices.findIndex((d) => d.id === override.id);
    if (idx >= 0) devices[idx] = structuredClone(override);
    else devices.push(structuredClone(override));
  }

  const useBase = mission.useBaseCables !== false;
  const baseCables = useBase ? structuredClone(base.cables) : [];
  const missionCables = structuredClone(mission.initial.cables);
  return {
    devices,
    cables: [...baseCables, ...missionCables],
  };
}

function countByMedia(cables: Cable[]): Inventory {
  const inv = emptyInventory();
  for (const c of cables) {
    inv[c.media] += 1;
  }
  return inv;
}

function remainingInventory(mission: Mission, cables: Cable[]): Inventory {
  const used = countByMedia(cables);
  const m = mission.inventory;
  return {
    copper_cat6: Math.max(0, (m.copper_cat6 ?? 0) - used.copper_cat6),
    fiber_om4: Math.max(0, (m.fiber_om4 ?? 0) - used.fiber_om4),
    power_c13: Math.max(0, (m.power_c13 ?? 0) - used.power_c13),
    console_rj45: Math.max(0, (m.console_rj45 ?? 0) - used.console_rj45),
  };
}

function snapshotOf(
  rack: RackState,
  mission: Mission,
  inventory: Inventory,
  lastTip?: Tip,
  hintGhost: SimSnapshot['hintGhost'] = null,
  lastPing?: SimSnapshot['lastPing'],
  lastTrace?: SimSnapshot['lastTrace'],
): SimSnapshot {
  const { linkTable, tips, powered } = buildLinkTable(rack);
  const consoleAttached = buildConsoleMap(rack);
  const goalsMet = evaluateGoals(
    rack,
    mission.goals,
    linkTable,
    lastPing,
    lastTrace,
  );
  const paths = mission.goals
    .filter((g): g is Extract<typeof g, { type: 'path_up' }> => g.type === 'path_up')
    .map((g) => findPath(rack, g.from, g.to))
    .filter((p): p is NonNullable<typeof p> => p != null);

  const complete = goalsMet.length > 0 && goalsMet.every(Boolean);
  const tip =
    lastTip ??
    (complete
      ? {
          level: 'success' as const,
          code: 'GOAL_COMPLETE' as const,
          message: 'Goals complete — nice work',
        }
      : tips[0]);

  return {
    rack,
    linkTable,
    poweredDevices: powered,
    consoleAttached,
    paths,
    goalsMet,
    complete,
    lastTip: tip,
    inventory,
    hintGhost,
    glowingPortIds: glowingPortsFromGoals(rack, mission.goals, goalsMet),
    lastPing,
    lastTrace,
  };
}

export interface EngineState {
  mission: Mission;
  baseRack: RackState;
  snapshot: SimSnapshot;
  wrongAttempts: number;
  hintsUsed: number;
  hintLevel: 0 | 1 | 2 | 3 | 4;
  connectCount: number;
  startedAtMs: number;
  loadRevision: number;
}

export function createEngineState(
  mission: Mission,
  baseRack: RackState,
): EngineState {
  const rack = mergeInitial(baseRack, mission);
  // Inventory is remaining spares relative to mission allotment minus ALL cables present
  // For power harness from base, don't charge learner inventory — subtract only mission cables.
  const missionOnly = structuredClone(mission.initial.cables);
  const inventory = remainingInventory(mission, missionOnly);
  // Also subtract any extra cables learner... initially just mission cables.
  // Base power cables are facility and free.
  return {
    mission,
    baseRack,
    snapshot: snapshotOf(rack, mission, inventory),
    wrongAttempts: 0,
    hintsUsed: 0,
    hintLevel: 0,
    connectCount: 0,
    startedAtMs: Date.now(),
    loadRevision: 0,
  };
}

function portsFree(rack: RackState, a: PortRef, b: PortRef): boolean {
  const busy = (ref: PortRef) =>
    rack.cables.some(
      (c) => samePort(c.ends[0], ref) || samePort(c.ends[1], ref),
    );
  return !busy(a) && !busy(b);
}

function pickMedia(
  portAMedia: MediaType,
  portBMedia: MediaType,
  requested?: MediaType,
): MediaType {
  if (requested) return requested;
  if (portAMedia === portBMedia) return portAMedia;
  return 'copper_cat6';
}

function defaultColor(media: MediaType): CableColor {
  switch (media) {
    case 'fiber_om4':
      return 'aqua';
    case 'power_c13':
      return 'black';
    case 'console_rj45':
      return 'lightblue';
    default:
      return 'blue';
  }
}

export function reduce(state: EngineState, intent: Intent): EngineState {
  const { mission } = state;

  switch (intent.type) {
    case 'RESET':
      return createEngineState(mission, state.baseRack);

    case 'DISCONNECT': {
      const rack = cloneRack(state.snapshot.rack);
      const cable = rack.cables.find((c) => c.id === intent.cableId);
      if (!cable) return state;
      rack.cables = rack.cables.filter((c) => c.id !== intent.cableId);
      const inventory = { ...state.snapshot.inventory };
      // Facility / base-rack harnesses are not learner inventory — do not refund them.
      const isBaseCable = state.baseRack.cables.some((c) => c.id === cable.id);
      if (!isBaseCable) {
        inventory[cable.media] += 1;
      }
      const tip: Tip = {
        level: 'info',
        code: 'DISCONNECTED',
        message: isBaseCable
          ? `Removed facility ${cable.media.replaceAll('_', ' ')} cord`
          : `Removed ${cable.media.replaceAll('_', ' ')} cord`,
      };
      return {
        ...state,
        snapshot: snapshotOf(rack, mission, inventory, tip, null),
      };
    }

    case 'DISCONNECT_PORT': {
      const cable = state.snapshot.rack.cables.find(
        (c) =>
          samePort(c.ends[0], intent.port) || samePort(c.ends[1], intent.port),
      );
      if (!cable) return state;
      return reduce(state, { type: 'DISCONNECT', cableId: cable.id });
    }

    case 'CONNECT': {
      const { a, b } = intent;
      if (samePort(a, b)) {
        return {
          ...state,
          wrongAttempts: state.wrongAttempts + 1,
          snapshot: {
            ...state.snapshot,
            hintGhost: null,
            lastTip: {
              level: 'error',
              code: 'INVALID_PORTS',
              message: 'Cannot patch a port to itself',
            },
          },
        };
      }

      const portA = getPort(state.snapshot.rack, a);
      const portB = getPort(state.snapshot.rack, b);
      if (!portA || !portB) {
        return {
          ...state,
          snapshot: {
            ...state.snapshot,
            lastTip: {
              level: 'error',
              code: 'INVALID_PORTS',
              message: 'Unknown port',
            },
          },
        };
      }

      if (!portsFree(state.snapshot.rack, a, b)) {
        return {
          ...state,
          wrongAttempts: state.wrongAttempts + 1,
          snapshot: {
            ...state.snapshot,
            hintGhost: null,
            lastTip: {
              level: 'error',
              code: 'PORT_BUSY',
              message: 'Port busy — unplug first',
            },
          },
        };
      }

      const media = pickMedia(portA.media, portB.media, intent.media);
      if (state.snapshot.inventory[media] <= 0) {
        return {
          ...state,
          snapshot: {
            ...state.snapshot,
            lastTip: {
              level: 'warn',
              code: 'OPEN_CIRCUIT',
              message: `No spare ${media.replaceAll('_', ' ')} in inventory`,
            },
          },
        };
      }

      const color: CableColor = intent.color ?? defaultColor(media);
      const cable: Cable = {
        id: `c-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        media,
        color,
        lengthM: 2,
        ends: [a, b],
      };

      const rack = cloneRack(state.snapshot.rack);
      rack.cables.push(cable);
      const inventory = { ...state.snapshot.inventory };
      inventory[media] -= 1;

      const powered = state.snapshot.poweredDevices;
      const pair = resolvePair(
        portA,
        portB,
        media,
        powered[portA.deviceId] ?? true,
        powered[portB.deviceId] ?? true,
      );
      // After power connect, rebuild will mark powered — tip from resolvePair is fine
      const tip = pair.tip ?? {
        level: 'info' as const,
        code: 'CONNECTED' as const,
        message: `Connected ${portA.label} → ${portB.label}`,
      };

      let wrongAttempts = state.wrongAttempts;
      if (pair.status !== 'up' && media !== 'power_c13') wrongAttempts += 1;

      return {
        ...state,
        wrongAttempts,
        connectCount: state.connectCount + 1,
        snapshot: snapshotOf(rack, mission, inventory, tip, null),
      };
    }

    case 'REQUEST_HINT': {
      const nextLevel = Math.min(4, state.hintLevel + 1) as 1 | 2 | 3 | 4;
      const authored = mission.learning.hints;
      const messages = [
        authored.prompt,
        authored.evidence,
        authored.action,
        authored.solution,
      ];
      const unmet = mission.goals.findIndex(
        (_, i) => !state.snapshot.goalsMet[i],
      );
      const fallback = hintForGoal(mission.goals[unmet]);
      const showSolution = nextLevel === 4;
      return {
        ...state,
        hintsUsed: state.hintsUsed + 1,
        hintLevel: nextLevel,
        snapshot: {
          ...state.snapshot,
          hintGhost: showSolution ? (fallback.ghost ?? null) : null,
          lastTip: {
            level: 'info',
            code: 'HINT',
            message: messages[nextLevel - 1] ?? fallback.message,
          },
        },
      };
    }

    case 'CYCLE_VLAN': {
      const rack = cloneRack(state.snapshot.rack);
      const port = getPort(rack, intent.port);
      if (!port || port.role !== 'network' || port.vlanId == null) return state;
      const options = [10, 20, 30];
      const idx = options.indexOf(port.vlanId);
      port.vlanId = options[(idx + 1) % options.length]!;
      return {
        ...state,
        snapshot: snapshotOf(
          rack,
          mission,
          state.snapshot.inventory,
          {
            level: 'info',
            code: 'PORT_UPDATED',
            message: `${port.label} VLAN → ${port.vlanId}`,
          },
          null,
        ),
      };
    }

    case 'TOGGLE_ADMIN': {
      const rack = cloneRack(state.snapshot.rack);
      const port = getPort(rack, intent.port);
      if (!port || (port.kind !== 'data' && port.kind !== 'lan' && port.kind !== 'wan')) {
        return state;
      }
      port.admin = port.admin === 'up' ? 'down' : 'up';
      return {
        ...state,
        snapshot: snapshotOf(
          rack,
          mission,
          state.snapshot.inventory,
          {
            level: 'info',
            code: 'PORT_UPDATED',
            message: `${port.label} admin → ${port.admin}`,
          },
          null,
        ),
      };
    }

    case 'SET_IP': {
      const rack = cloneRack(state.snapshot.rack);
      const port = getPort(rack, intent.port);
      if (!port) return state;
      if (!isValidHostIp(intent.address, intent.prefix)) {
        return {
          ...state,
          wrongAttempts: state.wrongAttempts + 1,
          snapshot: {
            ...state.snapshot,
            lastTip: {
              level: 'error',
              code: 'IP_UPDATED',
              message: 'Invalid host IP/prefix (avoid network/broadcast)',
            },
          },
        };
      }
      port.ip = {
        address: intent.address,
        prefix: intent.prefix,
        gateway: intent.gateway,
      };
      return {
        ...state,
        snapshot: snapshotOf(
          rack,
          mission,
          state.snapshot.inventory,
          {
            level: 'success',
            code: 'IP_UPDATED',
            message: `${port.label} → ${intent.address}/${intent.prefix}`,
          },
          null,
        ),
      };
    }

    case 'UPSERT_FIREWALL_RULE': {
      const rack = cloneRack(state.snapshot.rack);
      const fw = rack.devices.find((d) => d.id === intent.deviceId);
      if (!fw || fw.role !== 'firewall') return state;
      if (
        !parseCidr(intent.rule.srcCidr) ||
        !parseCidr(intent.rule.dstCidr)
      ) {
        return {
          ...state,
          wrongAttempts: state.wrongAttempts + 1,
          snapshot: {
            ...state.snapshot,
            lastTip: {
              level: 'error',
              code: 'FIREWALL_UPDATED',
              message:
                'Invalid ACL — use CIDR like 10.10.10.20/32 → 198.51.100.0/24',
            },
          },
        };
      }
      const existing = fw.firewallRules ?? [];
      const others = existing.filter((r) => r.id !== intent.rule.id);
      // New/updated rules evaluate first (trainer-friendly ACL top-insert).
      fw.firewallRules = [intent.rule, ...others];
      return {
        ...state,
        snapshot: snapshotOf(
          rack,
          mission,
          state.snapshot.inventory,
          {
            level: 'success',
            code: 'FIREWALL_UPDATED',
            message: `FW ${intent.rule.action} ${intent.rule.srcCidr} → ${intent.rule.dstCidr}`,
          },
          null,
        ),
      };
    }

    case 'PING': {
      const result = evaluatePing(
        state.snapshot.rack,
        intent.fromDeviceId,
        intent.toDeviceId,
      );
      return {
        ...state,
        wrongAttempts: result.ok ? state.wrongAttempts : state.wrongAttempts + 1,
        snapshot: snapshotOf(
          state.snapshot.rack,
          mission,
          state.snapshot.inventory,
          {
            level: result.ok ? 'success' : 'warn',
            code: result.ok ? 'PING_OK' : 'PING_FAIL',
            message: result.detail,
          },
          null,
          {
            ...result,
            fromDeviceId: intent.fromDeviceId,
            toDeviceId: intent.toDeviceId,
          },
        ),
      };
    }

    case 'PING_IP': {
      const result = evaluatePingToPublicIp(
        state.snapshot.rack,
        intent.fromDeviceId,
        intent.targetIp,
      );
      return {
        ...state,
        wrongAttempts: result.ok ? state.wrongAttempts : state.wrongAttempts + 1,
        snapshot: snapshotOf(
          state.snapshot.rack,
          mission,
          state.snapshot.inventory,
          {
            level: result.ok ? 'success' : 'warn',
            code: result.ok ? 'PING_OK' : 'PING_FAIL',
            message: result.detail,
          },
          null,
          {
            ...result,
            fromDeviceId: intent.fromDeviceId,
            targetIp: intent.targetIp,
          },
        ),
      };
    }

    case 'SET_VLAN': {
      const rack = cloneRack(state.snapshot.rack);
      const port = getPort(rack, intent.port);
      const validVlan =
        Number.isInteger(intent.vlanId) &&
        intent.vlanId >= 1 &&
        intent.vlanId <= 4094;
      if (!port || !validVlan || (port.role !== 'nic' && port.role !== 'network')) {
        return {
          ...state,
          wrongAttempts: state.wrongAttempts + 1,
          snapshot: {
            ...state.snapshot,
            lastTip: {
              level: 'error',
              code: 'PORT_UPDATED',
              message: 'Invalid access VLAN — use an integer from 1 to 4094 on a data port',
            },
          },
        };
      }
      if (port.role === 'nic') port.accessVlan = intent.vlanId;
      else port.vlanId = intent.vlanId;
      return {
        ...state,
        snapshot: snapshotOf(
          rack,
          mission,
          state.snapshot.inventory,
          {
            level: 'success',
            code: 'PORT_UPDATED',
            message: `${port.label} access VLAN → ${intent.vlanId}`,
          },
          null,
        ),
      };
    }

    case 'SET_PORT_MODE': {
      const rack = cloneRack(state.snapshot.rack);
      const port = getPort(rack, intent.port);
      if (!port || port.role !== 'network') return state;
      port.mode = intent.mode;
      port.allowedVlans =
        intent.mode === 'trunk' ? (port.allowedVlans ?? [10, 20, 30]) : undefined;
      return {
        ...state,
        snapshot: snapshotOf(
          rack,
          mission,
          state.snapshot.inventory,
          {
            level: 'success',
            code: 'MODE_UPDATED',
            message: `${port.label} mode → ${intent.mode}`,
          },
          null,
        ),
      };
    }

    case 'SET_NAT': {
      const rack = cloneRack(state.snapshot.rack);
      const fw = rack.devices.find((d) => d.id === intent.deviceId);
      if (!fw || fw.role !== 'firewall') return state;
      if (!parseIpv4(intent.insideIp) || !parseIpv4(intent.outsideIp)) {
        return {
          ...state,
          wrongAttempts: state.wrongAttempts + 1,
          snapshot: {
            ...state.snapshot,
            lastTip: {
              level: 'error',
              code: 'NAT_UPDATED',
              message: 'Invalid static NAT — use valid inside and outside IPv4 addresses',
            },
          },
        };
      }
      const rule = {
        id: `nat-${intent.insideIp}-${intent.outsideIp}`,
        mode: 'static' as const,
        insideIp: intent.insideIp,
        outsideIp: intent.outsideIp,
        enabled: true,
      };
      const others = (fw.natRules ?? []).filter((r) => r.id !== rule.id);
      fw.natRules = [rule, ...others];
      return {
        ...state,
        snapshot: snapshotOf(
          rack,
          mission,
          state.snapshot.inventory,
          {
            level: 'success',
            code: 'NAT_UPDATED',
            message: `NAT ${intent.insideIp} → ${intent.outsideIp}`,
          },
          null,
        ),
      };
    }

    case 'SET_PAT': {
      const rack = cloneRack(state.snapshot.rack);
      const fw = rack.devices.find((d) => d.id === intent.deviceId);
      if (!fw || fw.role !== 'firewall') return state;
      if (!parseCidr(intent.insideCidr) || !parseIpv4(intent.outsideIp)) {
        return {
          ...state,
          wrongAttempts: state.wrongAttempts + 1,
          snapshot: {
            ...state.snapshot,
            lastTip: {
              level: 'error',
              code: 'NAT_UPDATED',
              message:
                'Invalid PAT — use inside CIDR (e.g. 10.10.10.0/24) and outside IP',
            },
          },
        };
      }
      const rule = {
        id: `pat-${intent.insideCidr}-${intent.outsideIp}`,
        mode: 'pat' as const,
        insideIp: '',
        insideCidr: intent.insideCidr,
        outsideIp: intent.outsideIp,
        overload: true,
        enabled: true,
        note: 'PAT overload',
      };
      const others = (fw.natRules ?? []).filter((r) => r.id !== rule.id);
      fw.natRules = [rule, ...others];
      return {
        ...state,
        snapshot: snapshotOf(
          rack,
          mission,
          state.snapshot.inventory,
          {
            level: 'success',
            code: 'NAT_UPDATED',
            message: `PAT ${intent.insideCidr} → ${intent.outsideIp} (overload)`,
          },
          null,
        ),
      };
    }

    case 'SET_ROUTE': {
      const rack = cloneRack(state.snapshot.rack);
      const dev = rack.devices.find((d) => d.id === intent.deviceId);
      if (!dev || (dev.role !== 'firewall' && dev.role !== 'switch')) {
        return state;
      }
      const ad = intent.adminDistance ?? 1;
      if (
        !parseCidr(intent.destCidr) ||
        !parseIpv4(intent.nextHop) ||
        !Number.isInteger(ad) ||
        ad < 1 ||
        ad > 255
      ) {
        return {
          ...state,
          wrongAttempts: state.wrongAttempts + 1,
          snapshot: {
            ...state.snapshot,
            lastTip: {
              level: 'error',
              code: 'ROUTE_UPDATED',
              message: 'Invalid route — use a CIDR, next-hop IP, and integer AD from 1 to 255',
            },
          },
        };
      }
      const rule = {
        id: `rt-${intent.destCidr}-${intent.nextHop}-ad${ad}`,
        destCidr: intent.destCidr,
        nextHop: intent.nextHop,
        adminDistance: ad,
        enabled: true,
      };
      // Drop exact dest+nextHop duplicate; keep floating siblings when AD is set.
      const withoutExact = (dev.routes ?? []).filter(
        (r) =>
          !(r.destCidr === intent.destCidr && r.nextHop === intent.nextHop),
      );
      const base =
        intent.adminDistance != null
          ? withoutExact
          : withoutExact.filter((r) => r.destCidr !== intent.destCidr);
      dev.routes = [rule, ...base];
      return {
        ...state,
        snapshot: snapshotOf(
          rack,
          mission,
          state.snapshot.inventory,
          {
            level: 'success',
            code: 'ROUTE_UPDATED',
            message: `Route ${intent.destCidr} via ${intent.nextHop} (AD${ad})`,
          },
          null,
        ),
      };
    }

    case 'TRACEROUTE': {
      const result = evaluateTraceroute(
        state.snapshot.rack,
        intent.fromDeviceId,
        intent.toDeviceId,
      );
      return {
        ...state,
        wrongAttempts: result.ok ? state.wrongAttempts : state.wrongAttempts + 1,
        snapshot: {
          ...snapshotOf(
            state.snapshot.rack,
            mission,
            state.snapshot.inventory,
            {
              level: result.ok ? 'success' : 'warn',
              code: result.ok ? 'TRACEROUTE_OK' : 'TRACEROUTE_FAIL',
              message: result.detail,
            },
            null,
            undefined,
            {
              ...result,
              fromDeviceId: intent.fromDeviceId,
              toDeviceId: intent.toDeviceId,
            },
          ),
        },
      };
    }

    case 'LOAD_RACK': {
      const inventory =
        intent.inventory ?? state.snapshot.inventory;
      return {
        ...state,
        loadRevision: state.loadRevision + 1,
        snapshot: snapshotOf(
          cloneRack(intent.rack),
          mission,
          inventory,
          {
            level: 'info',
            code: 'SANDBOX_SAVED',
            message: 'Sandbox rack loaded',
          },
          null,
        ),
      };
    }

    default:
      return state;
  }
}

export function debugPort(state: EngineState, ref: PortRef): string {
  const status = state.snapshot.linkTable[portKey(ref)] ?? 'down';
  return `${portKey(ref)}=${status}`;
}
