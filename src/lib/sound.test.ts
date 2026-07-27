import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

describe('sound helpers', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.resetModules();
  });

  beforeEach(() => {
    vi.resetModules();
  });

  it('no-ops tip sounds when disabled or missing a level', async () => {
    const resume = vi.fn();
    vi.stubGlobal('window', {
      AudioContext: vi.fn(() => ({
        resume,
        createOscillator: vi.fn(),
        createGain: vi.fn(),
        currentTime: 0,
        destination: {},
      })),
    });
    const { playTipSound } = await import('./sound');
    playTipSound(false, 'success');
    playTipSound(true, undefined);
    expect(resume).not.toHaveBeenCalled();
  });

  it('no-ops patch sounds when disabled', async () => {
    const resume = vi.fn();
    vi.stubGlobal('window', {
      AudioContext: vi.fn(() => ({
        resume,
        createOscillator: vi.fn(),
        createGain: vi.fn(),
        currentTime: 0,
        destination: {},
      })),
    });
    const { playPatchSound } = await import('./sound');
    playPatchSound(false, 'plug');
    expect(resume).not.toHaveBeenCalled();
  });

  it('creates oscillators when tip sounds are enabled', async () => {
    const start = vi.fn();
    const stop = vi.fn();
    const connect = vi.fn();
    const setValueAtTime = vi.fn();
    const exponentialRampToValueAtTime = vi.fn();
    const resume = vi.fn(() => Promise.resolve());
    const createOscillator = vi.fn(() => ({
      type: 'sine',
      frequency: { value: 0 },
      connect,
      start,
      stop,
    }));
    const createGain = vi.fn(() => ({
      gain: { value: 0, setValueAtTime, exponentialRampToValueAtTime },
      connect,
    }));
    vi.stubGlobal('window', {
      AudioContext: vi.fn(() => ({
        resume,
        createOscillator,
        createGain,
        currentTime: 1,
        destination: {},
      })),
    });

    const { playTipSound } = await import('./sound');
    playTipSound(true, 'error');
    expect(resume).toHaveBeenCalled();
    expect(createOscillator).toHaveBeenCalled();
    expect(start).toHaveBeenCalled();
    expect(stop).toHaveBeenCalled();
  });

  it('forwards haptic pulses to navigator.vibrate', async () => {
    const vibrate = vi.fn();
    vi.stubGlobal('navigator', { vibrate });
    const { haptic } = await import('./sound');
    haptic(20);
    expect(vibrate).toHaveBeenCalledWith(20);
  });

  it('swallows haptic errors', async () => {
    vi.stubGlobal('navigator', {
      vibrate: () => {
        throw new Error('unsupported');
      },
    });
    const { haptic } = await import('./sound');
    expect(() => haptic(12)).not.toThrow();
  });
});
