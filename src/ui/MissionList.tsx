import type { Mission, ProgressSave, SettingsSave } from '../types/schema';
import {
  GATE,
  isMissionUnlocked,
  missionUnlockReason,
  starGlyph,
  totalStars,
} from '../lib/progress';
import {
  CHAPTERS,
  chapterForMission,
  chapterProgress,
  isChapterUnlocked,
  sandboxGate,
  stageLabel,
  starTotal,
} from '../lib/chapters';

interface MissionListProps {
  missions: Mission[];
  progress: ProgressSave;
  settings: SettingsSave;
  onSelect: (mission: Mission) => void;
  onSandbox: () => void;
  onToggleSound: () => void;
  onOpenGlossary: () => void;
  onExportProgress?: () => void;
  onImportProgress?: (raw: string) => void;
  onResetProgress?: () => void;
  onReplayOnboarding?: () => void;
}

export function MissionList({
  missions,
  progress,
  settings,
  onSelect,
  onSandbox,
  onToggleSound,
  onOpenGlossary,
  onExportProgress,
  onImportProgress,
  onResetProgress,
  onReplayOnboarding,
}: MissionListProps) {
  const cleared = progress.clearedMissionIds.length;
  const stage = stageLabel(missions, progress);
  const pct = Math.round((cleared / Math.max(1, missions.length)) * 100);
  const sandbox = sandboxGate(missions, progress);

  return (
    <div className="screen-home">
      <header className="hero">
        <div className="brand-mark brand">
          <span className="dot" aria-hidden />
          <span>PatchLab</span>
        </div>
        <h1 className="brand">Rack. Power. VLAN. Route. Firewall.</h1>
        <p>
          {CHAPTERS.length} chapters · {missions.length} stages. Clear a stage
          with at least {GATE.minStarsToAdvance}★ to advance — chapter borders
          need {GATE.minStarsPerMissionForChapter}★ on every stage in that
          chapter.
        </p>
      </header>

      <div className="stage-panel panel">
        <div className="stage-panel-top">
          <div>
            <div className="stage-kicker">Campaign progress · hard gates</div>
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
            <span className="gate-hint">
              Gate {GATE.minStarsToAdvance}★ / stage
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
            const active =
              stage.chapter?.id === ch.id && cleared < missions.length;
            return (
              <div
                key={ch.id}
                className={[
                  'chapter-chip',
                  prog.gatedComplete ? 'complete' : '',
                  prog.complete && !prog.gatedComplete ? 'soft-clear' : '',
                  active ? 'active' : '',
                  !unlocked ? 'locked' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                title={
                  prog.gatedComplete
                    ? `${ch.blurb} · Chapter gate passed`
                    : prog.complete
                      ? `${ch.blurb} · Need ≥${GATE.minStarsPerMissionForChapter}★ on each stage`
                      : ch.blurb
                }
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
        {onReplayOnboarding ? (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onReplayOnboarding}
          >
            Tips
          </button>
        ) : null}
        {onExportProgress ? (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onExportProgress}
          >
            Export progress
          </button>
        ) : null}
        {onImportProgress ? (
          <label className="btn btn-ghost import-label">
            Import
            <input
              type="file"
              accept="application/json,.json"
              hidden
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const text = await file.text();
                onImportProgress(text);
                e.target.value = '';
              }}
            />
          </label>
        ) : null}
        {onResetProgress ? (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onResetProgress}
          >
            Reset progress
          </button>
        ) : null}
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
                    {prog.gatedComplete
                      ? ' · Gate passed'
                      : prog.complete
                        ? ' · Cleared — boost stars to open next chapter'
                        : unlocked
                          ? ''
                          : ' · Locked'}
                  </div>
                  <h2>{chapter.title}</h2>
                  <p>
                    {chapter.blurb}{' '}
                    <span className="gate-hint">
                      ({prog.stars}/{prog.maxStars}★ · need ≥
                      {GATE.minStarsPerMissionForChapter}★ each to exit)
                    </span>
                  </p>
                </div>
                <div className="chapter-mini-bar" aria-hidden>
                  <div
                    className="chapter-mini-fill"
                    style={{
                      width: `${Math.round(
                        (prog.stars / Math.max(1, prog.maxStars)) * 100,
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
                const lockReason = missionUnlockReason(mission.order, progress);
                const clearedMission = progress.clearedMissionIds.includes(
                  mission.id,
                );
                const track = mission.track ?? 'copper';
                const ch = chapterForMission(mission);
                const earned = starTotal(progress.stars[mission.id]);
                return (
                  <button
                    key={mission.id}
                    type="button"
                    className={`mission-card ${clearedMission ? 'cleared' : ''} ${
                      !missionUnlocked ? 'locked' : ''
                    } ${
                      clearedMission && earned < GATE.minStarsToAdvance
                        ? 'needs-stars'
                        : ''
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
                          ? clearedMission && earned < GATE.minStarsToAdvance
                            ? `Cleared with ${earned}★ — earn ${GATE.minStarsToAdvance}★ to unlock Stage ${
                                mission.order + 1
                              }. Retry for a cleaner run.`
                            : mission.brief
                          : lockReason ??
                            `Locked · ${ch ? `Chapter ${ch.index}` : 'Campaign'}`}
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
        disabled={!sandbox.unlocked}
        onClick={onSandbox}
      >
        {sandbox.unlocked
          ? 'Open Sandbox'
          : sandbox.reason ??
            `Sandbox unlocks after Stage ${GATE.sandboxAfterOrder}`}
      </button>
    </div>
  );
}
