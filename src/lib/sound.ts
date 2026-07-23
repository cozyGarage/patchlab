let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  return ctx;
}

function tone(
  freq: number,
  duration: number,
  type: OscillatorType = 'sine',
  gain = 0.03,
) {
  const audio = getCtx();
  if (!audio) return;
  const osc = audio.createOscillator();
  const g = audio.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.value = gain;
  osc.connect(g);
  g.connect(audio.destination);
  const now = audio.currentTime;
  g.gain.setValueAtTime(gain, now);
  g.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  osc.start(now);
  osc.stop(now + duration);
}

export function playTipSound(
  enabled: boolean,
  level?: 'info' | 'success' | 'warn' | 'error',
) {
  if (!enabled || !level) return;
  void getCtx()?.resume();
  switch (level) {
    case 'success':
      tone(660, 0.08);
      setTimeout(() => tone(880, 0.1), 70);
      break;
    case 'warn':
      tone(320, 0.12, 'triangle', 0.025);
      break;
    case 'error':
      tone(180, 0.16, 'square', 0.02);
      break;
    default:
      tone(440, 0.05, 'sine', 0.02);
  }
}
