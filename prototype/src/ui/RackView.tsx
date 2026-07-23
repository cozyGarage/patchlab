import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import type { Cable, Device, LinkStatus, Port, PortRef } from '../types/schema';
import { portKey, samePort } from '../types/schema';
import type { EngineState } from '../engine/reducer';
import { TipBar } from './TipBar';
import { goalText } from './MissionBrief';

interface RackViewProps {
  state: EngineState;
  sandbox?: boolean;
  onConnect: (a: PortRef, b: PortRef) => void;
  onDisconnectPort: (port: PortRef) => void;
  onHint: () => void;
  onBack: () => void;
  onReset: () => void;
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
};

function layoutPorts(devices: Device[]): {
  ports: LaidOutPort[];
  width: number;
  height: number;
} {
  const width = 720;
  const marginX = 36;
  const rowH = 88;
  const startY = 56;
  const ports: LaidOutPort[] = [];
  const ordered = [...devices].sort((a, b) => b.rackUnitStart - a.rackUnitStart);

  ordered.forEach((device, row) => {
    const y = startY + row * rowH;
    const count = device.ports.length;
    const usable = width - marginX * 2;
    const gap = count <= 1 ? 0 : usable / (count + 1);

    device.ports.forEach((port, i) => {
      const x = count === 1 ? width / 2 : marginX + gap * (i + 1);
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
    height: startY + ordered.length * rowH + 36,
  };
}

function curvePath(x1: number, y1: number, x2: number, y2: number): string {
  const bulge = Math.min(60, Math.abs(y2 - y1) * 0.35 + 20);
  const c1y = y1 < y2 ? y1 + bulge : y1 - bulge;
  const c2y = y1 < y2 ? y2 - bulge : y2 + bulge;
  return `M ${x1} ${y1} C ${x1} ${c1y}, ${x2} ${c2y}, ${x2} ${y2}`;
}

function ledClass(status: LinkStatus | undefined, admin: Port['admin']): string {
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
  elapsedSec,
}: RackViewProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [selected, setSelected] = useState<PortRef | null>(null);
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

  const { ports, width, height } = useMemo(
    () => layoutPorts(state.snapshot.rack.devices),
    [state.snapshot.rack.devices],
  );

  const byKey = useMemo(() => {
    const map = new Map<string, LaidOutPort>();
    for (const p of ports) map.set(portKey(p.ref), p);
    return map;
  }, [ports]);

  const devices = useMemo(
    () =>
      [...state.snapshot.rack.devices].sort(
        (a, b) => b.rackUnitStart - a.rackUnitStart,
      ),
    [state.snapshot.rack.devices],
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

  const showHint =
    !sandbox &&
    state.wrongAttempts >= state.mission.hintAfterWrongAttempts &&
    !state.snapshot.complete;

  const fromLayout = dragFrom ? byKey.get(portKey(dragFrom)) : null;
  const ghost =
    fromLayout && pointer && dragMoved
      ? curvePath(fromLayout.x, fromLayout.y + 8, pointer.x, pointer.y)
      : null;

  return (
    <div className="screen-rack">
      <div className="rack-topbar">
        <button type="button" className="btn btn-ghost" onClick={onBack}>
          ← {sandbox ? 'Home' : 'Brief'}
        </button>
        <h2>{sandbox ? 'Sandbox' : state.mission.title}</h2>
        <div className="rack-stats">
          {!sandbox ? <span>{elapsedSec}s</span> : null}
          <button type="button" className="btn btn-ghost" onClick={onReset}>
            Reset
          </button>
        </div>
      </div>

      <div className="rack-stage panel">
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
            <linearGradient id="rackFace" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2a3340" />
              <stop offset="100%" stopColor="#1b2128" />
            </linearGradient>
          </defs>

          {devices.map((device, row) => {
            const y = 28 + row * 88;
            return (
              <g key={device.id}>
                <rect
                  x={20}
                  y={y}
                  width={width - 40}
                  height={70}
                  rx={10}
                  fill="url(#rackFace)"
                  stroke="rgba(232,238,244,0.12)"
                />
                <text className="device-label" x={34} y={y + 20}>
                  {device.name}
                </text>
                <text className="device-sub" x={34} y={y + 36}>
                  {device.role.replace('_', ' ')} · U{device.rackUnitStart}
                </text>
              </g>
            );
          })}

          {state.snapshot.rack.cables.map((cable) => (
            <CablePath
              key={cable.id}
              cable={cable}
              byKey={byKey}
              onSelect={(ref) => setSelected(ref)}
            />
          ))}

          {ghost ? <path className="cable-ghost" d={ghost} /> : null}

          {ports.map((p) => {
            const status = state.snapshot.linkTable[portKey(p.ref)];
            const isSelected = !!selected && samePort(selected, p.ref);
            const vlan = p.port.vlanId ?? p.port.accessVlan;
            return (
              <g
                key={portKey(p.ref)}
                className="port-hit"
                transform={`translate(${p.x}, ${p.y})`}
                onPointerDown={(e) => onPortPointerDown(e, p.ref)}
                role="button"
                tabIndex={0}
                aria-label={`${p.port.label}${vlan != null ? ` VLAN ${vlan}` : ''}`}
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
                    }
                  }
                }}
              >
                <circle
                  className={`port-shell ${isSelected ? 'selected' : ''}`}
                  r={16}
                  cy={8}
                />
                <circle
                  className={`port-led ${ledClass(status, p.port.admin)} ${
                    status === 'up' ? 'pulse' : ''
                  }`}
                  r={6}
                  cy={8}
                />
                <text
                  textAnchor="middle"
                  y={36}
                  fill="#9aa8b5"
                  fontSize={10}
                  fontFamily="IBM Plex Sans, sans-serif"
                >
                  {p.port.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <TipBar
        tip={state.snapshot.lastTip}
        inventory={state.snapshot.inventory.copper_cat6}
        goalsMet={sandbox ? [] : state.snapshot.goalsMet}
        goalLabels={sandbox ? [] : goalText(state.mission)}
        showHint={showHint}
        onHint={onHint}
        canUnplug={canUnplug}
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
  onSelect,
}: {
  cable: Cable;
  byKey: Map<string, LaidOutPort>;
  onSelect: (ref: PortRef) => void;
}) {
  const a = byKey.get(portKey(cable.ends[0]));
  const b = byKey.get(portKey(cable.ends[1]));
  if (!a || !b) return null;
  const d = curvePath(a.x, a.y + 8, b.x, b.y + 8);
  return (
    <path
      className="cable-path"
      d={d}
      stroke={CABLE_COLORS[cable.color] ?? CABLE_COLORS.blue}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(cable.ends[0]);
      }}
    >
      <title>
        {a.port.label} ↔ {b.port.label}
      </title>
    </path>
  );
}
