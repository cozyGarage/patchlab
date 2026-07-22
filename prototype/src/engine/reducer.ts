import {
  Cable,
  CableColor,
  Intent,
  Mission,
  PortRef,
  RackState,
  SimSnapshot,
  Tip,
  samePort,
  portKey,
} from '../types/schema';
import {
  buildLinkTable,
  evaluateGoals,
  findPath,
  getPort,
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

function snapshotOf(
  rack: RackState,
  mission: Mission,
  inventory: { copper_cat6: number },
  lastTip?: Tip,
): SimSnapshot {
  const { linkTable, tips } = buildLinkTable(rack);
  const goalsMet = evaluateGoals(rack, mission.goals, linkTable);
  const paths = mission.goals
    .filter((g): g is Extract<typeof g, { type: 'path_up' }> => g.type === 'path_up')
    .map((g) => findPath(rack, g.from, g.to))
    .filter((p): p is NonNullable<typeof p> => p != null);

  const tip =
    lastTip ??
    (goalsMet.every(Boolean)
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
    complete: goalsMet.length > 0 && goalsMet.every(Boolean),
    lastTip: tip,
    inventory,
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
  const used = rack.cables.length;
  const inventory = {
    copper_cat6: Math.max(0, mission.inventory.copper_cat6 - used),
  };
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

export function reduce(state: EngineState, intent: Intent): EngineState {
  const { mission } = state;

  switch (intent.type) {
    case 'RESET':
      return createEngineState(mission, state.baseRack);

    case 'DISCONNECT': {
      const rack = cloneRack(state.snapshot.rack);
      const before = rack.cables.length;
      rack.cables = rack.cables.filter((c) => c.id !== intent.cableId);
      if (rack.cables.length === before) return state;
      const inventory = {
        copper_cat6: state.snapshot.inventory.copper_cat6 + 1,
      };
      const tip: Tip = {
        level: 'info',
        code: 'DISCONNECTED',
        message: 'Cable removed',
      };
      return {
        ...state,
        snapshot: snapshotOf(rack, mission, inventory, tip),
      };
    }

    case 'DISCONNECT_PORT': {
      const rack = cloneRack(state.snapshot.rack);
      const cable = rack.cables.find(
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
            lastTip: {
              level: 'error',
              code: 'PORT_BUSY',
              message: 'Port busy — unplug first',
            },
          },
        };
      }

      if (state.snapshot.inventory.copper_cat6 <= 0) {
        return {
          ...state,
          snapshot: {
            ...state.snapshot,
            lastTip: {
              level: 'warn',
              code: 'OPEN_CIRCUIT',
              message: 'No spare Cat6 left in inventory',
            },
          },
        };
      }

      const color: CableColor = intent.color ?? 'blue';
      const cable: Cable = {
        id: `c-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        media: 'copper_cat6',
        color,
        lengthM: 2,
        ends: [a, b],
      };

      const rack = cloneRack(state.snapshot.rack);
      rack.cables.push(cable);
      const inventory = {
        copper_cat6: state.snapshot.inventory.copper_cat6 - 1,
      };

      const pair = resolvePair(portA, portB);
      const connectTip: Tip = {
        level: 'info',
        code: 'CONNECTED',
        message: `Connected ${portA.label} → ${portB.label}`,
      };
      const tip = pair.status === 'up' ? pair.tip ?? connectTip : pair.tip ?? connectTip;

      let wrongAttempts = state.wrongAttempts;
      if (pair.status !== 'up') wrongAttempts += 1;

      return {
        ...state,
        wrongAttempts,
        connectCount: state.connectCount + 1,
        snapshot: snapshotOf(rack, mission, inventory, tip),
      };
    }

    case 'REQUEST_HINT': {
      const unmet = mission.goals.findIndex(
        (_, i) => !state.snapshot.goalsMet[i],
      );
      const goal = mission.goals[unmet];
      let message = 'Check port labels and VLAN on the switch';
      if (goal?.type === 'link_up') {
        message = `Hint: patch ${goal.a.portId} ↔ ${goal.b.portId}`;
      } else if (goal?.type === 'no_cables_on') {
        message = `Hint: clear ${goal.ports.map((p) => p.portId).join(', ')}`;
      }
      return {
        ...state,
        hintsUsed: state.hintsUsed + 1,
        snapshot: {
          ...state.snapshot,
          lastTip: { level: 'info', code: 'CONNECTED', message },
        },
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
