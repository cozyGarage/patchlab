import { useEffect, useState } from 'react';
import type { Device, Port, PortMode, PortRef } from '../types/schema';

interface ConfigPanelProps {
  device: Device;
  consoleReady: boolean;
  powered: boolean;
  onSetIp: (port: PortRef, address: string, prefix: number, gateway?: string) => void;
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
  pingTargets: { id: string; name: string }[];
}

function ipCapablePorts(device: Device): Port[] {
  return device.ports.filter(
    (p) =>
      p.kind === 'data' ||
      p.kind === 'lan' ||
      p.kind === 'wan' ||
      p.role === 'nic' ||
      p.role === 'network',
  );
}

function switchCapablePorts(device: Device): Port[] {
  return device.ports.filter((p) => p.role === 'network');
}

function defaultPingTarget(
  deviceId: string,
  targets: { id: string; name: string }[],
): string {
  return targets.find((t) => t.id !== deviceId)?.id ?? '';
}

export function ConfigPanel({
  device,
  consoleReady,
  powered,
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
  pingTargets,
}: ConfigPanelProps) {
  const ipPorts = ipCapablePorts(device);
  const switchPorts = switchCapablePorts(device);
  const [portId, setPortId] = useState(ipPorts[0]?.id ?? '');
  const selected: Port | undefined = ipPorts.find((p) => p.id === portId) ?? ipPorts[0];
  const [address, setAddress] = useState(selected?.ip?.address ?? '');
  const [prefix, setPrefix] = useState(String(selected?.ip?.prefix ?? 24));
  const [gateway, setGateway] = useState(selected?.ip?.gateway ?? '');
  const [pingTo, setPingTo] = useState(
    defaultPingTarget(device.id, pingTargets),
  );
  const [swPortId, setSwPortId] = useState(switchPorts[0]?.id ?? '');
  const swPort = switchPorts.find((p) => p.id === swPortId) ?? switchPorts[0];
  const [vlan, setVlan] = useState(String(swPort?.vlanId ?? 10));
  const [natInside, setNatInside] = useState('10.10.10.10');
  const [natOutside, setNatOutside] = useState('203.0.113.10');
  const [routeDest, setRouteDest] = useState('198.51.100.0/24');
  const [routeHop, setRouteHop] = useState('203.0.113.2');
  const [routeAd, setRouteAd] = useState('1');
  const [patInside, setPatInside] = useState('10.10.10.0/24');
  const [patOutside, setPatOutside] = useState('203.0.113.1');
  const [aclAction, setAclAction] = useState<'permit' | 'deny'>('deny');
  const [aclSrc, setAclSrc] = useState('10.10.10.20/32');
  const [aclDst, setAclDst] = useState('198.51.100.0/24');

  // Resync form fields when the focused device changes so edits never
  // apply stale IP/gateway/ping values from the previous device.
  useEffect(() => {
    const nextIpPorts = ipCapablePorts(device);
    const nextSwitchPorts = switchCapablePorts(device);
    const nextPort = nextIpPorts[0];
    const nextSw = nextSwitchPorts[0];
    setPortId(nextPort?.id ?? '');
    setAddress(nextPort?.ip?.address ?? '');
    setPrefix(String(nextPort?.ip?.prefix ?? 24));
    setGateway(nextPort?.ip?.gateway ?? '');
    setSwPortId(nextSw?.id ?? '');
    setVlan(String(nextSw?.vlanId ?? 10));
    setPingTo(defaultPingTarget(device.id, pingTargets));
  }, [device.id]);

  // Keep ping/traceroute target off the currently focused device.
  useEffect(() => {
    const valid = pingTargets.filter((t) => t.id !== device.id);
    if (!valid.some((t) => t.id === pingTo)) {
      setPingTo(valid[0]?.id ?? '');
    }
  }, [device.id, pingTargets, pingTo]);

  function applyPort(nextId: string) {
    setPortId(nextId);
    const p = ipPorts.find((x) => x.id === nextId);
    setAddress(p?.ip?.address ?? '');
    setPrefix(String(p?.ip?.prefix ?? 24));
    setGateway(p?.ip?.gateway ?? '');
  }

  function applySwPort(nextId: string) {
    setSwPortId(nextId);
    const p = switchPorts.find((x) => x.id === nextId);
    setVlan(String(p?.vlanId ?? 10));
  }

  return (
    <aside className="config-panel panel">
      <div className="config-head">
        <div>
          <h3>{device.name}</h3>
          <p>
            {device.model ?? device.role} ·{' '}
            {powered ? (
              <span className="ok">Powered</span>
            ) : (
              <span className="bad">No power</span>
            )}
            {' · '}
            {consoleReady ? (
              <span className="ok">Console up</span>
            ) : (
              <span className="muted">No console</span>
            )}
          </p>
        </div>
      </div>

      {!consoleReady && device.role !== 'firewall' ? (
        <p className="config-note">
          Attach a console cable to unlock confident out-of-band changes (still
          editable here for training).
        </p>
      ) : null}

      {ipPorts.length > 0 ? (
        <div className="config-block">
          <h4>IPv4 / subnet</h4>
          <label>
            Interface
            <select
              value={selected?.id ?? ''}
              onChange={(e) => applyPort(e.target.value)}
            >
              {ipPorts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                  {p.ip ? ` (${p.ip.address}/${p.ip.prefix})` : ''}
                </option>
              ))}
            </select>
          </label>
          <label>
            Address
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="10.10.10.10"
            />
          </label>
          <label>
            Prefix
            <input
              value={prefix}
              onChange={(e) => setPrefix(e.target.value)}
              placeholder="24"
            />
          </label>
          <label>
            Gateway
            <input
              value={gateway}
              onChange={(e) => setGateway(e.target.value)}
              placeholder="10.10.10.1"
            />
          </label>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!selected}
            onClick={() => {
              if (!selected) return;
              onSetIp(
                { deviceId: device.id, portId: selected.id },
                address.trim(),
                Number(prefix),
                gateway.trim() || undefined,
              );
            }}
          >
            Apply IP
          </button>
        </div>
      ) : null}

      {device.role === 'switch' && switchPorts.length > 0 ? (
        <div className="config-block">
          <h4>Switchport</h4>
          <label>
            Port
            <select
              value={swPort?.id ?? ''}
              onChange={(e) => applySwPort(e.target.value)}
            >
              {switchPorts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label} · VLAN {p.vlanId ?? '—'} · {p.mode ?? 'access'}
                </option>
              ))}
            </select>
          </label>
          <label>
            Access VLAN
            <select value={vlan} onChange={(e) => setVlan(e.target.value)}>
              <option value="10">10</option>
              <option value="20">20</option>
              <option value="30">30</option>
            </select>
          </label>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!swPort}
            onClick={() => {
              if (!swPort) return;
              onSetVlan(
                { deviceId: device.id, portId: swPort.id },
                Number(vlan),
              );
            }}
          >
            Set access VLAN
          </button>
          <div className="btn-row">
            <button
              type="button"
              className="btn btn-ghost"
              disabled={!swPort}
              onClick={() => {
                if (!swPort) return;
                onSetPortMode(
                  { deviceId: device.id, portId: swPort.id },
                  'access',
                );
              }}
            >
              Mode access
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              disabled={!swPort}
              onClick={() => {
                if (!swPort) return;
                onSetPortMode(
                  { deviceId: device.id, portId: swPort.id },
                  'trunk',
                );
              }}
            >
              Mode trunk
            </button>
          </div>
        </div>
      ) : null}

      {device.role === 'firewall' ? (
        <div className="config-block">
          <h4>Firewall policy</h4>
          <ul className="rule-list">
            {(device.firewallRules ?? []).length === 0 ? (
              <li className="muted">No rules (open lab mode)</li>
            ) : (
              (device.firewallRules ?? []).map((r) => (
                <li key={r.id}>
                  <strong>{r.action}</strong> {r.srcCidr} → {r.dstCidr}{' '}
                  {r.enabled ? '' : '(disabled)'}
                </li>
              ))
            )}
          </ul>
          <button
            type="button"
            className="btn btn-primary"
            onClick={onFirewallPermitLan}
          >
            Insert permit 10.10.10.0/24 → 10.10.10.0/24
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onFirewallPermitLanWan}
          >
            Insert permit LAN → WAN
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onFirewallPermitWanLan}
          >
            Insert permit WAN → LAN
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onFirewallDenyHost}
          >
            Insert deny host 10.10.10.20 → WAN
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onFirewallDenyHostBranch}
          >
            Insert deny host 10.10.10.20 → BRANCH
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onFirewallPermitBranch}
          >
            Insert permit LAN → BRANCH
          </button>
          <div className="acl-custom">
            <label>
              Action
              <select
                value={aclAction}
                onChange={(e) =>
                  setAclAction(e.target.value as 'permit' | 'deny')
                }
              >
                <option value="permit">permit</option>
                <option value="deny">deny</option>
              </select>
            </label>
            <label>
              Source CIDR
              <input
                value={aclSrc}
                onChange={(e) => setAclSrc(e.target.value)}
                placeholder="10.10.10.20/32"
              />
            </label>
            <label>
              Dest CIDR
              <input
                value={aclDst}
                onChange={(e) => setAclDst(e.target.value)}
                placeholder="198.51.100.0/24"
              />
            </label>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => onFirewallCustomRule(aclAction, aclSrc, aclDst)}
            >
              Insert custom ACL
            </button>
          </div>
        </div>
      ) : null}

      {device.role === 'firewall' ? (
        <div className="config-block">
          <h4>Routes</h4>
          <ul className="rule-list">
            {(device.routes ?? []).length === 0 ? (
              <li className="muted">No static routes (connected only)</li>
            ) : (
              (device.routes ?? []).map((r) => (
                <li key={r.id}>
                  {r.destCidr} via {r.nextHop} (AD{r.adminDistance ?? 1}){' '}
                  {r.enabled ? '' : '(disabled)'}
                </li>
              ))
            )}
          </ul>
          <label>
            Destination CIDR
            <input
              value={routeDest}
              onChange={(e) => setRouteDest(e.target.value)}
              placeholder="198.51.100.0/24"
            />
          </label>
          <label>
            Next hop
            <input
              value={routeHop}
              onChange={(e) => setRouteHop(e.target.value)}
              placeholder="203.0.113.2"
            />
          </label>
          <label>
            Admin distance
            <input
              value={routeAd}
              onChange={(e) => setRouteAd(e.target.value)}
              placeholder="1"
            />
          </label>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              const ad = Number(routeAd);
              onSetRoute(
                routeDest.trim(),
                routeHop.trim(),
                Number.isFinite(ad) ? ad : 1,
              );
            }}
          >
            Apply route
          </button>
        </div>
      ) : null}

      {device.role === 'firewall' ? (
        <div className="config-block">
          <h4>NAT / PAT</h4>
          <ul className="rule-list">
            {(device.natRules ?? []).length === 0 ? (
              <li className="muted">No NAT mappings</li>
            ) : (
              (device.natRules ?? []).map((r) => (
                <li key={r.id}>
                  {r.mode === 'pat'
                    ? `PAT ${r.insideCidr} → ${r.outsideIp}${
                        r.overload ? ' overload' : ''
                      }`
                    : `${r.insideIp} ↔ ${r.outsideIp}`}{' '}
                  {r.enabled ? '' : '(disabled)'}
                </li>
              ))
            )}
          </ul>
          <label>
            Inside IP (static)
            <input
              value={natInside}
              onChange={(e) => setNatInside(e.target.value)}
              placeholder="10.10.10.10"
            />
          </label>
          <label>
            Outside IP (static)
            <input
              value={natOutside}
              onChange={(e) => setNatOutside(e.target.value)}
              placeholder="203.0.113.10"
            />
          </label>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => onSetNat(natInside.trim(), natOutside.trim())}
          >
            Apply static NAT
          </button>
          <label>
            Inside CIDR (PAT)
            <input
              value={patInside}
              onChange={(e) => setPatInside(e.target.value)}
              placeholder="10.10.10.0/24"
            />
          </label>
          <label>
            Outside IP (PAT)
            <input
              value={patOutside}
              onChange={(e) => setPatOutside(e.target.value)}
              placeholder="203.0.113.1"
            />
          </label>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => onSetPat(patInside.trim(), patOutside.trim())}
          >
            Apply PAT overload
          </button>
        </div>
      ) : null}

      <div className="config-block">
        <h4>Ping / Traceroute</h4>
        <label>
          Target
          <select value={pingTo} onChange={(e) => setPingTo(e.target.value)}>
            {pingTargets
              .filter((t) => t.id !== device.id)
              .map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
          </select>
        </label>
        <button
          type="button"
          className="btn btn-ghost"
          disabled={!pingTo}
          onClick={() => onPing(device.id, pingTo)}
        >
          Ping from {device.name}
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          disabled={!pingTo}
          onClick={() => onTraceroute(device.id, pingTo)}
        >
          Traceroute from {device.name}
        </button>
      </div>
    </aside>
  );
}
