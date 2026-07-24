import type { Mission, Score } from '../types/schema';
import { chapterForMission } from '../lib/chapters';
import { missions } from '../missions';

interface DebriefProps {
  mission: Mission;
  score: Score;
  tipHistory: string[];
  onNext?: () => void;
  onRetry: () => void;
  onHome: () => void;
  nextLabel?: string;
}

export function Debrief({
  mission,
  score,
  tipHistory,
  onNext,
  onRetry,
  onHome,
  nextLabel,
}: DebriefProps) {
  const chapter = chapterForMission(mission);
  const next = missions.find((m) => m.order === mission.order + 1);
  const nextChapter = next ? chapterForMission(next) : undefined;
  const chapterClear =
    chapter &&
    !missions.some(
      (m) =>
        m.order >= chapter.from &&
        m.order <= chapter.to &&
        m.order > mission.order,
    );

  return (
    <div className="screen-debrief">
      <div className="debrief-card panel">
        <div className="brand-mark brand">
          <span className="dot" aria-hidden />
          <span>PatchLab</span>
        </div>
        <div className="stage-badge">
          Stage {mission.order} of {missions.length} cleared
          {chapter ? ` · Chapter ${chapter.index}` : ''}
        </div>
        <h1>Circuit complete</h1>
        <p>
          You finished <strong>{mission.title}</strong>
          {chapterClear && chapter
            ? ` — Chapter ${chapter.index} (${chapter.title}) complete!`
            : next
              ? `. Stage ${next.order} is now unlocked.`
              : '. Campaign complete — try the Sandbox.'}
        </p>

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
          {onNext ? (
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
          <button type="button" className="btn btn-ghost" onClick={onRetry}>
            Retry stage
          </button>
          <button type="button" className="btn btn-ghost" onClick={onHome}>
            Campaign map
          </button>
        </div>
      </div>
    </div>
  );
}
