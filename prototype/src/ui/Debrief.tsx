import type { Mission, Score } from '../types/schema';

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
  return (
    <div className="screen-debrief">
      <div className="debrief-card panel">
        <div className="brand-mark brand">
          <span className="dot" aria-hidden />
          <span>PatchLab</span>
        </div>
        <h1>Circuit complete</h1>
        <p>You finished {mission.title}. Here’s how the run scored.</p>

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
            <li>Matching physical ports to the ticket</li>
            <li>Spotting VLAN / admin-down faults quickly</li>
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
              {nextLabel ?? 'Next mission'}
            </button>
          ) : null}
          <button type="button" className="btn btn-ghost" onClick={onRetry}>
            Retry
          </button>
          <button type="button" className="btn btn-ghost" onClick={onHome}>
            Home
          </button>
        </div>
      </div>
    </div>
  );
}
