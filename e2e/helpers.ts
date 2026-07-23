import { expect, type Page } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const shotDir = path.join(here, '..', 'e2e-artifacts', 'shots');

export async function shot(page: Page, name: string) {
  await page.screenshot({
    path: path.join(shotDir, `${name}.png`),
    fullPage: true,
  });
}

export async function clearApp(page: Page) {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.clear();
  });
  await page.reload();
  await expect(page.getByRole('heading', { name: /Rack\. Power\. IP\. Firewall/i })).toBeVisible();
}

export async function unlockThrough(page: Page, order: number) {
  await page.evaluate((maxOrder) => {
    const ids = [
      'm1-first-lights',
      'm2-wrong-port',
      'm3-vlan-trap',
      'm4-admin-down',
      'm5-change-window',
      'm6-fiber-first',
      'm7-wrong-media',
      'm8-dual-servers',
      'm9-power-up',
      'm10-console-ip',
      'm11-subnet-ping',
      'm12-firewall-acl',
    ];
    const cleared = ids.slice(0, Math.max(0, maxOrder - 1));
    localStorage.setItem(
      'patchlab.progress.v1',
      JSON.stringify({
        version: 1,
        clearedMissionIds: cleared,
        stars: Object.fromEntries(
          cleared.map((id) => [
            id,
            { correctness: 3, speed: 3, cleanliness: 3 },
          ]),
        ),
        sandboxUnlocked: maxOrder > 3 || cleared.includes('m3-vlan-trap'),
      }),
    );
  }, order);
  await page.reload();
}

export function port(page: Page, name: string | RegExp) {
  return page.getByRole('button', { name });
}

export async function tapPort(page: Page, name: string | RegExp) {
  const el = port(page, name);
  await expect(el).toBeVisible();
  await el.click();
}

export async function connectPorts(
  page: Page,
  a: string | RegExp,
  b: string | RegExp,
) {
  await tapPort(page, a);
  await page.waitForTimeout(80);
  await tapPort(page, b);
  await page.waitForTimeout(80);
}

export async function startMission(page: Page, title: string | RegExp) {
  await page.getByRole('button', { name: title }).click();
  await expect(page.getByRole('button', { name: /Start patching/i })).toBeVisible();
  await page.getByRole('button', { name: /Start patching/i }).click();
  await expect(page.locator('svg.rack-svg')).toBeVisible();
}

export async function expectTip(page: Page, re: RegExp) {
  await expect(page.locator('.tip-msg')).toContainText(re);
}

export async function expectDebrief(page: Page) {
  await expect(page.getByRole('heading', { name: /Circuit complete/i })).toBeVisible({
    timeout: 15_000,
  });
}
