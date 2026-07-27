/** Lightweight local analytics — no network, privacy-friendly. */

export type AnalyticsEvent =
  | 'app_open'
  | 'mission_start'
  | 'mission_complete'
  | 'hint_used'
  | 'undo'
  | 'pace_change'
  | 'sandbox_share'
  | 'sandbox_import'
  | 'classroom_unlock'
  | 'cli_command'
  | 'transfer_start';

export interface AnalyticsEntry {
  t: number;
  event: AnalyticsEvent;
  props?: Record<string, string | number | boolean | null>;
}

const KEY = 'patchlab.analytics.v1';
const MAX = 200;

export function track(
  event: AnalyticsEvent,
  props?: AnalyticsEntry['props'],
): void {
  try {
    const raw = localStorage.getItem(KEY);
    const queue: AnalyticsEntry[] = raw ? (JSON.parse(raw) as AnalyticsEntry[]) : [];
    queue.push({ t: Date.now(), event, props });
    localStorage.setItem(KEY, JSON.stringify(queue.slice(-MAX)));
  } catch {
    /* ignore quota / private mode */
  }
}

export function readAnalytics(): AnalyticsEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as AnalyticsEntry[]) : [];
  } catch {
    return [];
  }
}

export function clearAnalytics(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
