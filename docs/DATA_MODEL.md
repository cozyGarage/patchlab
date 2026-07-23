# PatchLab — Data Model & Simulation Engine

The engine is a pure TypeScript module. UI sends intents; engine returns a new immutable snapshot + events for animation/tips.

---

## Core entities

```
Rack
 ├── Device[]          (panel, switch, server)
 │    └── Port[]
 ├── Cable[]            (two endpoints)
 ├── Inventory          (spare cable counts)
 └── Goals             (mission win checks)
```

---

## TypeScript shapes (canonical)

See also `prototype/src/types/schema.ts`.

### Enums / unions

```ts
type DeviceRole = 'patch_panel' | 'switch' | 'server';
type MediaType = 'copper_cat6';          // MVP only
type Connector = 'rj45';
type LinkStatus = 'up' | 'down' | 'fault';
type PortAdmin = 'up' | 'down';
type CableColor = 'blue' | 'yellow' | 'orange' | 'gray';
```

### Port

```ts
interface Port {
  id: string;                 // "sw-3"
  deviceId: string;           // "tor-1"
  index: number;              // 1-based faceplate index
  label: string;              // human / documentation label
  media: MediaType;
  connector: Connector;
  admin: PortAdmin;
  vlanId?: number;            // switch ports; servers may have accessVlan
  accessVlan?: number;        // NIC expected VLAN
  role: 'network' | 'nic' | 'panel';
}
```

### Device

```ts
interface Device {
  id: string;
  role: DeviceRole;
  name: string;               // "ToR-SW-A"
  rackUnitStart: number;      // U position for layout
  heightU: number;
  ports: Port[];
}
```

### Cable

```ts
interface Cable {
  id: string;
  media: MediaType;
  color: CableColor;
  ends: [PortRef, PortRef];   // exactly two
  lengthM: number;
}

interface PortRef {
  deviceId: string;
  portId: string;
}
```

### Mission / scenario

```ts
interface Mission {
  id: string;
  title: string;
  order: number;
  brief: string;
  constraints: string[];
  initial: RackState;         // devices + pre-seeded cables
  inventory: { copper_cat6: number };
  goals: Goal[];
  hintAfterWrongAttempts: number; // default 2
  parTimeSec: number;             // speed star threshold
}

type Goal =
  | { type: 'link_up'; a: PortRef; b: PortRef }
  | { type: 'path_up'; from: PortRef; to: PortRef }
  | { type: 'port_label_equals'; port: PortRef; label: string }
  | { type: 'no_cables_on'; ports: PortRef[] }
  | { type: 'cable_color_between'; a: PortRef; b: PortRef; color: CableColor };
```

### Engine snapshot

```ts
interface RackState {
  devices: Device[];
  cables: Cable[];
}

interface SimSnapshot {
  rack: RackState;
  linkTable: Record<string, LinkStatus>; // key: portId
  paths: PathInfo[];                     // computed up paths
  goalsMet: boolean[];
  complete: boolean;
  lastTip?: Tip;
}

interface Tip {
  level: 'info' | 'success' | 'warn' | 'error';
  code: TipCode;
  message: string;
}

type TipCode =
  | 'CONNECTED'
  | 'DISCONNECTED'
  | 'LINK_UP'
  | 'ADMIN_DOWN'
  | 'VLAN_MISMATCH'
  | 'MEDIA_MISMATCH'
  | 'PORT_BUSY'
  | 'LABEL_MISMATCH'
  | 'OPEN_CIRCUIT'
  | 'GOAL_COMPLETE';
```

---

## Intents (UI → engine)

```ts
type Intent =
  | { type: 'CONNECT'; a: PortRef; b: PortRef; color?: CableColor }
  | { type: 'DISCONNECT'; cableId: string }
  | { type: 'DISCONNECT_PORT'; port: PortRef }
  | { type: 'RESET' }
  | { type: 'REQUEST_HINT' };
```

---

## Link resolution rules (MVP)

For two ports connected by a cable:

1. **Media/connector compatible?** else `fault` + `MEDIA_MISMATCH`
2. Either side `admin === 'down'`? → `down` + `ADMIN_DOWN`
3. If both ends have VLAN identity (switch `vlanId`, NIC `accessVlan`):
   - equal → candidate for `up`
   - unequal → `down` + `VLAN_MISMATCH`
4. Patch panel ports are **transparent** — they do not own VLANs; path continues through the panel to the far cable if present
5. Otherwise copper path with admin up → `up` + `LINK_UP`

### Path finding

Build undirected graph: port nodes; cables as edges; panel front/back may be modeled as a single port in MVP (simplified: panel port is just a pass-through node with degree ≤ 1 cable — learner patches panel ↔ switch only).

MVP topology convention:
- Learner cables: **Panel ↔ Switch** and **Switch ↔ Server**
- Path up when server NIC reaches switch port with matching VLAN and admin up

```
SERVER NIC --cable-- SW port (VLAN X) --cable-- PANEL port
```

Panel may be documentation endpoint only; for Mission 1, goals can be simple `link_up` pairs.

---

## Scoring

```ts
interface Score {
  correctness: 0 | 1 | 2 | 3; // goals met without illegal moves
  speed: 0 | 1 | 2 | 3;       // vs parTimeSec
  cleanliness: 0 | 1 | 2 | 3; // unused cables, hint use, extra patches
}
```

Heuristics (MVP):
- Correctness: all goals met = 3; met with &gt;3 undos = 2; etc.
- Speed: ≤ par = 3; ≤ 1.5×par = 2; else 1 if complete
- Cleanliness: −1 star for hint; −1 for each spare cable left plugged unused

---

## Persistence (local)

```ts
interface ProgressSave {
  version: 1;
  clearedMissionIds: string[];
  stars: Record<string, Score>;
  sandboxUnlocked: boolean;
}
```

Stored in `localStorage` key `patchlab.progress.v1`.

---

## Why this model stays fast

- No packet-by-packet simulation
- Link solve is O(ports + cables) per intent
- Immutable snapshots make React/Canvas rendering trivial
- Missions are data (JSON), not hard-coded UI branches
