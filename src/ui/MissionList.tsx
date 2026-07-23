import type { Mission, ProgressSave, SettingsSave } from '../types/schema';
import {
  isMissionUnlocked,
  starGlyph,
  totalStars,
} from '../lib/progress';

interface MissionListProps {
  missions: Mission[];
  progress: ProgressSave;
  settings: SettingsSave;
  onSelect: (mission: Mission) => void;
  onSandbox: () => void;
  onToggleSound: () => void;
  onOpenGlossary: () => void;
}

export function MissionList({
  missions,
  progress,
  settings,
  onSelect,
  onSandbox,
  onToggleSound,
  onOpenGlossary,
}: MissionListProps) {
  const cleared = progress.clearedMissionIds.length;

  return (
    <div className="screen-home">
      <header className="hero">
        <div className="brand-mark brand">
          <span className="dot" aria-hidden />
          <span>PatchLab</span>
        </div>
        <h1 className="brand">Rack. Power. VLAN. IP. Firewall.</h1>
        <p>
          Patch copper and fiber, then climb the CCNA stack — VLANs, trunks,
          gateways, NAT, and ACLs — with instant link and ping feedback.
        </p>
      </header>

      <div className="progress-strip panel">
        <span>
          Missions cleared{' '}
          <strong style={{ color: 'var(--ink)' }}>{cleared}</strong>/
          {missions.length}
        </span>
        <span>
          Stars <strong className="stars">{totalStars(progress)}</strong>
        </span>
      </div>

      <div className="home-toolbar">
        <button type="button" className="btn btn-ghost" onClick={onOpenGlossary}>
          Glossary
        </button>
        <button type="button" className="btn btn-ghost" onClick={onToggleSound}>
          Sound: {settings.sound ? 'On' : 'Off'}
        </button>
      </div>

      <div className="mission-list">
        {missions.map((mission) => {
          const unlocked = isMissionUnlocked(mission.order, progress);
          const clearedMission = progress.clearedMissionIds.includes(mission.id);
          const track = mission.track ?? 'copper';
          return (
            <button
              key={mission.id}
              type="button"
              className={`mission-card ${clearedMission ? 'cleared' : ''}`}
              disabled={!unlocked}
              onClick={() => onSelect(mission)}
            >
              <div className="mission-num">{mission.order}</div>
              <div className="mission-meta">
                <h3>
                  {mission.title}{' '}
                  <span className={`track-pill track-${track}`}>{track}</span>
                </h3>
                <p>
                  {unlocked
                    ? mission.brief
                    : 'Clear the previous mission to unlock'}
                </p>
              </div>
              <div className="stars" aria-label="stars">
                {clearedMission ? starGlyph(progress.stars[mission.id]) : '···'}
              </div>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        className="btn btn-ghost"
        disabled={!progress.sandboxUnlocked}
        onClick={onSandbox}
      >
        {progress.sandboxUnlocked
          ? 'Open Sandbox'
          : 'Sandbox unlocks after Mission 3'}
      </button>
    </div>
  );
}
