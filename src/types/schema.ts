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
  | 'PING_FAIL';

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

export interface Device {
  id: string;
  role: DeviceRole;
  name: string;
  rackUnitStart: number;
  heightU: number;
  model?: string;
  ports: Port[];
  firewallRules?: FirewallRule[];
  poweredByDefault?: boolean;
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
  | {
      type: 'iface_ip';
      port: PortRef;
      address: string;
      prefix: number;
    }
  | { type: 'ping'; fromDeviceId: string; toDeviceId: string }
  | {
      type: 'firewall_rule';
      action: 'permit' | 'deny';
      srcCidr: string;
      dstCidr: string;
    };

export interface Inventory {
  copper_cat6: number;
  fiber_om4: number;
  power_c13: number;
  console_rj45: number;
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
  track?: 'copper' | 'fiber' | 'mixed' | 'power' | 'logic' | 'security';
  /** When false, do not merge rackBase facility cables (power harness). Default true. */
  useBaseCables?: boolean;
  lesson?: string;
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
  lastPing?: { ok: boolean; detail: string };
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
  | { type: 'PING'; fromDeviceId: string; toDeviceId: string };

export interface Score {
  correctness: 0 | 1 | 2 | 3;
  speed: 0 | 1 | 2 | 3;
  cleanliness: 0 | 1 | 2 | 3;
}

export interface ProgressSave {
  version: 1;
  clearedMissionIds: string[];
  stars: Record<string, Score>;
  sandboxUnlocked: boolean;
}

export interface SettingsSave {
  version: 1;
  sound: boolean;
  reducedHints: boolean;
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
