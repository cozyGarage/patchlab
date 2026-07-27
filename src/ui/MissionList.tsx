import type { Mission, ProgressSave, SettingsSave } from '../types/schema';
import {
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
} from '../lib/chapters';
import { PACE_LABEL, paceBlurb, type CampaignPace } from '../lib/campaignPace';

interface MissionListProps {
  missions: Mission[];
  progress: ProgressSave;
  settings: SettingsSave;
  onSelect: (mission: Mission) => void;
  onSandbox: () => void;
  onToggleSound: () => void;
  onTogglePace?: () => void;
  onOpenGlossary: () => void;
  onExportProgress?: () => void;
  onImportProgress?: (raw: string) => void;
  onResetProgress?: () => void;
  onReplayOnboarding?: () => void;
  progressNotice?: { level: 'ok' | 'bad'; message: string } | null;
}

export function MissionList({
  missions,
  progress,
  settings,
  onSelect,
  onSandbox,
  onToggleSound,
  onTogglePace,
  onOpenGlossary,
  onExportProgress,
  onImportProgress,
  onResetProgress,
  onReplayOnboarding,
  progressNotice,
}: MissionListProps) {
  const cleared = progress.clearedMissionIds.length;
  const stage = stageLabel(missions, progress);
  const pct = Math.round((cleared / Math.max(1, missions.length)) * 100);
  const sandbox = sandboxGate(missions, progress);
  const pace = (settings.campaignPace ?? 'easy') as CampaignPace;
  const conceptEntries = Object.values(progress.conceptProgress ?? {});
  const independentConcepts = conceptEntries.filter(
    (concept) => concept.level === 'independent',
  ).length;
  const reviewConcept = Object.entries(progress.conceptProgress ?? {})
    .filter(([, concept]) => concept.level !== 'independent')
    .sort(
      ([, a], [, b]) =>
        Date.parse(a.lastPracticedAt) - Date.parse(b.lastPracticedAt),
    )[0]?.[0];
  const reviewMission = reviewConcept
    ? missions.find(
        (mission) =>
          progress.clearedMissionIds.includes(mission.id) &&
          (mission.learning.conceptsIntroduced.includes(reviewConcept) ||
            mission.learning.conceptsPracticed.includes(reviewConcept)),
      )
    : undefined;

  return (
    <div className="screen-home">
      <header className="hero">
        <div className="brand-mark brand">
          <span className="dot" aria-hidden />
          <span>PatchLab</span>
        </div>
        <h1 className="brand">Rack. Power. VLAN. Route. Firewall.</h1>
        <p>
          {CHAPTERS.length} arcs · {missions.length} stages. {paceBlurb(pace)}
        </p>
      </header>

      <div className="stage-panel panel">
        <div className="stage-panel-top">
          <div>
            <div className="stage-kicker">
              Campaign progress · {PACE_LABEL[pace]} pace
            </div>
            <div className="stage-title">
              {cleared >= missions.length
                ? 'All stages cleared'
                : `Stage ${stage.current} of ${stage.total}`}
            </div>
            <p className="stage-sub">
              {cleared >= missions.length
                ? 'Sandbox is open — experiment freely.'
                : stage.chapter
                  ? `Arc ${stage.chapter.index}: ${stage.chapter.title} · ${stage.title}`
                  : stage.title}
            </p>
          </div>
          <div className="stage-stats">
            <span>
              Cleared <strong>{cleared}</strong>/{missions.length}
            </span>
            <span>
              Optional stars{' '}
              <strong className="stars">{totalStars(progress)}</strong>
            </span>
            <span>
              Independent skills <strong>{independentConcepts}</strong>/
              {conceptEntries.length}
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
                  prog.complete ? 'complete' : '',
                  active ? 'active' : '',
                  !unlocked ? 'locked' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                title={
                  prog.complete ? `${ch.blurb} · Arc complete` : ch.blurb
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
        {reviewMission && reviewConcept ? (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => onSelect(reviewMission)}
            title={`Review: ${reviewConcept}`}
          >
            Practice weak skill
          </button>
        ) : null}
        <button type="button" className="btn btn-ghost" onClick={onOpenGlossary}>
          Glossary
        </button>
        <button type="button" className="btn btn-ghost" onClick={onToggleSound}>
          Sound: {settings.sound ? 'On' : 'Off'}
        </button>
        {onTogglePace ? (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onTogglePace}
            title={paceBlurb(pace)}
          >
            Pace: {PACE_LABEL[pace]}
          </button>
        ) : null}
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

      {progressNotice ? (
        <p
          className={`progress-notice ${progressNotice.level}`}
          role="status"
          aria-live="polite"
        >
          {progressNotice.message}
        </p>
      ) : null}

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
                    Arc {chapter.index}
                    {prog.complete
                      ? ' · Complete'
                      : unlocked
                        ? ''
                        : ' · Complete the previous mission to unlock'}
                  </div>
                  <h2>{chapter.title}</h2>
                  <p>
                    {chapter.blurb}{' '}
                    <span className="gate-hint">
                      ({prog.stars}/{prog.maxStars} optional ★)
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
                        </span>{' '}
                        <span className="track-pill">
                          {mission.learning.mode} · {'◆'.repeat(mission.learning.difficulty)}
                        </span>
                      </h3>
                      <p>
                        {missionUnlocked
                          ? mission.brief
                          : lockReason ??
                            `Complete the previous ${ch ? `Arc ${ch.index}` : 'campaign'} mission to unlock`}
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
          : sandbox.reason ?? 'Complete Stage 3 to unlock Sandbox'}
      </button>
    </div>
  );
}
