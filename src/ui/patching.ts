import type { Port, PortRef } from '../types/schema';
import { samePort } from '../types/schema';

/** Generous tap/drag radius for game-like patching. */
export const HIT_RADIUS = 38;
/** Magnetic snap radius while dragging a cable. */
export const SNAP_RADIUS = 56;
/** Pointer movement before a press becomes a drag. */
export const DRAG_THRESHOLD = 6;

export interface LaidOutPortLike {
  ref: PortRef;
  port: Port;
  x: number;
  y: number;
}

/** Port LED sits ~8px below the layout anchor. */
export function portCenter(p: LaidOutPortLike): { x: number; y: number } {
  return { x: p.x, y: p.y + 8 };
}

export function nearestPort(
  ports: LaidOutPortLike[],
  x: number,
  y: number,
  radius: number,
  exclude?: PortRef | null,
  preferMedia?: Port['media'],
): LaidOutPortLike | undefined {
  let best: LaidOutPortLike | undefined;
  let bestScore = Number.POSITIVE_INFINITY;

  for (const p of ports) {
    if (exclude && samePort(p.ref, exclude)) continue;
    const c = portCenter(p);
    const dist = Math.hypot(c.x - x, c.y - y);
    if (dist > radius) continue;
    // Prefer matching media, then closer ports.
    const mediaPenalty =
      preferMedia && p.port.media !== preferMedia ? radius * 0.35 : 0;
    const score = dist + mediaPenalty;
    if (score < bestScore) {
      bestScore = score;
      best = p;
    }
  }
  return best;
}

export function portIsBusy(
  cables: { ends: [PortRef, PortRef] }[],
  ref: PortRef,
): boolean {
  return cables.some(
    (c) => samePort(c.ends[0], ref) || samePort(c.ends[1], ref),
  );
}
