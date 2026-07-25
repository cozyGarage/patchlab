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
  canCycleVlan?: boolean;
  canToggleAdmin?: boolean;
  /** Port currently armed for tap-tap / drag patching. */
  armedLabel?: string;
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
  canCycleVlan,
  canToggleAdmin,
  armedLabel,
}: TipBarProps) {
  const level = tip?.level ?? 'info';
  return (
    <div
      className={`tip-bar ${level}${armedLabel ? ' armed' : ''}`}
      role="status"
      aria-live="polite"
    >
      <div className="row">
        <div className="tip-msg">
          {tip?.message ??
            (armedLabel
              ? `Armed: ${armedLabel} — tap or drag to a free port`
              : 'Plug data, power, or console — then configure IP / firewall as needed.')}
          {armedLabel && tip?.message ? (
            <span className="armed-chip"> Armed: {armedLabel}</span>
          ) : null}
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
