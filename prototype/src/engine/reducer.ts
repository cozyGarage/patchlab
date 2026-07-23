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
import {
  buildLinkTable,
  evaluateGoals,
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
  const devices =
    mission.initial.devices.length > 0
      ? structuredClone(mission.initial.devices)
      : structuredClone(base.devices);
  return {
    devices,
    cables: structuredClone(mission.initial.cables),
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
  return {
    copper_cat6: Math.max(0, (mission.inventory.copper_cat6 ?? 0) - used.copper_cat6),
    fiber_om4: Math.max(0, (mission.inventory.fiber_om4 ?? 0) - used.fiber_om4),
  };
}

function snapshotOf(
  rack: RackState,
  mission: Mission,
  inventory: Inventory,
  lastTip?: Tip,
  hintGhost: SimSnapshot['hintGhost'] = null,
): SimSnapshot {
  const { linkTable, tips } = buildLinkTable(rack);
  const goalsMet = evaluateGoals(rack, mission.goals, linkTable);
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
          message: 'Goals complete — nice patching',
        }
      : tips[0]);

  return {
    rack,
    linkTable,
    paths,
    goalsMet,
    complete,
    lastTip: tip,
    inventory,
    hintGhost,
    glowingPortIds: glowingPortsFromGoals(rack, mission.goals, goalsMet),
  };
}

export interface EngineState {
  mission: Mission;
  baseRack: RackState;
  snapshot: SimSnapshot;
  wrongAttempts: number;
  hintsUsed: number;
  connectCount: number;
  startedAtMs: number;
}

export function createEngineState(
  mission: Mission,
  baseRack: RackState,
): EngineState {
  const rack = mergeInitial(baseRack, mission);
  const inventory = remainingInventory(mission, rack.cables);
  return {
    mission,
    baseRack,
    snapshot: snapshotOf(rack, mission, inventory),
    wrongAttempts: 0,
    hintsUsed: 0,
    connectCount: 0,
    startedAtMs: Date.now(),
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
  return media === 'fiber_om4' ? 'aqua' : 'blue';
}

function updatePort(
  rack: RackState,
  ref: PortRef,
  mutate: (port: { admin: 'up' | 'down'; vlanId?: number }) => void,
): boolean {
  const device = rack.devices.find((d) => d.id === ref.deviceId);
  const port = device?.ports.find((p) => p.id === ref.portId);
  if (!port) return false;
  mutate(port);
  return true;
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
      inventory[cable.media] += 1;
      const tip: Tip = {
        level: 'info',
        code: 'DISCONNECTED',
        message: `Removed ${cable.media === 'fiber_om4' ? 'fiber' : 'copper'} patch`,
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
              message:
                media === 'fiber_om4'
                  ? 'No spare OM4 fiber left in inventory'
                  : 'No spare Cat6 left in inventory',
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

      const pair = resolvePair(portA, portB, media);
      const connectTip: Tip = {
        level: 'info',
        code: 'CONNECTED',
        message: `Connected ${portA.label} → ${portB.label}`,
      };
      const tip = pair.tip ?? connectTip;

      let wrongAttempts = state.wrongAttempts;
      if (pair.status !== 'up') wrongAttempts += 1;

      return {
        ...state,
        wrongAttempts,
        connectCount: state.connectCount + 1,
        snapshot: snapshotOf(rack, mission, inventory, tip, null),
      };
    }

    case 'REQUEST_HINT': {
      const unmet = mission.goals.findIndex(
        (_, i) => !state.snapshot.goalsMet[i],
      );
      const goal = mission.goals[unmet];
      const hint = hintForGoal(goal);
      return {
        ...state,
        hintsUsed: state.hintsUsed + 1,
        snapshot: {
          ...state.snapshot,
          hintGhost: hint.ghost ?? null,
          lastTip: { level: 'info', code: 'HINT', message: hint.message },
        },
      };
    }

    case 'CYCLE_VLAN': {
      const rack = cloneRack(state.snapshot.rack);
      const port = getPort(rack, intent.port);
      if (!port || port.role !== 'network' || port.vlanId == null) {
        return state;
      }
      const options = [10, 20, 30];
      const idx = options.indexOf(port.vlanId);
      port.vlanId = options[(idx + 1) % options.length]!;
      const tip: Tip = {
        level: 'info',
        code: 'PORT_UPDATED',
        message: `${port.label} VLAN → ${port.vlanId}`,
      };
      return {
        ...state,
        snapshot: snapshotOf(
          rack,
          mission,
          state.snapshot.inventory,
          tip,
          null,
        ),
      };
    }

    case 'TOGGLE_ADMIN': {
      const rack = cloneRack(state.snapshot.rack);
      const ok = updatePort(rack, intent.port, (p) => {
        p.admin = p.admin === 'up' ? 'down' : 'up';
      });
      if (!ok) return state;
      const port = getPort(rack, intent.port)!;
      const tip: Tip = {
        level: 'info',
        code: 'PORT_UPDATED',
        message: `${port.label} admin → ${port.admin}`,
      };
      return {
        ...state,
        snapshot: snapshotOf(
          rack,
          mission,
          state.snapshot.inventory,
          tip,
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
