/** PatchLab simulation types — physical + logical networking trainer */

export type DeviceRole =
  | 'patch_panel'
  | 'fiber_tray'
  | 'switch'
  | 'server'
  | 'firewall'
  | 'pdu'
  | 'console_server';

export type MediaType =
  | 'copper_cat6'
  | 'fiber_om4'
  | 'power_c13'
  | 'console_rj45';

export type Connector = 'rj45' | 'lc' | 'c13' | 'console';
export type PortKind = 'data' | 'console' | 'power' | 'wan' | 'lan';
export type PortMode = 'access' | 'trunk';
export type LinkStatus = 'up' | 'down' | 'fault';
export type PortAdmin = 'up' | 'down';
export type CableColor =
  | 'blue'
  | 'yellow'
  | 'orange'
  | 'gray'
  | 'aqua'
  | 'black'
  | 'lightblue';
export type TipLevel = 'info' | 'success' | 'warn' | 'error';

export type TipCode =
  | 'CONNECTED'
  | 'DISCONNECTED'
  | 'LINK_UP'
  | 'ADMIN_DOWN'
  | 'VLAN_MISMATCH'
  | 'MEDIA_MISMATCH'
  | 'PORT_BUSY'
  | 'LABEL_MISMATCH'
  | 'OPEN_CIRCUIT'
  | 'GOAL_COMPLETE'
  | 'INVALID_PORTS'
  | 'HINT'
  | 'PORT_UPDATED'
  | 'NO_POWER'
  | 'IP_UPDATED'
  | 'FIREWALL_UPDATED'
  | 'PING_OK'
  | 'PING_FAIL'
  | 'NAT_UPDATED'
  | 'MODE_UPDATED'
  | 'ROUTE_UPDATED'
  | 'TRACEROUTE_OK'
  | 'TRACEROUTE_FAIL'
  | 'SANDBOX_SAVED';

export interface PortRef {
  deviceId: string;
  portId: string;
}

export interface IpConfig {
  address: string;
  prefix: number;
  gateway?: string;
}

export interface Port {
  id: string;
  deviceId: string;
  index: number;
  label: string;
  media: MediaType;
  connector: Connector;
  kind: PortKind;
  admin: PortAdmin;
  role: 'network' | 'nic' | 'panel' | 'fiber' | 'power' | 'console' | 'wan' | 'lan';
  vlanId?: number;
  accessVlan?: number;
  mode?: PortMode;
  allowedVlans?: number[];
  ip?: IpConfig;
}

export interface FirewallRule {
  id: string;
  action: 'permit' | 'deny';
  srcCidr: string;
  dstCidr: string;
  note?: string;
  enabled: boolean;
}

export interface NatRule {
  id: string;
  /** Omit / `static` = 1:1 static NAT. `pat` = overload / PAT. */
  mode?: 'static' | 'pat';
  /** Required for static NAT (inside host). Unused for PAT. */
  insideIp: string;
  /** Inside source pool for PAT, e.g. 10.10.10.0/24. */
  insideCidr?: string;
  outsideIp: string;
  enabled: boolean;
  overload?: boolean;
  note?: string;
}

/** Static / default route — longest prefix, then lowest admin distance, with failover. */
export interface RouteEntry {
  id: string;
  destCidr: string;
  nextHop: string;
  enabled: boolean;
  /** False when reachability tracking has withdrawn this configured route. */
  trackedUp?: boolean;
  /** Lower wins (Cisco-style). Default 1. */
  adminDistance?: number;
  note?: string;
}

export interface Device {
  id: string;
  role: DeviceRole;
  name: string;
  rackUnitStart: number;
  heightU: number;
  model?: string;
  ports: Port[];
  firewallRules?: FirewallRule[];
  natRules?: NatRule[];
  routes?: RouteEntry[];
  poweredByDefault?: boolean;
  /**
   * Cloud / remote host: reachable via WAN routing without a rack data cable
   * (e.g. BRANCH behind ISP-PEER).
   */
  cloudAttached?: boolean;
  /** When true, LAN→WAN/off-subnet egress needs a matching PAT/overload rule. */
  requiresOutboundNat?: boolean;
}

export interface TraceHop {
  ttl: number;
  deviceId?: string;
  name?: string;
  ip?: string;
  detail: string;
  ok: boolean;
}

export interface TraceResult {
  ok: boolean;
  detail: string;
  hops: TraceHop[];
}

export interface Cable {
  id: string;
  media: MediaType;
  color: CableColor;
  ends: [PortRef, PortRef];
  lengthM: number;
}

export interface RackState {
  devices: Device[];
  cables: Cable[];
}

export type Goal =
  | { type: 'link_up'; a: PortRef; b: PortRef }
  | { type: 'path_up'; from: PortRef; to: PortRef }
  | { type: 'port_in_path'; port: PortRef; from: PortRef; to: PortRef }
  | { type: 'no_cables_on'; ports: PortRef[] }
  | { type: 'cable_color_between'; a: PortRef; b: PortRef; color: CableColor }
  | { type: 'cable_media_between'; a: PortRef; b: PortRef; media: MediaType }
  | { type: 'device_powered'; deviceId: string }
  | { type: 'console_attached'; deviceId: string }
  | { type: 'console_link'; a: PortRef; b: PortRef }
  | {
      type: 'iface_ip';
      port: PortRef;
      address: string;
      prefix: number;
      gateway?: string;
    }
  | { type: 'ping'; fromDeviceId: string; toDeviceId: string }
  | { type: 'ping_fail'; fromDeviceId: string; toDeviceId: string }
  | {
      type: 'ping_public';
      fromDeviceId: string;
      publicIp: string;
      insideDeviceId: string;
    }
  | {
      type: 'firewall_rule';
      action: 'permit' | 'deny';
      srcCidr: string;
      dstCidr: string;
    }
  | { type: 'port_vlan'; port: PortRef; vlanId: number }
  | { type: 'port_mode'; port: PortRef; mode: PortMode }
  | { type: 'trunk_vlans'; port: PortRef; vlanIds: number[] }
  | {
      type: 'nat_static';
      deviceId: string;
      insideIp: string;
      outsideIp: string;
    }
  | {
      type: 'nat_pat';
      deviceId: string;
      insideCidr: string;
      outsideIp: string;
    }
  | {
      type: 'route_entry';
      deviceId: string;
      destCidr: string;
      nextHop: string;
      adminDistance?: number;
    }
  | {
      type: 'traceroute_ok';
      fromDeviceId: string;
      toDeviceId: string;
    };

export interface Inventory {
  copper_cat6: number;
  fiber_om4: number;
  power_c13: number;
  console_rj45: number;
}

export type MissionMode = 'guided' | 'practice' | 'challenge' | 'boss';
export type Difficulty = 1 | 2 | 3 | 4 | 5;
export type ToolId =
  | 'patch'
  | 'power'
  | 'console'
  | 'ip'
  | 'switchport'
  | 'acl'
  | 'nat'
  | 'pat'
  | 'route'
  | 'ping'
  | 'traceroute';

export interface LearningDesign {
  mode: MissionMode;
  difficulty: Difficulty;
  conceptsIntroduced: string[];
  conceptsPracticed: string[];
  deviceUnlocks?: string[];
  enabledTools: ToolId[];
  visibleObjectives: string[];
  ticketDetails?: string[];
  debrief: {
    outcome: string;
    explanation: string;
    question: string;
    answer: string;
  };
  hints: {
    prompt: string;
    evidence: string;
    action: string;
    solution?: string;
  };
}

export interface Mission {
  id: string;
  title: string;
  order: number;
  brief: string;
  constraints: string[];
  parTimeSec: number;
  hintAfterWrongAttempts: number;
  inventory: Inventory;
  initial: RackState;
  goals: Goal[];
  track?:
    | 'copper'
    | 'fiber'
    | 'mixed'
    | 'power'
    | 'logic'
    | 'security'
    | 'switching'
    | 'services'
    | 'routing';
  /** When false, do not merge rackBase facility cables (power harness). Default true. */
  useBaseCables?: boolean;
  lesson?: string;
  learning: LearningDesign;
}

export interface Tip {
  level: TipLevel;
  code: TipCode;
  message: string;
}

export interface PathInfo {
  portIds: string[];
  status: LinkStatus;
}

export interface HintGhost {
  a: PortRef;
  b: PortRef;
}

export interface SimSnapshot {
  rack: RackState;
  linkTable: Record<string, LinkStatus>;
  poweredDevices: Record<string, boolean>;
  consoleAttached: Record<string, boolean>;
  paths: PathInfo[];
  goalsMet: boolean[];
  complete: boolean;
  lastTip?: Tip;
  inventory: Inventory;
  hintGhost?: HintGhost | null;
  glowingPortIds: string[];
  lastPing?: {
    ok: boolean;
    detail: string;
    fromDeviceId?: string;
    toDeviceId?: string;
    targetIp?: string;
  };
  lastTrace?: TraceResult & { fromDeviceId: string; toDeviceId: string };
}

export type Intent =
  | {
      type: 'CONNECT';
      a: PortRef;
      b: PortRef;
      color?: CableColor;
      media?: MediaType;
    }
  | { type: 'DISCONNECT'; cableId: string }
  | { type: 'DISCONNECT_PORT'; port: PortRef }
  | { type: 'RESET' }
  | { type: 'REQUEST_HINT' }
  | { type: 'CYCLE_VLAN'; port: PortRef }
  | { type: 'TOGGLE_ADMIN'; port: PortRef }
  | {
      type: 'SET_IP';
      port: PortRef;
      address: string;
      prefix: number;
      gateway?: string;
    }
  | {
      type: 'UPSERT_FIREWALL_RULE';
      deviceId: string;
      rule: FirewallRule;
    }
  | { type: 'PING'; fromDeviceId: string; toDeviceId: string }
  | { type: 'PING_IP'; fromDeviceId: string; targetIp: string }
  | {
      type: 'TRACEROUTE';
      fromDeviceId: string;
      toDeviceId: string;
    }
  | { type: 'SET_VLAN'; port: PortRef; vlanId: number }
  | { type: 'SET_PORT_MODE'; port: PortRef; mode: PortMode }
  | {
      type: 'SET_NAT';
      deviceId: string;
      insideIp: string;
      outsideIp: string;
    }
  | {
      type: 'SET_PAT';
      deviceId: string;
      insideCidr: string;
      outsideIp: string;
    }
  | {
      type: 'SET_ROUTE';
      deviceId: string;
      destCidr: string;
      nextHop: string;
      adminDistance?: number;
    }
  | {
      type: 'LOAD_RACK';
      rack: RackState;
      inventory?: Inventory;
    };

export interface Score {
  correctness: 0 | 1 | 2 | 3;
  speed: 0 | 1 | 2 | 3;
  cleanliness: 0 | 1 | 2 | 3;
}

export type ConceptLevel = 'introduced' | 'practiced' | 'independent';

export interface ConceptProgress {
  level: ConceptLevel;
  successfulRuns: number;
  lowestHintLevel: number;
  lastPracticedAt: string;
}

export interface ProgressSave {
  version: 1;
  clearedMissionIds: string[];
  stars: Record<string, Score>;
  sandboxUnlocked: boolean;
  conceptProgress?: Record<string, ConceptProgress>;
}

export interface SettingsSave {
  version: 1;
  sound: boolean;
  reducedHints: boolean;
  /** First-run coach marks dismissed. */
  onboardingDone?: boolean;
}

export function portKey(ref: PortRef): string {
  return `${ref.deviceId}::${ref.portId}`;
}

export function samePort(a: PortRef, b: PortRef): boolean {
  return a.deviceId === b.deviceId && a.portId === b.portId;
}

export function emptyInventory(): Inventory {
  return {
    copper_cat6: 0,
    fiber_om4: 0,
    power_c13: 0,
    console_rj45: 0,
  };
}
