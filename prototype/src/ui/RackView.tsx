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
  PortRef,
} from '../types/schema';
import { portKey, samePort } from '../types/schema';
import type { EngineState } from '../engine/reducer';
import { TipBar } from './TipBar';
import { goalText } from './MissionBrief';
import { ConfigPanel } from './ConfigPanel';

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
  onPing: (fromId: string, toId: string) => void;
  elapsedSec: number;
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
  onPing,
  elapsedSec,
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
  const selectedBeforeDrag = useRef<PortRef | null>(null);

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
      setPointer(null);
    }
  }, [state.snapshot.complete, sandbox]);

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

  function hitTest(x: number, y: number): LaidOutPort | undefined {
    return ports.find((p) => Math.hypot(p.x - x, p.y - (y - 8)) < 24);
  }

  function onPortPointerDown(e: ReactPointerEvent, ref: PortRef) {
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    selectedBeforeDrag.current = selected;
    const local = toSvgPoint(e.clientX, e.clientY);
    dragRef.current = {
      from: ref,
      startX: local.x,
      startY: local.y,
      moved: false,
    };
    setDragFrom(ref);
    setDragMoved(false);
    setPointer(local);
    setFocusDeviceId(ref.deviceId);
  }

  function onSvgPointerMove(e: ReactPointerEvent) {
    const drag = dragRef.current;
    if (!drag) return;
    const local = toSvgPoint(e.clientX, e.clientY);
    if (Math.hypot(local.x - drag.startX, local.y - drag.startY) > 10) {
      drag.moved = true;
      setDragMoved(true);
    }
    setPointer(local);
  }

  function onSvgPointerUp(e: ReactPointerEvent) {
    const drag = dragRef.current;
    if (!drag) return;
    const local = toSvgPoint(e.clientX, e.clientY);
    const hit = hitTest(local.x, local.y);

    if (drag.moved && hit && !samePort(hit.ref, drag.from)) {
      onConnect(drag.from, hit.ref);
      setSelected(null);
    } else if (!drag.moved) {
      const prev = selectedBeforeDrag.current;
      if (prev && !samePort(prev, drag.from)) {
        onConnect(prev, drag.from);
        setSelected(null);
      } else if (prev && samePort(prev, drag.from)) {
        setSelected(null);
      } else {
        setSelected(drag.from);
      }
    }

    dragRef.current = null;
    setDragFrom(null);
    setDragMoved(false);
    setPointer(null);
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

  const canEditPort =
    !!selectedPort &&
    selectedPort.role === 'network' &&
    selectedPort.media === 'copper_cat6';

  const showHint =
    !sandbox &&
    state.wrongAttempts >= state.mission.hintAfterWrongAttempts &&
    !state.snapshot.complete;

  const fromLayout = dragFrom ? byKey.get(portKey(dragFrom)) : null;
  const ghostDrag =
    fromLayout && pointer && dragMoved
      ? curvePath(fromLayout.x, fromLayout.y + 8, pointer.x, pointer.y)
      : null;

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
    .filter((d) =>
      ['server', 'firewall', 'switch'].includes(d.role),
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
          <button type="button" className="btn btn-ghost" onClick={onReset}>
            Reset
          </button>
        </div>
      </div>

      <div className="rack-workspace">
        <div className="rack-stage panel">
          <div className="rack-frame">
            <svg
              ref={svgRef}
              className="rack-svg"
              viewBox={`0 0 ${width} ${height}`}
              role="img"
              aria-label="Datacenter rack patching canvas"
              onPointerMove={onSvgPointerMove}
              onPointerUp={onSvgPointerUp}
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
                  glowing={
                    glowSet.has(portKey(cable.ends[0])) &&
                    glowSet.has(portKey(cable.ends[1]))
                  }
                  onSelect={(ref) => {
                    setSelected(ref);
                    setFocusDeviceId(ref.deviceId);
                  }}
                />
              ))}

              {ports.map((p) => {
                const status = state.snapshot.linkTable[portKey(p.ref)];
                const isSelected = !!selected && samePort(selected, p.ref);
                const vlan = p.port.vlanId ?? p.port.accessVlan;
                const isFiber = p.port.media === 'fiber_om4';
                const isPower = p.port.kind === 'power';
                const isConsole = p.port.kind === 'console';
                const glowing = glowSet.has(portKey(p.ref));
                const powered = !!state.snapshot.poweredDevices[p.device.id];
                const aria = [
                  p.device.name,
                  p.port.label,
                  vlan != null ? `VLAN ${vlan}` : null,
                  isFiber ? 'fiber' : null,
                  isPower ? 'power' : null,
                  isConsole ? 'console' : null,
                ]
                  .filter(Boolean)
                  .join(' ');

                return (
                  <g
                    key={portKey(p.ref)}
                    className="port-hit"
                    transform={`translate(${p.x}, ${p.y})`}
                    onPointerDown={(e) => onPortPointerDown(e, p.ref)}
                    role="button"
                    tabIndex={0}
                    aria-label={aria}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        if (selected && !samePort(selected, p.ref)) {
                          onConnect(selected, p.ref);
                          setSelected(null);
                        } else if (selected && samePort(selected, p.ref)) {
                          setSelected(null);
                        } else {
                          setSelected(p.ref);
                          setFocusDeviceId(p.ref.deviceId);
                        }
                      }
                    }}
                  >
                    {isPower ? (
                      <rect
                        className={`port-shell power ${isSelected ? 'selected' : ''} ${
                          glowing ? 'glowing' : ''
                        }`}
                        x={-11}
                        y={-2}
                        width={22}
                        height={20}
                        rx={3}
                      />
                    ) : isFiber ? (
                      <rect
                        className={`port-shell fiber ${isSelected ? 'selected' : ''} ${
                          glowing ? 'glowing' : ''
                        }`}
                        x={-13}
                        y={-5}
                        width={26}
                        height={26}
                        rx={5}
                        transform="rotate(45)"
                      />
                    ) : (
                      <rect
                        className={`port-shell ${isConsole ? 'console' : ''} ${
                          isSelected ? 'selected' : ''
                        } ${glowing ? 'glowing' : ''}`}
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
          onPing={onPing}
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
        canEditPort={canEditPort}
        onCycleVlan={
          selected && canEditPort ? () => onCycleVlan(selected) : undefined
        }
        onToggleAdmin={
          selected && canEditPort ? () => onToggleAdmin(selected) : undefined
        }
        onUnplugSelected={
          selected
            ? () => {
                onDisconnectPort(selected);
                setSelected(null);
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
}: {
  cable: Cable;
  byKey: Map<string, LaidOutPort>;
  glowing: boolean;
  onSelect: (ref: PortRef) => void;
}) {
  const a = byKey.get(portKey(cable.ends[0]));
  const b = byKey.get(portKey(cable.ends[1]));
  if (!a || !b) return null;
  const d = curvePath(a.x, a.y + 8, b.x, b.y + 8);
  return (
    <path
      className={`cable-path ${glowing ? 'cable-glow' : ''} media-${cable.media}`}
      d={d}
      stroke={CABLE_COLORS[cable.color] ?? CABLE_COLORS.blue}
      strokeWidth={cable.media === 'power_c13' ? 5 : 4}
      filter={glowing ? 'url(#glow)' : undefined}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(cable.ends[0]);
      }}
    >
      <title>
        {a.port.label} ↔ {b.port.label} ({cable.media})
      </title>
    </path>
  );
}
