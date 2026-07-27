import type { EngineState } from '../engine/reducer';
import { findPath } from '../engine/linkSolver';
import { portKey, type Goal, type PortRef } from '../types/schema';

export interface PathCompare {
  intended: string[];
  actual: string[];
  matched: string[];
  missing: string[];
  extra: string[];
  summary: string;
}

function refsFromGoal(goal: Goal): { a?: PortRef; b?: PortRef } {
  switch (goal.type) {
    case 'link_up':
    case 'cable_media_between':
    case 'cable_color_between':
    case 'console_link':
      return { a: goal.a, b: goal.b };
    case 'path_up':
      return { a: goal.from, b: goal.to };
    case 'port_in_path':
      return { a: goal.from, b: goal.to };
    default:
      return {};
  }
}

function label(ref: PortRef): string {
  return `${ref.deviceId}/${ref.portId}`;
}

/** Compare intended goal endpoints / paths vs the learner's final rack. */
export function compareMissionPath(state: EngineState): PathCompare {
  const intended = new Set<string>();
  const actual = new Set<string>();

  for (const goal of state.mission.goals) {
    const { a, b } = refsFromGoal(goal);
    if (a && b) {
      intended.add(label(a));
      intended.add(label(b));
      if (goal.type === 'path_up' || goal.type === 'port_in_path') {
        const path = findPath(state.snapshot.rack, a, b);
        path?.portIds.forEach((id) => {
          const [deviceId, portId] = id.split('::');
          if (deviceId && portId) actual.add(`${deviceId}/${portId}`);
        });
      }
    }
    if (goal.type === 'link_up' && a && b) {
      const up =
        state.snapshot.linkTable[portKey(a)] === 'up' &&
        state.snapshot.linkTable[portKey(b)] === 'up';
      if (up) {
        actual.add(label(a));
        actual.add(label(b));
      }
    }
  }

  // Also list active data cables as actual topology evidence.
  for (const cable of state.snapshot.rack.cables) {
    if (cable.media === 'power_c13') continue;
    actual.add(label(cable.ends[0]));
    actual.add(label(cable.ends[1]));
  }

  const intendedList = [...intended].sort();
  const actualList = [...actual].sort();
  const matched = intendedList.filter((x) => actual.has(x));
  const missing = intendedList.filter((x) => !actual.has(x));
  const extra = actualList.filter((x) => !intended.has(x));

  let summary = 'Paths align with the ticket endpoints.';
  if (missing.length && extra.length) {
    summary = `Missing ${missing.length} intended endpoint(s); ${extra.length} extra in the rack.`;
  } else if (missing.length) {
    summary = `Still missing: ${missing.join(', ')}`;
  } else if (extra.length) {
    summary = `Ticket endpoints met, with ${extra.length} extra cable end(s).`;
  }

  return {
    intended: intendedList,
    actual: actualList,
    matched,
    missing,
    extra,
    summary,
  };
}
