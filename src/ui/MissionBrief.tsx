import type { Mission } from '../types/schema';
import { chapterForMission } from '../lib/chapters';
import {
  coachTipForMission,
  shouldOpenTicketDetails,
  type CampaignPace,
} from '../lib/campaignPace';
import { missions } from '../missions';

interface MissionBriefProps {
  mission: Mission;
  campaignPace?: CampaignPace;
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
      case 'console_link':
        return `Console ${g.a.portId} ↔ ${g.b.portId}`;
      case 'iface_ip':
        return `Set ${g.port.portId} = ${g.address}/${g.prefix}${
          g.gateway ? ` via ${g.gateway}` : ''
        }`;
      case 'ping':
        return `Ping ${g.fromDeviceId} → ${g.toDeviceId}`;
      case 'ping_fail':
        return `Ping must fail ${g.fromDeviceId} → ${g.toDeviceId}`;
      case 'ping_public':
        return `Ping ${g.publicIp} from ${g.fromDeviceId}`;
      case 'firewall_rule':
        return `FW ${g.action} ${g.srcCidr} → ${g.dstCidr}`;
      case 'port_vlan':
        return `Set ${g.port.portId} access VLAN ${g.vlanId}`;
      case 'port_mode':
        return `Set ${g.port.portId} mode ${g.mode}`;
      case 'trunk_vlans':
        return `Allow VLANs ${g.vlanIds.join(', ')} on ${g.port.portId}`;
      case 'nat_static':
        return `Static NAT ${g.insideIp} ↔ ${g.outsideIp}`;
      case 'nat_pat':
        return `PAT ${g.insideCidr} → ${g.outsideIp}`;
      case 'route_entry':
        return `Route ${g.destCidr} via ${g.nextHop}${
          g.adminDistance != null ? ` AD${g.adminDistance}` : ''
        }`;
      case 'traceroute_ok':
        return `Traceroute ${g.fromDeviceId} → ${g.toDeviceId}`;
      default:
        return `Goal ${i + 1}`;
    }
  });
}

export function MissionBrief({
  mission,
  campaignPace = 'easy',
  onBack,
  onStart,
}: MissionBriefProps) {
  const chapter = chapterForMission(mission);
  const total = missions.length;
  const learning = mission.learning;
  const mode = learning?.mode ?? 'guided';
  const visibleObjectives = learning?.visibleObjectives?.length
    ? learning.visibleObjectives
    : goalText(mission);
  const ticketDetails = learning
    ? learning.ticketDetails
    : mission.constraints;
  const modeLabel = mode.charAt(0).toUpperCase() + mode.slice(1);
  const openDetails = shouldOpenTicketDetails(mission, campaignPace);
  const coachTip = coachTipForMission(mission);
  const easy = campaignPace === 'easy';

  return (
    <div className="screen-brief">
      <button type="button" className="btn btn-ghost" onClick={onBack}>
        ← Campaign
      </button>
      <div className="brief-card panel">
        <div className="brand-mark brand">
          <span className="dot" aria-hidden />
          <span>PatchLab</span>
        </div>
        <div className="stage-badge">
          Stage {mission.order} of {total}
          {chapter
            ? ` · Chapter ${chapter.index}: ${chapter.title}`
            : ''}
        </div>
        <p
          className="mode-badge"
          aria-label={`${modeLabel} mode, difficulty ${learning?.difficulty ?? 'not rated'} out of 5`}
        >
          {modeLabel} mode · Difficulty {learning?.difficulty ?? '—'}/5
          {easy ? ' · Easy coaching' : ''}
        </p>
        <h1>{mission.title}</h1>
        <p>{mission.brief}</p>
        {easy && coachTip ? (
          <div className="lesson-callout coach-tip">
            <h3>Coach tip</h3>
            <p>{coachTip.replace(/^Coach:\s*/, '')}</p>
          </div>
        ) : null}
        {learning?.conceptsIntroduced.length ? (
          <div className="lesson-callout">
            <h3>Learning focus</h3>
            <ul className="checklist">
              {learning.conceptsIntroduced.map((concept) => (
                <li key={concept}>{concept}</li>
              ))}
            </ul>
          </div>
        ) : mission.lesson ? (
          <div className="lesson-callout">
            <h3>Learning focus</h3>
            <p>{mission.lesson}</p>
          </div>
        ) : null}
        <section aria-labelledby="mission-objectives-heading">
          <h3 id="mission-objectives-heading" className="section-title">
            Objectives
          </h3>
          <ul className="checklist">
            {visibleObjectives.map((item, index) => (
              <li key={`${index}-${item}`}>{item}</li>
            ))}
          </ul>
        </section>
        {ticketDetails?.length ? (
          <details open={openDetails}>
            <summary>Ticket details</summary>
            <ul className="checklist details-body">
              {ticketDetails.map((detail, index) => (
                <li key={`${index}-${detail}`}>{detail}</li>
              ))}
            </ul>
          </details>
        ) : null}
        {learning?.deviceUnlocks?.length ? (
          <section aria-labelledby="new-equipment-heading">
            <h3 id="new-equipment-heading" className="section-title">
              New equipment
            </h3>
            <ul className="checklist">
              {learning.deviceUnlocks.map((equipment) => (
                <li key={equipment}>{equipment}</li>
              ))}
            </ul>
          </section>
        ) : null}
        {mission.learning.mode === 'challenge' ||
        mission.learning.mode === 'boss' ? (
          <details open={easy}>
            <summary>Make a prediction before you start</summary>
            <p className="details-body">{mission.learning.debrief.question}</p>
          </details>
        ) : null}
        <div className="actions">
          <button type="button" className="btn btn-primary" onClick={onStart}>
            Start stage {mission.order}
          </button>
        </div>
      </div>
    </div>
  );
}

export { goalText };
