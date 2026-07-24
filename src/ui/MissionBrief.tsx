import type { Mission } from '../types/schema';

interface MissionBriefProps {
  mission: Mission;
  onBack: () => void;
  onStart: () => void;
}

function goalText(mission: Mission): string[] {
  return mission.goals.map((g, i) => {
    switch (g.type) {
      case 'link_up':
        return `Link up ${g.a.portId} ↔ ${g.b.portId}`;
      case 'path_up':
        return `Path up ${g.from.portId} → ${g.to.portId}`;
      case 'no_cables_on':
        return `Clear ${g.ports.map((p) => p.portId).join(', ')}`;
      case 'port_in_path':
        return `Include ${g.port.portId} on the active path`;
      case 'cable_color_between':
        return `Use a ${g.color} cable between ends`;
      case 'cable_media_between':
        return `Use ${
          g.media === 'fiber_om4'
            ? 'OM4 fiber'
            : g.media === 'power_c13'
              ? 'power'
              : g.media === 'console_rj45'
                ? 'console'
                : 'Cat6'
        } on ${g.a.portId} ↔ ${g.b.portId}`;
      case 'device_powered':
        return `Power ${g.deviceId}`;
      case 'console_attached':
        return `Console into ${g.deviceId}`;
      case 'iface_ip':
        return `Set ${g.port.portId} = ${g.address}/${g.prefix}`;
      case 'ping':
        return `Ping ${g.fromDeviceId} → ${g.toDeviceId}`;
      case 'ping_fail':
        return `Ping must fail ${g.fromDeviceId} → ${g.toDeviceId}`;
      case 'firewall_rule':
        return `FW ${g.action} ${g.srcCidr} → ${g.dstCidr}`;
      case 'port_vlan':
        return `Set ${g.port.portId} access VLAN ${g.vlanId}`;
      case 'port_mode':
        return `Set ${g.port.portId} mode ${g.mode}`;
      case 'nat_static':
        return `Static NAT ${g.insideIp} ↔ ${g.outsideIp}`;
      case 'route_entry':
        return `Route ${g.destCidr} via ${g.nextHop}`;
      default:
        return `Goal ${i + 1}`;
    }
  });
}

export function MissionBrief({ mission, onBack, onStart }: MissionBriefProps) {
  return (
    <div className="screen-brief">
      <button type="button" className="btn btn-ghost" onClick={onBack}>
        ← Missions
      </button>
      <div className="brief-card panel">
        <div className="brand-mark brand">
          <span className="dot" aria-hidden />
          <span>PatchLab</span>
        </div>
        <h1>{mission.title}</h1>
        <p>{mission.brief}</p>
        {mission.lesson ? (
          <div className="lesson-callout">
            <h3>Lesson</h3>
            <p>{mission.lesson}</p>
          </div>
        ) : null}
        <div>
          <h3 style={{ marginBottom: 8 }}>Win checklist</h3>
          <ul className="checklist">
            {goalText(mission).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        {mission.constraints.length > 0 ? (
          <div>
            <h3 style={{ marginBottom: 8 }}>Constraints</h3>
            <ul className="checklist">
              {mission.constraints.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </div>
        ) : null}
        <div className="actions">
          <button type="button" className="btn btn-primary" onClick={onStart}>
            Start patching
          </button>
        </div>
      </div>
    </div>
  );
}

export { goalText };
