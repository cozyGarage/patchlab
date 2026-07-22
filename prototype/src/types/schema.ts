/** Canonical PatchLab simulation types (MVP). */

export type DeviceRole = 'patch_panel' | 'switch' | 'server';
export type MediaType = 'copper_cat6';
export type Connector = 'rj45';
export type LinkStatus = 'up' | 'down' | 'fault';
export type PortAdmin = 'up' | 'down';
export type CableColor = 'blue' | 'yellow' | 'orange' | 'gray';
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
  | 'INVALID_PORTS';

export interface PortRef {
  deviceId: string;
  portId: string;
}

export interface Port {
  id: string;
  deviceId: string;
  index: number;
  label: string;
  media: MediaType;
  connector: Connector;
  admin: PortAdmin;
  role: 'network' | 'nic' | 'panel';
  vlanId?: number;
  accessVlan?: number;
}

export interface Device {
  id: string;
  role: DeviceRole;
  name: string;
  rackUnitStart: number;
  heightU: number;
  ports: Port[];
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
  | { type: 'cable_color_between'; a: PortRef; b: PortRef; color: CableColor };

export interface Mission {
  id: string;
  title: string;
  order: number;
  brief: string;
  constraints: string[];
  parTimeSec: number;
  hintAfterWrongAttempts: number;
  inventory: { copper_cat6: number };
  initial: RackState;
  goals: Goal[];
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

export interface SimSnapshot {
  rack: RackState;
  linkTable: Record<string, LinkStatus>;
  paths: PathInfo[];
  goalsMet: boolean[];
  complete: boolean;
  lastTip?: Tip;
  inventory: { copper_cat6: number };
}

export type Intent =
  | { type: 'CONNECT'; a: PortRef; b: PortRef; color?: CableColor }
  | { type: 'DISCONNECT'; cableId: string }
  | { type: 'DISCONNECT_PORT'; port: PortRef }
  | { type: 'RESET' }
  | { type: 'REQUEST_HINT' };

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

export function portKey(ref: PortRef): string {
  return `${ref.deviceId}::${ref.portId}`;
}

export function samePort(a: PortRef, b: PortRef): boolean {
  return a.deviceId === b.deviceId && a.portId === b.portId;
}
