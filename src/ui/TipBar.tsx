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
  hintLevel?: number;
  sandbox?: boolean;
  onCycleVlan?: () => void;
  onToggleAdmin?: () => void;
  canCycleVlan?: boolean;
  canToggleAdmin?: boolean;
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
  hintLevel = 0,
  sandbox,
  onCycleVlan,
  onToggleAdmin,
  canCycleVlan,
  canToggleAdmin,
}: TipBarProps) {
  const level = tip?.level ?? 'info';
  return (
    <div className={`tip-bar ${level}`}>
      <div className="row">
        <div className="tip-msg" role="status" aria-live="polite">
          {tip?.message ??
            'Plug data, power, or console — then configure IP / firewall as needed.'}
        </div>
        <div className="rack-stats">
          <span>Cu {inventory.copper_cat6}</span>
          <span>Fib {inventory.fiber_om4}</span>
          <span>Pwr {inventory.power_c13}</span>
          <span>Con {inventory.console_rj45}</span>
        </div>
      </div>
      {goalLabels.length > 0 ? (
        <div className="goal-pills">
          {goalLabels.map((label, i) => (
            <span
              key={`${label}-${i}`}
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
            {hintLevel === 0
              ? 'Get a hint'
              : hintLevel < 4
                ? `Next hint (${hintLevel + 1}/4)`
                : 'Show hint again'}
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
        {canCycleVlan && onCycleVlan ? (
          <button type="button" className="btn btn-ghost" onClick={onCycleVlan}>
            Cycle VLAN
          </button>
        ) : null}
        {canToggleAdmin && onToggleAdmin ? (
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
