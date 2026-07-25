import { Score } from '../types/schema';
import { EngineState } from './reducer';

function clampStar(n: number): 0 | 1 | 2 | 3 {
  if (n <= 0) return 0;
  if (n === 1) return 1;
  if (n === 2) return 2;
  return 3;
}

/** Compute end-of-mission stars from engine telemetry. */
export function scoreRun(
  state: EngineState,
  finishedAtMs: number = Date.now(),
): Score {
  if (!state.snapshot.complete) {
    return { correctness: 0, speed: 0, cleanliness: 0 };
  }

  const elapsedSec = (finishedAtMs - state.startedAtMs) / 1000;
  const par = state.mission.parTimeSec;

  let correctness: number = 3;
  if (state.wrongAttempts > 5) correctness = 1;
  else if (state.wrongAttempts > 2) correctness = 2;

  let speed: number = 1;
  if (elapsedSec <= par) speed = 3;
  else if (elapsedSec <= par * 1.5) speed = 2;

  let cleanliness: number = 3;
  // Help-seeking is tracked separately; cleanliness measures the final work path.
  // Leftover unused plugged cables beyond goal graph — soft penalty via inventory waste
  if (state.snapshot.inventory.copper_cat6 === 0 && state.connectCount > 4) {
    cleanliness -= 1;
  }
  if (state.connectCount > state.mission.goals.length + 3) {
    cleanliness -= 1;
  }

  return {
    correctness: clampStar(correctness),
    speed: clampStar(speed),
    cleanliness: clampStar(cleanliness),
  };
}
