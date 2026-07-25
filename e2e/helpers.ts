import { expect, type Page } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const shotDir = path.join(here, '..', 'e2e-artifacts', 'shots');

export const MISSION_IDS = [
  'm1-first-lights',
  'm2-wrong-port',
  'm5-change-window',
  'm6-fiber-first',
  'm7-wrong-media',
  'm9-power-up',
  'm4-admin-down',
  'm23-no-shutdown',
  'm28-fiber-no-shutdown',
  'm10-console-ip',
  'm11-subnet-ping',
  'm19-broken-address',
  'm20-mask-trap',
  'm29-spare-pdu',
  'm12-firewall-acl',
  'm18-deny-host',
  'm13-access-vlan',
  'm3-vlan-trap',
  'm14-vlan-isolation',
  'm8-dual-servers',
  'm15-default-gateway',
  'm24-wrong-gateway',
  'm16-trunk-uplink',
  'm21-inter-vlan',
  'm17-static-nat',
  'm31-pat-overload',
  'm22-static-route',
  'm25-host-route',
  'm30-floating-static',
  'm26-deny-branch',
  'm27-branch-exception',
  'm32-traceroute',
] as const;

const LEGACY_MISSION_IDS = [...MISSION_IDS].sort(
  (a, b) => Number(a.match(/^m(\d+)-/)?.[1]) - Number(b.match(/^m(\d+)-/)?.[1]),
);

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
    localStorage.setItem(
      'patchlab.settings.v1',
      JSON.stringify({
        version: 1,
        sound: true,
        reducedHints: false,
        onboardingDone: true,
      }),
    );
  });
  await page.reload();
  await expect(
    page.getByRole('heading', {
      name: /Rack\. Power\. VLAN\. Route\. Firewall/i,
    }),
  ).toBeVisible();
}

export async function unlockThrough(page: Page, legacyMissionNumber: number) {
  const targetId = LEGACY_MISSION_IDS[legacyMissionNumber - 1];
  expect(targetId, `Unknown legacy mission number ${legacyMissionNumber}`).toBeTruthy();
  const campaignOrder = MISSION_IDS.indexOf(targetId);

  await page.evaluate(
    ({ ids, targetOrder }) => {
      const cleared = ids.slice(0, Math.max(0, targetOrder));
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
        sandboxUnlocked: cleared.includes('m5-change-window'),
        }),
      );
    },
    { ids: [...MISSION_IDS], targetOrder: campaignOrder },
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
  const review = page.getByRole('button', { name: 'Review result' });
  const debrief = page.getByRole('region', { name: 'Why it worked' });
  await expect(review.or(debrief)).toBeVisible({ timeout: 15_000 });
  if (await review.isVisible()) await review.click();
  await expect(debrief).toBeVisible({ timeout: 15_000 });
}

export async function focusDevice(page: Page, name: string | RegExp) {
  await page.locator('svg.rack-svg').getByText(name).first().click();
  await expect(page.locator('.config-panel h3')).toContainText(name);
}

export async function applyIp(
  page: Page,
  opts: { address: string; prefix?: string; gateway?: string; portId?: string },
) {
  const section = page.locator('.config-block', {
    has: page.getByRole('heading', { name: 'IPv4 / subnet' }),
  });
  if (opts.portId) {
    await section.getByLabel('Interface').selectOption(opts.portId);
  }
  await section.getByLabel('Address').fill(opts.address);
  await section.getByLabel('Prefix').fill(opts.prefix ?? '24');
  await section.getByLabel('Gateway').fill(opts.gateway ?? '');
  await section.getByRole('button', { name: 'Apply IP' }).click();
}

export async function setAccessVlan(
  page: Page,
  portId: string,
  vlan: string,
) {
  const section = page.locator('.config-block', {
    has: page.getByRole('heading', { name: 'Switchport' }),
  });
  await section.getByLabel('Port').selectOption(portId);
  await section.getByLabel('Access VLAN').selectOption(vlan);
  await section.getByRole('button', { name: 'Set access VLAN' }).click();
}

export async function setTrunkMode(page: Page, portId: string) {
  const section = page.locator('.config-block', {
    has: page.getByRole('heading', { name: 'Switchport' }),
  });
  await section.getByLabel('Port').selectOption(portId);
  await section.getByRole('button', { name: 'Mode trunk' }).click();
}

export async function insertCustomAcl(
  page: Page,
  action: 'permit' | 'deny',
  sourceCidr: string,
  destCidr: string,
) {
  const section = page.locator('.config-block', {
    has: page.getByRole('heading', { name: 'Firewall policy' }),
  });
  await section.getByLabel('Action').selectOption(action);
  await section.getByLabel('Source CIDR').fill(sourceCidr);
  await section.getByLabel('Dest CIDR').fill(destCidr);
  await section.getByRole('button', { name: 'Insert custom ACL' }).click();
}

export async function pingFromFocused(page: Page, targetName: string | RegExp) {
  const section = page.locator('.config-block', {
    has: page.getByRole('heading', { name: /Ping|Traceroute/ }),
  });
  const select = section.getByLabel('Target');
  const option = select.locator('option', { hasText: targetName });
  const value = await option.getAttribute('value');
  expect(value).toBeTruthy();
  await select.selectOption(value!);
  await section.getByRole('button', { name: /^Ping from /i }).click();
}

export async function pingPublicIpFromFocused(page: Page, targetIp: string) {
  const section = page.locator('.config-block', {
    has: page.getByRole('heading', { name: /Ping|Traceroute/ }),
  });
  await section.getByLabel('Public IP target').fill(targetIp);
  await section.getByRole('button', { name: /^Ping public IP from /i }).click();
}
