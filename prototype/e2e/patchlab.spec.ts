import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import {
  clearApp,
  connectPorts,
  expectDebrief,
  expectTip,
  shot,
  shotDir,
  startMission,
  tapPort,
  unlockThrough,
} from './helpers';

test.beforeAll(() => {
  fs.mkdirSync(shotDir, { recursive: true });
});

test.describe('PatchLab browser QA', () => {
  test('home, glossary, and sound toggle', async ({ page }) => {
    await clearApp(page);
    await shot(page, '01-home');

    await expect(page.getByText('PatchLab').first()).toBeVisible();
    await expect(page.getByRole('button', { name: /First Lights On/i })).toBeEnabled();
    await expect(page.getByRole('button', { name: /Wrong Port/i })).toBeDisabled();
    await expect(page.getByRole('button', { name: /Open Sandbox|Sandbox unlocks/i })).toBeDisabled();

    await page.getByRole('button', { name: 'Glossary' }).click();
    await expect(page.getByRole('dialog', { name: 'Glossary' })).toBeVisible();
    await expect(page.getByText('OM4 fiber / LC')).toBeVisible();
    await shot(page, '02-glossary');
    await page.getByRole('button', { name: 'Close' }).click();
    await expect(page.getByRole('dialog', { name: 'Glossary' })).toHaveCount(0);

    await page.getByRole('button', { name: /Sound:/i }).click();
    await expect(page.getByRole('button', { name: /Sound: Off/i })).toBeVisible();
    await page.getByRole('button', { name: /Sound: Off/i }).click();
    await expect(page.getByRole('button', { name: /Sound: On/i })).toBeVisible();
  });

  test('Mission 1 completes with tap-tap patching', async ({ page }) => {
    await clearApp(page);
    await startMission(page, /First Lights On/i);
    await shot(page, '03-m1-rack');

    await connectPorts(page, /^A-01$/, /Gi1\/0\/1 VLAN 10/);
    await expectTip(page, /Link up|Connected/i);
    await expect(page.locator('.goal-pill.met')).toHaveCount(1);

    await connectPorts(page, /Gi1\/0\/5 VLAN 10/, /eth0 VLAN 10/);
    await shot(page, '04-m1-complete-glow');
    await expectDebrief(page);
    await shot(page, '05-m1-debrief');
    await expect(page.getByText('Correctness')).toBeVisible();
    await page.getByRole('button', { name: 'Home' }).click();
    await expect(page.getByRole('button', { name: /Wrong Port/i })).toBeEnabled();
  });

  test('Mission 3 VLAN trap shows mismatch then completes', async ({ page }) => {
    await clearApp(page);
    await unlockThrough(page, 3);
    await startMission(page, /VLAN Trap/i);
    await shot(page, '06-m3-mismatch');
    await expectTip(page, /VLAN mismatch/i);

    await tapPort(page, /eth0 VLAN 20/);
    await page.getByRole('button', { name: 'Unplug' }).click();
    await connectPorts(page, /Gi1\/0\/7/, /eth0 VLAN 20/);
    await expectDebrief(page);
    await shot(page, '07-m3-debrief');
    await page.getByRole('button', { name: 'Home' }).click();
    await expect(page.getByRole('button', { name: /Open Sandbox/i })).toBeEnabled();
  });

  test('Mission 6 fiber path and inventory', async ({ page }) => {
    await clearApp(page);
    await unlockThrough(page, 6);
    await startMission(page, /Fiber First Light/i);
    await shot(page, '08-m6-rack');

    await expect(page.locator('.tip-bar')).toContainText(/Fib ×/);
    await connectPorts(page, /F-01 fiber/, /Te1\/0\/1 fiber/);
    await expectTip(page, /Fiber link up|Goals complete|Connected/i);
    await expectDebrief(page);
    await shot(page, '09-m6-debrief');
  });

  test('Mission 7 wrong media fault then repair', async ({ page }) => {
    await clearApp(page);
    await unlockThrough(page, 7);
    await startMission(page, /Wrong Media/i);
    await shot(page, '10-m7-fault');
    await expectTip(page, /Wrong patch cord|Media mismatch/i);

    await tapPort(page, /F-02 fiber/);
    await page.getByRole('button', { name: 'Unplug' }).click();
    await connectPorts(page, /F-02 fiber/, /Te1\/0\/2 fiber/);
    await connectPorts(page, /eth1-F fiber/, /Te1\/0\/4 fiber/);
    await expectDebrief(page);
    await shot(page, '11-m7-debrief');
  });

  test('Mission 8 dual servers', async ({ page }) => {
    await clearApp(page);
    await unlockThrough(page, 8);
    await startMission(page, /Dual Server Bring-up/i);

    await connectPorts(page, /^A-01$/, /Gi1\/0\/1 VLAN 10/);
    await connectPorts(page, /Gi1\/0\/5 VLAN 10/, /eth0 VLAN 10/);
    await connectPorts(page, /^A-02$/, /Gi1\/0\/3 VLAN 10/);
    await connectPorts(page, /Gi1\/0\/7 VLAN 20/, /eth0 VLAN 20/);
    await expectDebrief(page);
    await shot(page, '12-m8-debrief');
  });

  test('sandbox VLAN cycle and admin toggle', async ({ page }) => {
    await clearApp(page);
    await unlockThrough(page, 4);
    await page.getByRole('button', { name: /Open Sandbox/i }).click();
    await expect(page.getByRole('heading', { name: 'Sandbox' })).toBeVisible();
    await shot(page, '13-sandbox');

    await tapPort(page, /Gi1\/0\/1 VLAN 10/);
    await page.getByRole('button', { name: 'Cycle VLAN' }).click();
    await expectTip(page, /VLAN → 20/);
    await page.getByRole('button', { name: 'Toggle admin' }).click();
    await expectTip(page, /admin → down/);
    await shot(page, '14-sandbox-edited');

    // Deselect edited port so the next tap-tap does not reuse it
    await tapPort(page, /Gi1\/0\/1 VLAN 20/);
    await connectPorts(page, /F-01 fiber/, /Te1\/0\/1 fiber/);
    await expectTip(page, /Fiber link up|Connected/i);
  });

  test('hint ghost appears after wrong attempts on M1', async ({ page }) => {
    await clearApp(page);
    await startMission(page, /First Lights On/i);

    // Two busy-port mistakes to unlock Hint (threshold = 2)
    await connectPorts(page, /^A-03$/, /Gi1\/0\/2/);
    await connectPorts(page, /^A-03$/, /Gi1\/0\/1/); // busy on A-03
    await connectPorts(page, /^A-02$/, /Gi1\/0\/2/); // busy on Gi1/0/2
    await expect(page.getByRole('button', { name: 'Hint' })).toBeVisible();
    await page.getByRole('button', { name: 'Hint' }).click();
    await expectTip(page, /Hint:/i);
    await expect(page.getByTestId('hint-ghost')).toHaveCount(1);
    await shot(page, '15-hint-ghost');
  });

  test('mobile viewport mission brief and rack usable', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await clearApp(page);
    await shot(page, '16-mobile-home');
    await startMission(page, /First Lights On/i);
    await expect(page.locator('svg.rack-svg')).toBeVisible();
    await connectPorts(page, /^A-01$/, /Gi1\/0\/1 VLAN 10/);
    await expectTip(page, /Link up|Connected/i);
    await shot(page, '17-mobile-rack');
  });

  test('busy port and self-connect protections', async ({ page }) => {
    await clearApp(page);
    await unlockThrough(page, 1);
    await startMission(page, /First Lights On/i);
    await connectPorts(page, /^A-01$/, /Gi1\/0\/1 VLAN 10/);
    await connectPorts(page, /^A-02$/, /Gi1\/0\/1 VLAN 10/);
    await expectTip(page, /Port busy/i);
    await shot(page, '18-port-busy');
  });
});
