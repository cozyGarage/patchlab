import type { Inventory, Tip } from '../types/schema';

interface TipBarProps {
  tip?: Tip;
  inventory: Inventory;
  goalsMet: boolean[];
  goalLabels: string[];
  onHint?: () => void;
  onUnplugSelected?: () => void;
  canUnplug?: boolean;
  showHint?: boolean;
  sandbox?: boolean;
  onCycleVlan?: () => void;
  onToggleAdmin?: () => void;
  canEditPort?: boolean;
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
  sandbox,
  onCycleVlan,
  onToggleAdmin,
  canEditPort,
}: TipBarProps) {
  const level = tip?.level ?? 'info';
  return (
    <div className={`tip-bar ${level}`} role="status" aria-live="polite">
      <div className="row">
        <div className="tip-msg">
          {tip?.message ?? 'Select a port, then connect to another port.'}
        </div>
        <div className="rack-stats">
          <span>Cu × {inventory.copper_cat6}</span>
          <span>Fib × {inventory.fiber_om4}</span>
        </div>
      </div>
      {goalLabels.length > 0 ? (
        <div className="goal-pills">
          {goalLabels.map((label, i) => (
            <span
              key={label}
              className={`goal-pill ${goalsMet[i] ? 'met' : ''}`}
            >
              {goalsMet[i] ? '✓ ' : ''}
              {label}
            </span>
          ))}
        </div>
      ) : null}
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
        {sandbox && canEditPort && onCycleVlan ? (
          <button type="button" className="btn btn-ghost" onClick={onCycleVlan}>
            Cycle VLAN
          </button>
        ) : null}
        {sandbox && canEditPort && onToggleAdmin ? (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onToggleAdmin}
          >
            Toggle admin
          </button>
        ) : null}
      </div>
    </div>
  );
}
