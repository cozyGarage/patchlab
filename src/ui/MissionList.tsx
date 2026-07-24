import type { Mission, ProgressSave, SettingsSave } from '../types/schema';
import {
  isMissionUnlocked,
  starGlyph,
  totalStars,
} from '../lib/progress';
import {
  CHAPTERS,
  chapterForMission,
  chapterProgress,
  isChapterUnlocked,
  stageLabel,
} from '../lib/chapters';

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
  const stage = stageLabel(missions, progress);
  const pct = Math.round((cleared / Math.max(1, missions.length)) * 100);

  return (
    <div className="screen-home">
      <header className="hero">
        <div className="brand-mark brand">
          <span className="dot" aria-hidden />
          <span>PatchLab</span>
        </div>
        <h1 className="brand">Rack. Power. VLAN. Route. Firewall.</h1>
        <p>
          Clear each stage to unlock the next. Climb six chapters — from first
          copper patch to static routes — with instant link and ping feedback.
        </p>
      </header>

      <div className="stage-panel panel">
        <div className="stage-panel-top">
          <div>
            <div className="stage-kicker">Campaign progress</div>
            <div className="stage-title">
              {cleared >= missions.length
                ? 'All stages cleared'
                : `Stage ${stage.current} of ${stage.total}`}
            </div>
            <p className="stage-sub">
              {cleared >= missions.length
                ? 'Sandbox is open — experiment freely.'
                : stage.chapter
                  ? `Chapter ${stage.chapter.index}: ${stage.chapter.title} · ${stage.title}`
                  : stage.title}
            </p>
          </div>
          <div className="stage-stats">
            <span>
              Cleared <strong>{cleared}</strong>/{missions.length}
            </span>
            <span>
              Stars <strong className="stars">{totalStars(progress)}</strong>
            </span>
          </div>
        </div>
        <div
          className="stage-bar"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={missions.length}
          aria-valuenow={cleared}
          aria-label="Campaign stage progress"
        >
          <div className="stage-bar-fill" style={{ width: `${pct}%` }} />
        </div>
        <div className="chapter-rail">
          {CHAPTERS.map((ch) => {
            const prog = chapterProgress(ch, missions, progress);
            const unlocked = isChapterUnlocked(ch, missions, progress);
            const active = stage.chapter?.id === ch.id && cleared < missions.length;
            return (
              <div
                key={ch.id}
                className={[
                  'chapter-chip',
                  prog.complete ? 'complete' : '',
                  active ? 'active' : '',
                  !unlocked ? 'locked' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                title={ch.blurb}
              >
                <span className="chapter-chip-num">{ch.index}</span>
                <span className="chapter-chip-label">{ch.title}</span>
                <span className="chapter-chip-count">
                  {prog.cleared}/{prog.total}
                </span>
              </div>
            );
          })}
        </div>
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
        {CHAPTERS.map((chapter) => {
          const inChapter = missions.filter(
            (m) => m.order >= chapter.from && m.order <= chapter.to,
          );
          if (inChapter.length === 0) return null;
          const prog = chapterProgress(chapter, missions, progress);
          const unlocked = isChapterUnlocked(chapter, missions, progress);
          return (
            <section key={chapter.id} className="chapter-block">
              <header className="chapter-head">
                <div>
                  <div className="chapter-kicker">
                    Chapter {chapter.index}
                    {prog.complete ? ' · Cleared' : unlocked ? '' : ' · Locked'}
                  </div>
                  <h2>{chapter.title}</h2>
                  <p>{chapter.blurb}</p>
                </div>
                <div className="chapter-mini-bar" aria-hidden>
                  <div
                    className="chapter-mini-fill"
                    style={{
                      width: `${Math.round(
                        (prog.cleared / Math.max(1, prog.total)) * 100,
                      )}%`,
                    }}
                  />
                </div>
              </header>
              {inChapter.map((mission) => {
                const missionUnlocked = isMissionUnlocked(
                  mission.order,
                  progress,
                );
                const clearedMission = progress.clearedMissionIds.includes(
                  mission.id,
                );
                const track = mission.track ?? 'copper';
                const ch = chapterForMission(mission);
                return (
                  <button
                    key={mission.id}
                    type="button"
                    className={`mission-card ${clearedMission ? 'cleared' : ''} ${
                      !missionUnlocked ? 'locked' : ''
                    }`}
                    disabled={!missionUnlocked}
                    onClick={() => onSelect(mission)}
                  >
                    <div className="mission-num">{mission.order}</div>
                    <div className="mission-meta">
                      <h3>
                        {mission.title}{' '}
                        <span className={`track-pill track-${track}`}>
                          {track}
                        </span>
                      </h3>
                      <p>
                        {missionUnlocked
                          ? mission.brief
                          : `Clear Stage ${mission.order - 1} to unlock · ${
                              ch ? `Chapter ${ch.index}` : 'Campaign'
                            }`}
                      </p>
                    </div>
                    <div className="stars" aria-label="stars">
                      {clearedMission
                        ? starGlyph(progress.stars[mission.id])
                        : missionUnlocked
                          ? '▶'
                          : '🔒'}
                    </div>
                  </button>
                );
              })}
            </section>
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
          : 'Sandbox unlocks after Stage 3'}
      </button>
    </div>
  );
}
