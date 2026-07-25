import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import type {
  Cable,
  Device,
  LinkStatus,
  Port,
  PortMode,
  PortRef,
} from '../types/schema';
import { portKey, samePort } from '../types/schema';
import type { EngineState } from '../engine/reducer';
import { TipBar } from './TipBar';
import { goalText } from './MissionBrief';
import { ConfigPanel } from './ConfigPanel';
import {
  DRAG_THRESHOLD,
  HIT_RADIUS,
  SNAP_RADIUS,
  UNPLUG_FLING_DISTANCE,
  isValidPatchTarget,
  nearerCableEnd,
  nearestPort,
  portIsBusy,
} from './patching';
import { haptic, playPatchSound } from '../lib/sound';

interface RackViewProps {
  state: EngineState;
  sandbox?: boolean;
  onConnect: (a: PortRef, b: PortRef) => void;
  onDisconnectPort: (port: PortRef) => void;
  onHint: () => void;
  onBack: () => void;
  onReset: () => void;
  onCycleVlan: (port: PortRef) => void;
  onToggleAdmin: (port: PortRef) => void;
  onSetIp: (
    port: PortRef,
    address: string,
    prefix: number,
    gateway?: string,
  ) => void;
  onFirewallPermitLan: () => void;
  onFirewallPermitLanWan: () => void;
  onFirewallPermitWanLan: () => void;
  onFirewallDenyHost: () => void;
  onFirewallDenyHostBranch: () => void;
  onFirewallCustomRule: (
    action: 'permit' | 'deny',
    srcCidr: string,
    dstCidr: string,
  ) => void;
  onSetNat: (insideIp: string, outsideIp: string) => void;
  onSetPat: (insideCidr: string, outsideIp: string) => void;
  onSetRoute: (
    destCidr: string,
    nextHop: string,
    adminDistance?: number,
  ) => void;
  onFirewallPermitBranch: () => void;
  onSetVlan: (port: PortRef, vlanId: number) => void;
  onSetPortMode: (port: PortRef, mode: PortMode) => void;
  onPing: (fromId: string, toId: string) => void;
  onTraceroute: (fromId: string, toId: string) => void;
  onSandboxSave?: () => void;
  onSandboxLoad?: () => void;
  onSandboxPreset?: (presetId: string) => void;
  sandboxPresets?: { id: string; title: string }[];
  elapsedSec: number;
  soundEnabled?: boolean;
}

interface LaidOutPort {
  ref: PortRef;
  port: Port;
  x: number;
  y: number;
  device: Device;
}

const CABLE_COLORS: Record<string, string> = {
  blue: '#3b82f6',
  yellow: '#e0a106',
  orange: '#f97316',
  gray: '#94a3b8',
  aqua: '#2dd4bf',
  black: '#111827',
  lightblue: '#7dd3fc',
};

const ROW_H = 92;

function layoutPorts(devices: Device[]): {
  ports: LaidOutPort[];
  width: number;
  height: number;
  ordered: Device[];
} {
  const width = 860;
  const marginX = 48;
  const startY = 58;
  const ports: LaidOutPort[] = [];
  const ordered = [...devices].sort((a, b) => b.rackUnitStart - a.rackUnitStart);

  ordered.forEach((device, row) => {
    const y = startY + row * ROW_H;
    // Keep console/power on the right cluster
    const data = device.ports.filter(
      (p) => p.kind === 'data' || p.kind === 'lan' || p.kind === 'wan',
    );
    const special = device.ports.filter(
      (p) => p.kind === 'console' || p.kind === 'power',
    );
    const orderedPorts = [...data, ...special];
    const count = orderedPorts.length || 1;
    const usable = width - marginX * 2 - 40;
    const gap = usable / (count + 1);

    orderedPorts.forEach((port, i) => {
      const x = marginX + 20 + gap * (i + 1);
      ports.push({
        ref: { deviceId: device.id, portId: port.id },
        port,
        x,
        y,
        device,
      });
    });
  });

  return {
    ports,
    width,
    height: startY + ordered.length * ROW_H + 36,
    ordered,
  };
}

function curvePath(x1: number, y1: number, x2: number, y2: number): string {
  const bulge = Math.min(58, Math.abs(y2 - y1) * 0.32 + 16);
  const c1y = y1 < y2 ? y1 + bulge : y1 - bulge;
  const c2y = y1 < y2 ? y2 - bulge : y2 + bulge;
  return `M ${x1} ${y1} C ${x1} ${c1y}, ${x2} ${c2y}, ${x2} ${y2}`;
}

function ledClass(
  status: LinkStatus | undefined,
  admin: Port['admin'],
  powered: boolean,
  kind: Port['kind'],
): string {
  if (kind === 'power') return status === 'up' ? 'power' : 'down';
  if (kind === 'console') return status === 'up' ? 'console' : 'down';
  if (!powered) return 'warn';
  if (admin === 'down') return 'warn';
  if (status === 'up') return 'up';
  if (status === 'fault') return 'fault';
  return 'down';
}

export function RackView({
  state,
  sandbox,
  onConnect,
  onDisconnectPort,
  onHint,
  onBack,
  onReset,
  onCycleVlan,
  onToggleAdmin,
  onSetIp,
  onFirewallPermitLan,
  onFirewallPermitLanWan,
  onFirewallPermitWanLan,
  onFirewallDenyHost,
  onFirewallDenyHostBranch,
  onFirewallCustomRule,
  onSetNat,
  onSetPat,
  onSetRoute,
  onFirewallPermitBranch,
  onSetVlan,
  onSetPortMode,
  onPing,
  onTraceroute,
  onSandboxSave,
  onSandboxLoad,
  onSandboxPreset,
  sandboxPresets,
  elapsedSec,
  soundEnabled = true,
}: RackViewProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [selected, setSelected] = useState<PortRef | null>(null);
  const [focusDeviceId, setFocusDeviceId] = useState<string | null>('tor-1');
  const dragRef = useRef<{
    from: PortRef;
    startX: number;
    startY: number;
    moved: boolean;
  } | null>(null);
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null);
  const [dragFrom, setDragFrom] = useState<PortRef | null>(null);
  const [dragMoved, setDragMoved] = useState(false);
  const [snapTarget, setSnapTarget] = useState<PortRef | null>(null);
  const [flashPorts, setFlashPorts] = useState<string[]>([]);
  const selectedBeforeDrag = useRef<PortRef | null>(null);
  const flashTimer = useRef<number | null>(null);
  const lastSnapKey = useRef<string | null>(null);
  /** After unplug, the next tap should re-aim, not instantly patch. */
  const suppressTapConnect = useRef(false);

  const { ports, width, height, ordered } = useMemo(
    () => layoutPorts(state.snapshot.rack.devices),
    [state.snapshot.rack.devices],
  );

  const byKey = useMemo(() => {
    const map = new Map<string, LaidOutPort>();
    for (const p of ports) map.set(portKey(p.ref), p);
    return map;
  }, [ports]);

  const glowSet = useMemo(
    () => new Set(state.snapshot.glowingPortIds),
    [state.snapshot.glowingPortIds],
  );

  useEffect(() => {
    if (state.snapshot.complete && !sandbox) {
      setSelected(null);
      dragRef.current = null;
      setDragFrom(null);
      setDragMoved(false);
      setSnapTarget(null);
      setPointer(null);
    }
  }, [state.snapshot.complete, sandbox]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setSelected(null);
        dragRef.current = null;
        setDragFrom(null);
        setDragMoved(false);
        setSnapTarget(null);
        setPointer(null);
        return;
      }
      if (
        (e.key === 'u' || e.key === 'U' || e.key === 'Backspace' || e.key === 'Delete') &&
        selected &&
        portIsBusy(state.snapshot.rack.cables, selected)
      ) {
        e.preventDefault();
        playPatchSound(soundEnabled, 'unplug');
        haptic(18);
        onDisconnectPort(selected);
        suppressTapConnect.current = true;
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selected, state.snapshot.rack.cables, onDisconnectPort, soundEnabled]);

  useEffect(() => {
    return () => {
      if (flashTimer.current != null) window.clearTimeout(flashTimer.current);
    };
  }, []);

  function toSvgPoint(clientX: number, clientY: number) {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const local = pt.matrixTransform(ctm.inverse());
    return { x: local.x, y: local.y };
  }

  function preferMediaFor(ref: PortRef): Port['media'] | undefined {
    return byKey.get(portKey(ref))?.port.media;
  }

  function hitTest(
    x: number,
    y: number,
    exclude?: PortRef | null,
    radius = HIT_RADIUS,
  ): LaidOutPort | undefined {
    return nearestPort(ports, x, y, radius, {
      exclude,
      preferMedia: exclude ? preferMediaFor(exclude) : undefined,
      requireFree: true,
      cables: state.snapshot.rack.cables,
      softMedia: false,
    }) as LaidOutPort | undefined;
  }

  function updateSnap(x: number, y: number, from: PortRef | null) {
    if (!from) {
      setSnapTarget(null);
      lastSnapKey.current = null;
      return;
    }
    const snap = hitTest(x, y, from, SNAP_RADIUS);
    const next = snap && !samePort(snap.ref, from) ? snap.ref : null;
    const key = next ? portKey(next) : null;
    if (key && key !== lastSnapKey.current) {
      playPatchSound(soundEnabled, 'snap');
    }
    lastSnapKey.current = key;
    setSnapTarget(next);
  }

  function flashConnect(a: PortRef, b: PortRef) {
    setFlashPorts([portKey(a), portKey(b)]);
    if (flashTimer.current != null) window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setFlashPorts([]), 280);
  }

  function completePatch(a: PortRef, b: PortRef) {
    // Allow media mismatches through to the engine (lesson tips), but never
    // land on a busy jack from the UI — use move-from-busy instead.
    if (
      !isValidPatchTarget(
        a,
        b,
        state.snapshot.rack.cables,
        undefined,
        undefined,
        false,
      )
    ) {
      playPatchSound(soundEnabled, 'reject');
      setSelected(a);
      setFocusDeviceId(a.deviceId);
      return;
    }
    onConnect(a, b);
    flashConnect(a, b);
    playPatchSound(soundEnabled, 'plug');
    haptic(14);
    setSelected(null);
    setFocusDeviceId(b.deviceId);
  }

  function yankUnplug(ref: PortRef) {
    if (!portIsBusy(state.snapshot.rack.cables, ref)) return false;
    playPatchSound(soundEnabled, 'unplug');
    haptic(18);
    onDisconnectPort(ref);
    setSelected(ref);
    setFocusDeviceId(ref.deviceId);
    suppressTapConnect.current = true;
    return true;
  }

  function onPortPointerDown(e: ReactPointerEvent, ref: PortRef) {
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    selectedBeforeDrag.current = suppressTapConnect.current
      ? null
      : selected;
    suppressTapConnect.current = false;
    const local = toSvgPoint(e.clientX, e.clientY);
    dragRef.current = {
      from: ref,
      startX: local.x,
      startY: local.y,
      moved: false,
    };
    setDragFrom(ref);
    setDragMoved(false);
    setSnapTarget(null);
    lastSnapKey.current = null;
    setPointer(local);
    setFocusDeviceId(ref.deviceId);
    // Instant arm feedback — feels like picking up a cord.
    setSelected(ref);
    playPatchSound(soundEnabled, 'arm');
  }

  function onSvgPointerMove(e: ReactPointerEvent) {
    const local = toSvgPoint(e.clientX, e.clientY);
    const drag = dragRef.current;
    if (drag) {
      if (
        Math.hypot(local.x - drag.startX, local.y - drag.startY) >
        DRAG_THRESHOLD
      ) {
        drag.moved = true;
        setDragMoved(true);
      }
      setPointer(local);
      updateSnap(local.x, local.y, drag.from);
      return;
    }
    // Hover ghost while a port is armed (tap-tap aim assist).
    if (selected) {
      setPointer(local);
      updateSnap(local.x, local.y, selected);
    }
  }

  function onSvgPointerUp(e: ReactPointerEvent) {
    const drag = dragRef.current;
    if (!drag) return;
    const local = toSvgPoint(e.clientX, e.clientY);
    const hit =
      hitTest(
        local.x,
        local.y,
        drag.from,
        drag.moved ? SNAP_RADIUS : HIT_RADIUS,
      ) ?? (snapTarget ? byKey.get(portKey(snapTarget)) : undefined);
    const flingDist = Math.hypot(local.x - drag.startX, local.y - drag.startY);

    if (drag.moved) {
      if (hit && !samePort(hit.ref, drag.from)) {
        completePatch(drag.from, hit.ref);
      } else if (
        flingDist >= UNPLUG_FLING_DISTANCE &&
        yankUnplug(drag.from)
      ) {
        // Yanked the cord into empty space.
      } else {
        // Missed drop: keep the cord in-hand on the source port.
        setSelected(drag.from);
        setFocusDeviceId(drag.from.deviceId);
      }
    } else {
      const prev = selectedBeforeDrag.current;
      if (prev && !samePort(prev, drag.from)) {
        completePatch(prev, drag.from);
      } else if (prev && samePort(prev, drag.from)) {
        // Second tap on same port = disarm (still easy to unplug via button).
        setSelected(null);
      } else {
        setSelected(drag.from);
      }
    }

    dragRef.current = null;
    setDragFrom(null);
    setDragMoved(false);
    setSnapTarget(null);
    lastSnapKey.current = null;
    setPointer(null);
  }

  function onSvgPointerLeave() {
    if (dragRef.current) return;
    setPointer(null);
    setSnapTarget(null);
    lastSnapKey.current = null;
  }

  const canUnplug =
    !!selected &&
    state.snapshot.rack.cables.some(
      (c) => samePort(c.ends[0], selected) || samePort(c.ends[1], selected),
    );

  const selectedPort = selected
    ? state.snapshot.rack.devices
        .find((d) => d.id === selected.deviceId)
        ?.ports.find((p) => p.id === selected.portId)
    : undefined;

  const canCycleVlan =
    !!selectedPort &&
    selectedPort.role === 'network' &&
    selectedPort.media === 'copper_cat6';
  const canToggleAdmin =
    !!selectedPort &&
    selectedPort.role === 'network' &&
    (selectedPort.kind === 'data' ||
      selectedPort.kind === 'lan' ||
      selectedPort.kind === 'wan');

  const showHint =
    !sandbox &&
    state.wrongAttempts >= state.mission.hintAfterWrongAttempts &&
    !state.snapshot.complete;

  const aimFrom = dragFrom ?? selected;
  const fromLayout = aimFrom ? byKey.get(portKey(aimFrom)) : null;
  const snapLayout = snapTarget ? byKey.get(portKey(snapTarget)) : null;
  const ghostDrag =
    fromLayout && pointer
      ? curvePath(
          fromLayout.x,
          fromLayout.y + 8,
          snapLayout ? snapLayout.x : pointer.x,
          snapLayout ? snapLayout.y + 8 : pointer.y,
        )
      : null;
  const cables = state.snapshot.rack.cables;

  const hintGhost = state.snapshot.hintGhost;
  const hintPath = (() => {
    if (!hintGhost) return null;
    const a = byKey.get(portKey(hintGhost.a));
    const b = byKey.get(portKey(hintGhost.b));
    if (!a || !b) return null;
    return curvePath(a.x, a.y + 8, b.x, b.y + 8);
  })();

  const focusDevice =
    state.snapshot.rack.devices.find((d) => d.id === focusDeviceId) ??
    state.snapshot.rack.devices[0]!;

  const pingTargets = state.snapshot.rack.devices
    .filter(
      (d) =>
        ['server', 'firewall', 'switch'].includes(d.role) ||
        d.cloudAttached ||
        d.id === 'wan-peer',
    )
    .map((d) => ({ id: d.id, name: d.name }));

  return (
    <div className="screen-rack">
      <div className="rack-topbar">
        <button type="button" className="btn btn-ghost" onClick={onBack}>
          ← {sandbox ? 'Home' : 'Brief'}
        </button>
        <h2>{sandbox ? 'Sandbox' : state.mission.title}</h2>
        <div className="rack-stats">
          {!sandbox ? <span>{elapsedSec}s</span> : <span>Live rack</span>}
          {sandbox && onSandboxSave ? (
            <button type="button" className="btn btn-ghost" onClick={onSandboxSave}>
              Save rack
            </button>
          ) : null}
          {sandbox && onSandboxLoad ? (
            <button type="button" className="btn btn-ghost" onClick={onSandboxLoad}>
              Load save
            </button>
          ) : null}
          <button type="button" className="btn btn-ghost" onClick={onReset}>
            Reset
          </button>
        </div>
      </div>

      {sandbox && sandboxPresets && onSandboxPreset ? (
        <div className="sandbox-presets">
          {sandboxPresets.map((p) => (
            <button
              key={p.id}
              type="button"
              className="btn btn-ghost"
              onClick={() => onSandboxPreset(p.id)}
            >
              {p.title}
            </button>
          ))}
        </div>
      ) : null}

      <div className="rack-workspace">
        <div className="rack-stage panel">
          <div className="rack-frame">
            <svg
              ref={svgRef}
              className={`rack-svg${aimFrom ? ' aiming' : ''}${dragMoved ? ' dragging' : ''}`}
              viewBox={`0 0 ${width} ${height}`}
              role="img"
              aria-label="Datacenter rack patching canvas"
              onPointerMove={onSvgPointerMove}
              onPointerUp={onSvgPointerUp}
              onPointerLeave={onSvgPointerLeave}
            >
              <defs>
                <linearGradient id="chassis" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3a4554" />
                  <stop offset="45%" stopColor="#252d38" />
                  <stop offset="100%" stopColor="#1a212b" />
                </linearGradient>
                <linearGradient id="rail" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#6b7280" />
                  <stop offset="50%" stopColor="#9ca3af" />
                  <stop offset="100%" stopColor="#6b7280" />
                </linearGradient>
                <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="2.6" result="b" />
                  <feMerge>
                    <feMergeNode in="b" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {/* Rack rails */}
              <rect x="8" y="8" width="14" height={height - 16} fill="url(#rail)" rx="2" />
              <rect
                x={width - 22}
                y="8"
                width="14"
                height={height - 16}
                fill="url(#rail)"
                rx="2"
              />

              {ordered.map((device, row) => {
                const y = 22 + row * ROW_H;
                const powered = state.snapshot.poweredDevices[device.id];
                const focused = device.id === focusDevice.id;
                const accent =
                  device.role === 'firewall'
                    ? '#f59e0b'
                    : device.role === 'pdu'
                      ? '#ef4444'
                      : device.role === 'fiber_tray' || device.id === 'tor-sfp'
                        ? '#2dd4bf'
                        : device.role === 'console_server'
                          ? '#7dd3fc'
                          : '#3ddcb5';
                return (
                  <g
                    key={device.id}
                    className="device-chassis"
                    onClick={() => setFocusDeviceId(device.id)}
                    style={{ cursor: 'pointer' }}
                  >
                    <rect
                      x={28}
                      y={y}
                      width={width - 56}
                      height={78}
                      rx={8}
                      fill="url(#chassis)"
                      stroke={focused ? accent : 'rgba(232,238,244,0.14)'}
                      strokeWidth={focused ? 2.2 : 1}
                    />
                    <rect
                      x={36}
                      y={y + 8}
                      width={6}
                      height={10}
                      rx={1}
                      fill={powered ? '#3ddcb5' : '#6b7280'}
                    />
                    <text className="device-label" x={50} y={y + 18}>
                      {device.name}
                    </text>
                    <text className="device-sub" x={50} y={y + 34}>
                      {device.model ?? device.role} · U{device.rackUnitStart}
                      {powered ? ' · PWR' : ' · OFF'}
                    </text>
                    {/* Fake status LCD for switches / firewall */}
                    {(device.role === 'switch' || device.role === 'firewall') && (
                      <g>
                        <rect
                          x={width - 210}
                          y={y + 10}
                          width={150}
                          height={22}
                          rx={3}
                          fill="#0b1220"
                          stroke="rgba(61,220,181,0.25)"
                        />
                        <text
                          x={width - 200}
                          y={y + 25}
                          fill="#3ddcb5"
                          fontSize={10}
                          fontFamily="IBM Plex Sans, monospace"
                        >
                          {device.role === 'firewall'
                            ? `ACL ${(device.firewallRules ?? []).length}`
                            : 'PORTS OK'}
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}

              {state.snapshot.rack.cables.map((cable) => (
                <CablePath
                  key={cable.id}
                  cable={cable}
                  byKey={byKey}
                  toSvgPoint={toSvgPoint}
                  glowing={
                    glowSet.has(portKey(cable.ends[0])) &&
                    glowSet.has(portKey(cable.ends[1]))
                  }
                  onSelect={(ref) => {
                    setSelected(ref);
                    setFocusDeviceId(ref.deviceId);
                    playPatchSound(soundEnabled, 'arm');
                  }}
                />
              ))}

              {ports.map((p) => {
                const status = state.snapshot.linkTable[portKey(p.ref)];
                const key = portKey(p.ref);
                const isSelected = !!selected && samePort(selected, p.ref);
                const isSnap =
                  !!snapTarget && samePort(snapTarget, p.ref) && !isSelected;
                const isFlash = flashPorts.includes(key);
                const vlan = p.port.vlanId ?? p.port.accessVlan;
                const isFiber = p.port.media === 'fiber_om4';
                const isPower = p.port.kind === 'power';
                const isConsole = p.port.kind === 'console';
                const glowing = glowSet.has(key);
                const powered = !!state.snapshot.poweredDevices[p.device.id];
                const busy = portIsBusy(cables, p.ref);
                const validTarget =
                  !!aimFrom &&
                  !isSelected &&
                  isValidPatchTarget(
                    aimFrom,
                    p.ref,
                    cables,
                    preferMediaFor(aimFrom),
                    p.port.media,
                  );
                const aria = [
                  p.device.name,
                  p.port.label,
                  vlan != null ? `VLAN ${vlan}` : null,
                  isFiber ? 'fiber' : null,
                  isPower ? 'power' : null,
                  isConsole ? 'console' : null,
                  busy ? 'patched' : 'open',
                ]
                  .filter(Boolean)
                  .join(' ');
                const shellClass = [
                  'port-shell',
                  isPower ? 'power' : '',
                  isFiber ? 'fiber' : '',
                  isConsole ? 'console' : '',
                  isSelected ? 'selected' : '',
                  isSnap ? 'snap-target' : '',
                  !isSnap && validTarget ? 'valid-target' : '',
                  isFlash ? 'flash' : '',
                  glowing ? 'glowing' : '',
                ]
                  .filter(Boolean)
                  .join(' ');

                return (
                  <g
                    key={key}
                    className="port-hit"
                    transform={`translate(${p.x}, ${p.y})`}
                    onPointerDown={(e) => onPortPointerDown(e, p.ref)}
                    role="button"
                    tabIndex={0}
                    aria-label={aria}
                    aria-pressed={isSelected}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        e.preventDefault();
                        setSelected(null);
                        return;
                      }
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        if (selected && !samePort(selected, p.ref)) {
                          completePatch(selected, p.ref);
                        } else if (selected && samePort(selected, p.ref)) {
                          setSelected(null);
                        } else {
                          setSelected(p.ref);
                          setFocusDeviceId(p.ref.deviceId);
                        }
                      }
                    }}
                  >
                    <circle className="port-hit-pad" r={22} cx={0} cy={8} />
                    {isPower ? (
                      <rect
                        className={shellClass}
                        x={-11}
                        y={-2}
                        width={22}
                        height={20}
                        rx={3}
                      />
                    ) : isFiber ? (
                      <rect
                        className={shellClass}
                        x={-13}
                        y={-5}
                        width={26}
                        height={26}
                        rx={5}
                        transform="rotate(45)"
                      />
                    ) : (
                      <rect
                        className={shellClass}
                        x={-12}
                        y={-2}
                        width={24}
                        height={20}
                        rx={3}
                      />
                    )}
                    <circle
                      className={`port-led ${ledClass(
                        status,
                        p.port.admin,
                        powered,
                        p.port.kind,
                      )} ${status === 'up' ? 'pulse' : ''}`}
                      r={4.5}
                      cy={8}
                    />
                    <text
                      textAnchor="middle"
                      y={34}
                      fill="#9aa8b5"
                      fontSize={9}
                      fontFamily="IBM Plex Sans, sans-serif"
                    >
                      {p.port.label}
                      {vlan != null ? ` · v${vlan}` : ''}
                    </text>
                  </g>
                );
              })}

              {hintPath ? (
                <path
                  className="cable-hint"
                  d={hintPath}
                  filter="url(#glow)"
                  data-testid="hint-ghost"
                />
              ) : null}
              {ghostDrag ? <path className="cable-ghost" d={ghostDrag} /> : null}
            </svg>
          </div>
        </div>

        <ConfigPanel
          device={focusDevice}
          consoleReady={!!state.snapshot.consoleAttached[focusDevice.id]}
          powered={!!state.snapshot.poweredDevices[focusDevice.id]}
          onSetIp={onSetIp}
          onFirewallPermitLan={onFirewallPermitLan}
          onFirewallPermitLanWan={onFirewallPermitLanWan}
          onFirewallPermitWanLan={onFirewallPermitWanLan}
          onFirewallDenyHost={onFirewallDenyHost}
          onFirewallDenyHostBranch={onFirewallDenyHostBranch}
          onFirewallCustomRule={onFirewallCustomRule}
          onSetNat={onSetNat}
          onSetPat={onSetPat}
          onSetRoute={onSetRoute}
          onFirewallPermitBranch={onFirewallPermitBranch}
          onSetVlan={onSetVlan}
          onSetPortMode={onSetPortMode}
          onPing={onPing}
          onTraceroute={onTraceroute}
          pingTargets={pingTargets}
        />
      </div>

      <TipBar
        tip={state.snapshot.lastTip}
        inventory={state.snapshot.inventory}
        goalsMet={sandbox ? [] : state.snapshot.goalsMet}
        goalLabels={sandbox ? [] : goalText(state.mission)}
        showHint={showHint}
        onHint={onHint}
        canUnplug={canUnplug}
        sandbox={sandbox}
        armedLabel={
          selectedPort
            ? `${byKey.get(portKey(selected!))?.device.name ?? ''} ${selectedPort.label}`.trim()
            : undefined
        }
        canCycleVlan={canCycleVlan}
        canToggleAdmin={canToggleAdmin}
        onCycleVlan={
          selected && canCycleVlan ? () => onCycleVlan(selected) : undefined
        }
        onToggleAdmin={
          selected && canToggleAdmin ? () => onToggleAdmin(selected) : undefined
        }
        onUnplugSelected={
          selected
            ? () => {
                yankUnplug(selected);
              }
            : undefined
        }
      />
    </div>
  );
}

function CablePath({
  cable,
  byKey,
  glowing,
  onSelect,
  toSvgPoint,
}: {
  cable: Cable;
  byKey: Map<string, LaidOutPort>;
  glowing: boolean;
  onSelect: (ref: PortRef) => void;
  toSvgPoint: (clientX: number, clientY: number) => { x: number; y: number };
}) {
  const a = byKey.get(portKey(cable.ends[0]));
  const b = byKey.get(portKey(cable.ends[1]));
  if (!a || !b) return null;
  const d = curvePath(a.x, a.y + 8, b.x, b.y + 8);
  const stroke = CABLE_COLORS[cable.color] ?? CABLE_COLORS.blue;
  const width = cable.media === 'power_c13' ? 5 : 4;
  return (
    <g
      className="cable-hit"
      onPointerDown={(e) => {
        e.stopPropagation();
        const local = toSvgPoint(e.clientX, e.clientY);
        const centers = new Map([
          [portKey(cable.ends[0]), { x: a.x, y: a.y + 8 }],
          [portKey(cable.ends[1]), { x: b.x, y: b.y + 8 }],
        ]);
        onSelect(
          nearerCableEnd(
            cable.ends,
            centers,
            local.x,
            local.y,
            portKey,
          ),
        );
      }}
    >
      <path
        className="cable-path-hit"
        d={d}
        stroke="transparent"
        strokeWidth={18}
        fill="none"
        strokeLinecap="round"
      />
      <path
        className={`cable-path ${glowing ? 'cable-glow' : ''} media-${cable.media}`}
        d={d}
        stroke={stroke}
        strokeWidth={width}
        filter={glowing ? 'url(#glow)' : undefined}
      >
        <title>
          {a.port.label} ↔ {b.port.label} ({cable.media})
        </title>
      </path>
    </g>
  );
}
