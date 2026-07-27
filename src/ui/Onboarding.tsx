import { useEffect, useRef } from 'react';

interface OnboardingProps {
  open: boolean;
  step: number;
  onNext: () => void;
  onSkip: () => void;
  onChoosePace?: (pace: 'easy' | 'standard') => void;
}

const STEPS = [
  {
    title: 'Welcome to PatchLab',
    body: 'You patch a live rack, then fix IP, VLAN, routes, and firewall faults. Completing a stage unlocks the next lesson — stars are optional recognition.',
  },
  {
    title: 'Tap two ports to patch',
    body: 'Select one port, then another, to land a cable. Drag a plugged end to move it, or fling / press U to unplug. Copper, fiber, power, and console each need matching media.',
  },
  {
    title: 'Choose your learning pace',
    body: 'Easy keeps ticket details open, shows coach tips, and turns timers off. Standard fades support as stages move from guided practice into challenge and boss tickets.',
  },
] as const;

export function Onboarding({
  open,
  step,
  onNext,
  onSkip,
  onChoosePace,
}: OnboardingProps) {
  const primaryRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    primaryRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onSkip();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, step, onSkip]);

  if (!open) return null;
  const current = STEPS[Math.min(step, STEPS.length - 1)]!;
  const last = step >= STEPS.length - 1;
  return (
    <div
      className="coach-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Getting started"
      onClick={(event) => {
        if (event.target === event.currentTarget) onSkip();
      }}
    >
      <div className="coach-card panel">
        <div className="coach-kicker">
          Getting started · {step + 1}/{STEPS.length}
        </div>
        <div className="onboard-dots" aria-hidden="true">
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={`onboard-dot${i === Math.min(step, STEPS.length - 1) ? ' active' : ''}`}
            />
          ))}
        </div>
        <h2>{current.title}</h2>
        <p>{current.body}</p>
        <div className="actions">
          {last && onChoosePace ? (
            <>
              <button
                ref={primaryRef}
                type="button"
                className="btn btn-primary"
                onClick={() => onChoosePace('easy')}
              >
                Easy pace
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => onChoosePace('standard')}
              >
                Standard pace
              </button>
            </>
          ) : (
            <button
              ref={primaryRef}
              type="button"
              className="btn btn-primary"
              onClick={onNext}
            >
              {last ? 'Start campaign' : 'Next'}
            </button>
          )}
          <button type="button" className="btn btn-ghost" onClick={onSkip}>
            Skip
          </button>
        </div>
      </div>
    </div>
  );
}
