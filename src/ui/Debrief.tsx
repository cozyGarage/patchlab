import type { Mission, ProgressSave, Score } from '../types/schema';
import { chapterForMission, starTotal } from '../lib/chapters';
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
  hintLevel?: number;
}

export function Debrief({
  mission,
  score,
  tipHistory,
  onNext,
  onRetry,
  onHome,
  nextLabel,
  hintLevel = 0,
}: DebriefProps) {
  const chapter = chapterForMission(mission);
  const next = missions.find((m) => m.order === mission.order + 1);
  const nextChapter = next ? chapterForMission(next) : undefined;
  const earned = starTotal(score);
  const canContinue = Boolean(onNext);
  const chapterClear = Boolean(
    chapter &&
      !missions.some(
        (m) =>
          m.order >= chapter.from &&
          m.order <= chapter.to &&
          m.order > mission.order,
      ),
  );
  const debrief = mission.learning?.debrief;
  const conceptsPracticed = mission.learning?.conceptsPracticed ?? [];
  const stars = (value: number) =>
    `${'★'.repeat(value)}${'☆'.repeat(Math.max(0, 3 - value))}`;

  return (
    <div className="screen-debrief">
      <div className="debrief-card panel">
        <div className="brand-mark brand">
          <span className="dot" aria-hidden />
          <span>PatchLab</span>
        </div>
        <div className="stage-badge">
          Stage {mission.order} of {missions.length}
          {chapter ? ` · Arc ${chapter.index}` : ''}
        </div>
        {chapterClear && chapter ? (
          <div className="chapter-celebrate" role="status">
            Arc {chapter.index} completed — {chapter.title}
          </div>
        ) : null}
        <h1>{debrief?.outcome ?? 'Mission complete'}</h1>
        <p>
          You finished <strong>{mission.title}</strong>.
        </p>

        {debrief ? (
          <section aria-labelledby="debrief-explanation-heading">
            <h3 id="debrief-explanation-heading" style={{ marginBottom: 8 }}>
              Why it worked
            </h3>
            <p>{debrief.explanation}</p>
          </section>
        ) : mission.lesson ? (
          <section aria-labelledby="debrief-explanation-heading">
            <h3 id="debrief-explanation-heading" style={{ marginBottom: 8 }}>
              Why it worked
            </h3>
            <p>{mission.lesson}</p>
          </section>
        ) : null}

        {debrief ? (
          <section aria-labelledby="reflection-question-heading">
            <h3 id="reflection-question-heading" style={{ marginBottom: 8 }}>
              Check your understanding
            </h3>
            <p>{debrief.question}</p>
            <details>
              <summary>Reveal answer</summary>
              <p style={{ marginTop: 8 }}>{debrief.answer}</p>
            </details>
          </section>
        ) : null}

        {mission.learning.deviceUnlocks?.length ? (
          <section aria-labelledby="equipment-unlocked-heading">
            <h3 id="equipment-unlocked-heading" style={{ marginBottom: 8 }}>
              Equipment unlocked
            </h3>
            <ul className="checklist">
              {mission.learning.deviceUnlocks.map((device) => (
                <li key={device}>{device}</li>
              ))}
            </ul>
          </section>
        ) : null}

        {conceptsPracticed.length ? (
          <section aria-labelledby="concepts-practiced-heading">
            <h3 id="concepts-practiced-heading" style={{ marginBottom: 8 }}>
              Concepts practiced
            </h3>
            <ul className="checklist">
              {conceptsPracticed.map((concept) => (
                <li key={concept}>{concept}</li>
              ))}
            </ul>
          </section>
        ) : null}

        <section aria-labelledby="optional-achievements-heading">
          <h3 id="optional-achievements-heading" style={{ marginBottom: 8 }}>
            Optional achievements · {earned}/9 stars
          </h3>
          <p>
            Achievements celebrate efficient diagnosis, an optional SLA pace,
            a clean rack, and independent work. They never block the next lesson.
          </p>
          <div className="debrief-stars">
            <div className="star-box">
              <strong aria-label={`${score.correctness} of 3 diagnostic efficiency stars`}>
                <span aria-hidden="true">{stars(score.correctness)}</span>
              </strong>
              <span>Efficient diagnosis</span>
            </div>
            <div className="star-box">
              <strong aria-label={`${score.speed} of 3 speed stars`}>
                <span aria-hidden="true">{stars(score.speed)}</span>
              </strong>
              <span>Under SLA</span>
            </div>
            <div className="star-box">
              <strong aria-label={`${score.cleanliness} of 3 cleanliness stars`}>
                <span aria-hidden="true">{stars(score.cleanliness)}</span>
              </strong>
              <span>Clean rack</span>
            </div>
            <div className="star-box">
              <strong aria-label={hintLevel <= 2 ? 'Independent achievement earned' : 'Independent achievement not earned'}>
                <span aria-hidden="true">{hintLevel <= 2 ? '★' : '☆'}</span>
              </strong>
              <span>Independent</span>
            </div>
          </div>
        </section>

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
          <button
            type="button"
            className={canContinue ? 'btn btn-ghost' : 'btn btn-primary'}
            onClick={onRetry}
          >
            Replay mission
          </button>
          <button type="button" className="btn btn-ghost" onClick={onHome}>
            Campaign map
          </button>
        </div>
      </div>
    </div>
  );
}
