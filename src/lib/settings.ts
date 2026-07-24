import type { SettingsSave } from '../types/schema';

const KEY = 'patchlab.settings.v1';

const defaults: SettingsSave = {
  version: 1,
  sound: true,
  reducedHints: false,
  onboardingDone: false,
};

export function loadSettings(): SettingsSave {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...defaults };
    const parsed = JSON.parse(raw) as SettingsSave;
    if (parsed.version !== 1) return { ...defaults };
    return { ...defaults, ...parsed };
  } catch {
    return { ...defaults };
  }
}

export function saveSettings(next: SettingsSave): void {
  localStorage.setItem(KEY, JSON.stringify(next));
}
