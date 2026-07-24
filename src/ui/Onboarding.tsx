interface OnboardingProps {
  open: boolean;
  step: number;
  onNext: () => void;
  onSkip: () => void;
}

const STEPS = [
  {
    title: 'Welcome to PatchLab',
    body: 'You patch a live rack, then fix IP, VLAN, routes, and firewall faults. Stars gate the next stage — accuracy and clean work matter.',
  },
  {
    title: 'Tap two ports to patch',
    body: 'Select one port, then another, to land a cable. Use Unplug on a selected port to pull it. Copper, fiber, power, and console each use matching media.',
  },
  {
    title: 'Config panel + hard gates',
    body: 'Click a chassis to open IP, VLAN, ACL, NAT, routes, ping, and traceroute. Clear a stage with ≥5★ to advance. Chapter borders need ≥4★ on every stage in that chapter.',
  },
] as const;

export function Onboarding({ open, step, onNext, onSkip }: OnboardingProps) {
  if (!open) return null;
  const current = STEPS[Math.min(step, STEPS.length - 1)]!;
  const last = step >= STEPS.length - 1;
  return (
    <div className="coach-backdrop" role="dialog" aria-label="Getting started">
      <div className="coach-card panel">
        <div className="coach-kicker">
          Getting started · {step + 1}/{STEPS.length}
        </div>
        <h2>{current.title}</h2>
        <p>{current.body}</p>
        <div className="actions">
          <button type="button" className="btn btn-primary" onClick={onNext}>
            {last ? 'Start campaign' : 'Next'}
          </button>
          <button type="button" className="btn btn-ghost" onClick={onSkip}>
            Skip
          </button>
        </div>
      </div>
    </div>
  );
}
