import type { Mission, ProgressSave, Score } from '../types/schema';
import {
  GATE,
  chapterForMission,
  chapterProgress,
  meetsStageGate,
  missionGate,
  starTotal,
} from '../lib/chapters';
import { missions } from '../missions';

interface DebriefProps {
  mission: Mission;
  score: Score;
  progress: ProgressSave;
  tipHistory: string[];
  onNext?: () => void;
  onRetry: () => void;
  onHome: () => void;
  nextLabel?: string;
}

export function Debrief({
  mission,
  score,
  progress,
  tipHistory,
  onNext,
  onRetry,
  onHome,
  nextLabel,
}: DebriefProps) {
  const chapter = chapterForMission(mission);
  const next = missions.find((m) => m.order === mission.order + 1);
  const nextChapter = next ? chapterForMission(next) : undefined;
  const earned = starTotal(score);
  const stageOk = meetsStageGate(score);
  const nextGate = next
    ? missionGate(next.order, missions, progress)
    : { unlocked: true as const };
  const canAdvance = !!next && nextGate.unlocked;
  const chapterClear =
    chapter &&
    !missions.some(
      (m) =>
        m.order >= chapter.from &&
        m.order <= chapter.to &&
        m.order > mission.order,
    );
  const chapterProg = chapter
    ? chapterProgress(chapter, missions, progress)
    : null;
  const chapterCelebrated = !!(chapterProg?.gatedComplete && chapterClear);

  return (
    <div className="screen-debrief">
      <div className="debrief-card panel">
        <div className="brand-mark brand">
          <span className="dot" aria-hidden />
          <span>PatchLab</span>
        </div>
        <div className="stage-badge">
          Stage {mission.order} of {missions.length} · {earned}★ / 9
          {chapter ? ` · Chapter ${chapter.index}` : ''}
        </div>
        {chapterCelebrated && chapter ? (
          <div className="chapter-celebrate" role="status">
            Chapter {chapter.index} cleared — {chapter.title}
          </div>
        ) : null}
        <h1>Circuit complete</h1>
        <p>
          You finished <strong>{mission.title}</strong>
          {!stageOk
            ? `. Gate not met — earn at least ${GATE.minStarsToAdvance}★ to unlock the next stage (you scored ${earned}★).`
            : chapterClear && chapter
              ? next && !canAdvance
                ? ` — chapter stages done, but boost every stage in Chapter ${chapter.index} to ≥${GATE.minStarsPerMissionForChapter}★ to open the next chapter.`
                : ` — Chapter ${chapter.index} (${chapter.title}) gate ready!`
              : next
                ? canAdvance
                  ? `. Stage ${next.order} is unlocked.`
                  : `. Next stage is still gated.`
                : '. Campaign complete — try the Sandbox.'}
        </p>

        {!stageOk ? (
          <div className="gate-callout">
            <strong>Hard gate — retry for stars</strong>
            <p>
              Score {GATE.minStarsToAdvance}★+ (correctness + speed +
              cleanliness). Fewer wrong attempts, fewer hints, and finishing near
              par time raise your stars. Soft clears do not unlock the next stage.
            </p>
          </div>
        ) : null}

        <div className="debrief-stars">
          <div className="star-box">
            <strong>{'★'.repeat(score.correctness) || '☆'}</strong>
            <span>Correctness</span>
          </div>
          <div className="star-box">
            <strong>{'★'.repeat(score.speed) || '☆'}</strong>
            <span>Speed</span>
          </div>
          <div className="star-box">
            <strong>{'★'.repeat(score.cleanliness) || '☆'}</strong>
            <span>Cleanliness</span>
          </div>
        </div>

        <div>
          <h3 style={{ marginBottom: 8 }}>What you practiced</h3>
          <ul className="checklist">
            <li>Reading port link lights after each patch</li>
            <li>Matching physical ports and media to the ticket</li>
            <li>Spotting VLAN, admin-down, mask, route, and ACL faults quickly</li>
          </ul>
        </div>

        {tipHistory.length > 0 ? (
          <div>
            <h3 style={{ marginBottom: 8 }}>Moments from this run</h3>
            <ul className="checklist">
              {tipHistory.slice(-3).map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="actions">
          {canAdvance && onNext ? (
            <button type="button" className="btn btn-primary" onClick={onNext}>
              {nextLabel ??
                (next
                  ? `Next: Stage ${next.order}${
                      nextChapter && nextChapter.id !== chapter?.id
                        ? ` · Ch ${nextChapter.index}`
                        : ''
                    }`
                  : 'Next mission')}
            </button>
          ) : null}
          <button
            type="button"
            className={canAdvance ? 'btn btn-ghost' : 'btn btn-primary'}
            onClick={onRetry}
          >
            {stageOk ? 'Retry for more ★' : 'Retry — beat the gate'}
          </button>
          <button type="button" className="btn btn-ghost" onClick={onHome}>
            Campaign map
          </button>
        </div>
        {!canAdvance && next && !nextGate.unlocked ? (
          <p className="gate-hint">{nextGate.reason}</p>
        ) : null}
      </div>
    </div>
  );
}
