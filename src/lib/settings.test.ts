import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadSettings, saveSettings } from './settings';

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
});

describe('settings', () => {
  it('defaults onboardingDone to false', () => {
    expect(loadSettings().onboardingDone).toBe(false);
  });

  it('persists onboardingDone', () => {
    saveSettings({
      version: 1,
      sound: true,
      reducedHints: false,
      onboardingDone: true,
    });
    expect(loadSettings().onboardingDone).toBe(true);
  });
});
