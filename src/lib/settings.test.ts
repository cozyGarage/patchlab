import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadSettings, saveSettings } from './settings';

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
});

describe('settings', () => {
  it('defaults onboardingDone to false and pace to easy', () => {
    expect(loadSettings().onboardingDone).toBe(false);
    expect(loadSettings().campaignPace).toBe('easy');
  });

  it('persists onboardingDone and campaignPace', () => {
    saveSettings({
      version: 1,
      sound: true,
      reducedHints: false,
      onboardingDone: true,
      campaignPace: 'standard',
    });
    expect(loadSettings().onboardingDone).toBe(true);
    expect(loadSettings().campaignPace).toBe('standard');
  });
});
