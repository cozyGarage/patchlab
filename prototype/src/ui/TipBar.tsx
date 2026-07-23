import type { Tip } from '../types/schema';

interface TipBarProps {
  tip?: Tip;
  inventory: number;
  goalsMet: boolean[];
  goalLabels: string[];
  onHint?: () => void;
  onUnplugSelected?: () => void;
  canUnplug?: boolean;
  showHint?: boolean;
}

export function TipBar({
  tip,
  inventory,
  goalsMet,
  goalLabels,
  onHint,
  onUnplugSelected,
  canUnplug,
  showHint,
}: TipBarProps) {
  const level = tip?.level ?? 'info';
  return (
    <div className={`tip-bar ${level}`} role="status" aria-live="polite">
      <div className="row">
        <div className="tip-msg">
          {tip?.message ?? 'Select a port, then connect to another port.'}
        </div>
        <div className="rack-stats">
          <span>Cat6 × {inventory}</span>
        </div>
      </div>
      <div className="goal-pills">
        {goalLabels.map((label, i) => (
          <span key={label} className={`goal-pill ${goalsMet[i] ? 'met' : ''}`}>
            {goalsMet[i] ? '✓ ' : ''}
            {label}
          </span>
        ))}
      </div>
      <div className="actions">
        {showHint && onHint ? (
          <button type="button" className="btn btn-ghost" onClick={onHint}>
            Hint
          </button>
        ) : null}
        {canUnplug && onUnplugSelected ? (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onUnplugSelected}
          >
            Unplug
          </button>
        ) : null}
      </div>
    </div>
  );
}
