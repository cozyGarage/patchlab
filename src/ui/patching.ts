import type { Port, PortRef } from '../types/schema';
import { samePort } from '../types/schema';

/** Generous tap/drag radius for game-like patching. */
export const HIT_RADIUS = 42;
/** Magnetic snap radius while dragging a cable. */
export const SNAP_RADIUS = 64;
/** Pointer movement before a press becomes a drag. */
export const DRAG_THRESHOLD = 5;
/** Drag this far with no snap to yank a cord out. */
export const UNPLUG_FLING_DISTANCE = 72;

export interface LaidOutPortLike {
  ref: PortRef;
  port: Port;
  x: number;
  y: number;
}

export interface SnapOptions {
  exclude?: PortRef | null;
  preferMedia?: Port['media'];
  /** When true, busy ports are ignored (new patch / move onto free jack). */
  requireFree?: boolean;
  cables?: { ends: [PortRef, PortRef] }[];
  /** Soft-penalize media mismatches instead of hard-filtering. */
  softMedia?: boolean;
}

/** Port LED sits ~8px below the layout anchor. */
export function portCenter(p: LaidOutPortLike): { x: number; y: number } {
  return { x: p.x, y: p.y + 8 };
}

export function portIsBusy(
  cables: { ends: [PortRef, PortRef] }[],
  ref: PortRef,
): boolean {
  return cables.some(
    (c) => samePort(c.ends[0], ref) || samePort(c.ends[1], ref),
  );
}

/** Whether dropping/tapping `target` from `source` can land. */
export function isValidPatchTarget(
  source: PortRef,
  target: PortRef,
  cables: { ends: [PortRef, PortRef] }[],
  sourceMedia?: Port['media'],
  targetMedia?: Port['media'],
  requireMediaMatch = true,
): boolean {
  if (samePort(source, target)) return false;
  // Free→free: new cord. Busy→free: move end. Never land on a busy jack.
  if (portIsBusy(cables, target)) return false;
  if (
    requireMediaMatch &&
    sourceMedia &&
    targetMedia &&
    sourceMedia !== targetMedia
  ) {
    return false;
  }
  return true;
}

export function nearestPort(
  ports: LaidOutPortLike[],
  x: number,
  y: number,
  radius: number,
  options: SnapOptions = {},
): LaidOutPortLike | undefined {
  const {
    exclude,
    preferMedia,
    requireFree = false,
    cables = [],
    softMedia = true,
  } = options;

  let best: LaidOutPortLike | undefined;
  let bestScore = Number.POSITIVE_INFINITY;

  for (const p of ports) {
    if (exclude && samePort(p.ref, exclude)) continue;
    if (requireFree && portIsBusy(cables, p.ref)) continue;

    const c = portCenter(p);
    const dist = Math.hypot(c.x - x, c.y - y);
    if (dist > radius) continue;

    let score = dist;
    if (preferMedia && p.port.media !== preferMedia) {
      if (!softMedia) continue;
      score += radius * 0.55;
    }
    // Slight preference for open jacks even when busy is allowed.
    if (!requireFree && portIsBusy(cables, p.ref)) {
      score += radius * 0.25;
    }

    if (score < bestScore) {
      bestScore = score;
      best = p;
    }
  }
  return best;
}

export function nearerCableEnd(
  ends: [PortRef, PortRef],
  byCenter: Map<string, { x: number; y: number }>,
  x: number,
  y: number,
  keyOf: (ref: PortRef) => string,
): PortRef {
  const a = byCenter.get(keyOf(ends[0]));
  const b = byCenter.get(keyOf(ends[1]));
  if (!a) return ends[1];
  if (!b) return ends[0];
  const da = Math.hypot(a.x - x, a.y - y);
  const db = Math.hypot(b.x - x, b.y - y);
  return da <= db ? ends[0] : ends[1];
}
