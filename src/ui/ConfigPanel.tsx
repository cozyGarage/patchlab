import { useState } from 'react';
import type { Device, Port, PortRef } from '../types/schema';

interface ConfigPanelProps {
  device: Device;
  consoleReady: boolean;
  powered: boolean;
  onSetIp: (port: PortRef, address: string, prefix: number, gateway?: string) => void;
  onFirewallPermitLan: () => void;
  onPing: (fromId: string, toId: string) => void;
  pingTargets: { id: string; name: string }[];
}

export function ConfigPanel({
  device,
  consoleReady,
  powered,
  onSetIp,
  onFirewallPermitLan,
  onPing,
  pingTargets,
}: ConfigPanelProps) {
  const ipPorts = device.ports.filter(
    (p) =>
      p.kind === 'data' ||
      p.kind === 'lan' ||
      p.kind === 'wan' ||
      p.role === 'nic' ||
      p.role === 'network',
  );
  const [portId, setPortId] = useState(ipPorts[0]?.id ?? '');
  const selected: Port | undefined = ipPorts.find((p) => p.id === portId) ?? ipPorts[0];
  const [address, setAddress] = useState(selected?.ip?.address ?? '');
  const [prefix, setPrefix] = useState(String(selected?.ip?.prefix ?? 24));
  const [gateway, setGateway] = useState(selected?.ip?.gateway ?? '');
  const [pingTo, setPingTo] = useState(pingTargets[0]?.id ?? '');

  function applyPort(nextId: string) {
    setPortId(nextId);
    const p = ipPorts.find((x) => x.id === nextId);
    setAddress(p?.ip?.address ?? '');
    setPrefix(String(p?.ip?.prefix ?? 24));
    setGateway(p?.ip?.gateway ?? '');
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
        </div>
      ) : null}

      <div className="config-block">
        <h4>Ping</h4>
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
      </div>
    </aside>
  );
}
