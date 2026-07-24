import { expect, type Page } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const shotDir = path.join(here, '..', 'e2e-artifacts', 'shots');

export const MISSION_IDS = [
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
  'm13-access-vlan',
  'm14-vlan-isolation',
  'm15-default-gateway',
  'm16-trunk-uplink',
  'm17-static-nat',
  'm18-deny-host',
  'm19-broken-address',
  'm20-mask-trap',
  'm21-inter-vlan',
  'm22-static-route',
] as const;

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
  await expect(
    page.getByRole('heading', {
      name: /Rack\. Power\. VLAN\. Route\. Firewall/i,
    }),
  ).toBeVisible();
}

export async function unlockThrough(page: Page, order: number) {
  await page.evaluate(
    ({ ids, maxOrder }) => {
      const cleared = ids.slice(0, Math.max(0, maxOrder - 1));
      localStorage.setItem(
        'patchlab.progress.v1',
        JSON.stringify({
          version: 1,
          clearedMissionIds: cleared,
          stars: Object.fromEntries(
            cleared.map((id) => [
              id,
              { correctness: 3, speed: 3, elegance: 3 },
            ]),
          ),
          sandboxUnlocked: maxOrder > 3 || cleared.includes('m3-vlan-trap'),
        }),
      );
    },
    { ids: [...MISSION_IDS], maxOrder: order },
  );
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

export async function unplugPort(page: Page, name: string | RegExp) {
  await tapPort(page, name);
  await page.getByRole('button', { name: 'Unplug' }).click();
  await page.waitForTimeout(80);
}

export async function startMission(page: Page, title: string | RegExp) {
  await page.getByRole('button', { name: title }).click();
  await expect(page.getByRole('button', { name: /Start stage/i })).toBeVisible();
  await page.getByRole('button', { name: /Start stage/i }).click();
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

export async function focusDevice(page: Page, name: string | RegExp) {
  await page.locator('svg.rack-svg').getByText(name).first().click();
  await expect(page.locator('.config-panel h3')).toContainText(name);
}

export async function applyIp(
  page: Page,
  opts: { address: string; prefix?: string; gateway?: string; portId?: string },
) {
  const panel = page.locator('.config-panel');
  if (opts.portId) {
    await panel.locator('select').first().selectOption(opts.portId);
  }
  const inputs = panel.locator('input');
  await inputs.nth(0).fill(opts.address);
  await inputs.nth(1).fill(opts.prefix ?? '24');
  await inputs.nth(2).fill(opts.gateway ?? '');
  await page.getByRole('button', { name: 'Apply IP' }).click();
}

export async function setAccessVlan(
  page: Page,
  portId: string,
  vlan: string,
) {
  const selects = page.locator('.config-panel select');
  // Interface (IP) · Switchport port · Access VLAN
  await selects.nth(1).selectOption(portId);
  await selects.nth(2).selectOption(vlan);
  await page.getByRole('button', { name: 'Set access VLAN' }).click();
}

export async function setTrunkMode(page: Page, portId: string) {
  const selects = page.locator('.config-panel select');
  await selects.nth(1).selectOption(portId);
  await page.getByRole('button', { name: 'Mode trunk' }).click();
}

export async function pingFromFocused(page: Page, targetName: string | RegExp) {
  const select = page.locator('.config-panel').getByRole('combobox').last();
  const option = select.locator('option', { hasText: targetName });
  const value = await option.getAttribute('value');
  expect(value).toBeTruthy();
  await select.selectOption(value!);
  await page.getByRole('button', { name: /^Ping from /i }).click();
}
