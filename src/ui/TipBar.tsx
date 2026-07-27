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
  /** Port currently armed for tap-tap / drag patching. */
  armedLabel?: string;
  onUndo?: () => void;
  canUndo?: boolean;
  cableLog?: string[];
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
  armedLabel,
  onUndo,
  canUndo,
  cableLog,
}: TipBarProps) {
  const level = tip?.level ?? 'info';
  const defaultMsg = armedLabel
    ? `Tap/drag a free port · U unplug · fling away to yank`
    : 'Tap-tap or drag to patch · drag a plugged end to move · fling away / U to unplug';
  return (
    <div className={`tip-bar ${level}${armedLabel ? ' armed' : ''}`}>
      <div className="row">
        <div className="tip-msg" role="status" aria-live="polite">
          {tip?.message ?? defaultMsg}
          {armedLabel ? (
            <span className="armed-chip">Armed: {armedLabel}</span>
          ) : null}
        </div>
        <div className="rack-stats" aria-label="Spare patch cords">
          <span title="Cat6 remaining" aria-label={`Cat6 remaining: ${inventory.copper_cat6}`}>
            Cu {inventory.copper_cat6}
          </span>
          <span title="OM4 fiber remaining" aria-label={`Fiber remaining: ${inventory.fiber_om4}`}>
            Fib {inventory.fiber_om4}
          </span>
          <span title="Power cords remaining" aria-label={`Power remaining: ${inventory.power_c13}`}>
            Pwr {inventory.power_c13}
          </span>
          <span
            title="Console cords remaining"
            aria-label={`Console remaining: ${inventory.console_rj45}`}
          >
            Con {inventory.console_rj45}
          </span>
        </div>
      </div>
      {goalLabels.length > 0 ? (
        <div className="goal-pills" role="list" aria-label="Stage objectives">
          {goalLabels.map((label, i) => (
            <span
              key={`${label}-${i}`}
              role="listitem"
              className={`goal-pill ${goalsMet[i] ? 'met' : ''}`}
              aria-label={`Objective ${i + 1}: ${label}${goalsMet[i] ? ' — complete' : ' — incomplete'}`}
            >
              <span aria-hidden="true">{goalsMet[i] ? '✓ ' : ''}</span>
              {label}
            </span>
          ))}
        </div>
      ) : null}
      {cableLog && cableLog.length > 0 ? (
        <div className="cable-log" aria-label="Recent cable actions">
          {cableLog.slice(-4).map((entry, i) => (
            <span key={`${i}-${entry}`} className="cable-log-chip">{entry}</span>
          ))}
        </div>
      ) : null}
      <div className="actions">
        {canUndo && onUndo ? (
          <button type="button" className="btn btn-ghost" onClick={onUndo}>
            Undo
          </button>
        ) : null}
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
