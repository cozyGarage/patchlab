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
    await page.getByRole('button', { name: 'Glossary' }).click();
    await expect(page.getByRole('dialog', { name: 'Glossary' })).toBeVisible();
    await expect(page.getByText('Firewall ACL')).toBeVisible();
    await page.getByRole('button', { name: 'Close' }).click();
    await page.getByRole('button', { name: /Sound:/i }).click();
    await expect(page.getByRole('button', { name: /Sound: Off/i })).toBeVisible();
  });

  test('Mission 1 completes with tap-tap patching', async ({ page }) => {
    await clearApp(page);
    await startMission(page, /First Lights On/i);
    await shot(page, '03-m1-rack');
    await connectPorts(page, /Panel-A A-01/, /ToR-SW-A Gi1\/0\/1 VLAN 10/);
    await expect(page.locator('.goal-pill.met')).toHaveCount(1);
    await connectPorts(page, /ToR-SW-A Gi1\/0\/5 VLAN 10/, /SERVER-01 eth0 VLAN 10/);
    await expectDebrief(page);
    await shot(page, '05-m1-debrief');
  });

  test('Mission 3 VLAN trap shows mismatch then completes', async ({ page }) => {
    await clearApp(page);
    await unlockThrough(page, 3);
    await startMission(page, /VLAN Trap/i);
    await expectTip(page, /VLAN mismatch/i);
    await tapPort(page, /SERVER-07 eth0 VLAN 20/);
    await page.getByRole('button', { name: 'Unplug' }).click();
    await connectPorts(page, /ToR-SW-A Gi1\/0\/7 VLAN 20/, /SERVER-07 eth0 VLAN 20/);
    await expectDebrief(page);
  });

  test('Mission 6 fiber path', async ({ page }) => {
    await clearApp(page);
    await unlockThrough(page, 6);
    await startMission(page, /Fiber First Light/i);
    await connectPorts(page, /Fiber-Tray F-01 fiber/, /ToR-SFP Te1\/0\/1 fiber/);
    await expectDebrief(page);
  });

  test('Mission 9 power-up then data', async ({ page }) => {
    await clearApp(page);
    await unlockThrough(page, 9);
    await startMission(page, /Power the Rack/i);
    await shot(page, '19-m9-dark');
    await connectPorts(page, /Panel-A A-01/, /ToR-SW-A Gi1\/0\/1 VLAN 10/);
    await expectTip(page, /No power|No link/i);
    await connectPorts(page, /ToR-SW-A PSU power/, /PDU-A OUT1 power/);
    await connectPorts(page, /SERVER-01 PSU power/, /PDU-A OUT2 power/);
    await connectPorts(page, /ToR-SW-A Gi1\/0\/5 VLAN 10/, /SERVER-01 eth0 VLAN 10/);
    await expectDebrief(page);
    await shot(page, '20-m9-debrief');
  });

  test('Mission 10 console and IP config panel', async ({ page }) => {
    await clearApp(page);
    await unlockThrough(page, 10);
    await startMission(page, /Console & Mgmt IP/i);
    await connectPorts(page, /Console TTY1 console/, /ToR-SW-A CON console/);
    await page.getByRole('button', { name: /ToR-SW-A Gi1\/0\/1 VLAN 10/ }).click();
    await expect(page.locator('.config-panel')).toContainText(/ToR-SW-A/);
    await page.locator('.config-panel select').first().selectOption('sw-1');
    await page.locator('.config-panel input').nth(0).fill('10.10.10.2');
    await page.locator('.config-panel input').nth(1).fill('24');
    await page.locator('.config-panel input').nth(2).fill('10.10.10.1');
    await page.getByRole('button', { name: 'Apply IP' }).click();
    await expectDebrief(page);
    await shot(page, '21-m10-debrief');
  });

  test('Mission 12 firewall permit then ping', async ({ page }) => {
    await clearApp(page);
    await unlockThrough(page, 12);
    await startMission(page, /Firewall Permit/i);
    // Focus firewall chassis via its LCD/name region
    await page.locator('text=FW-EDGE').first().click();
    await page.getByRole('button', { name: /Insert permit 10\.10\.10\.0\/24/i }).click();
    await expectDebrief(page);
    await shot(page, '22-m12-debrief');
  });

  test('Mission 13 access VLAN assign', async ({ page }) => {
    await clearApp(page);
    await unlockThrough(page, 13);
    await startMission(page, /Access VLAN Assign/i);
    await page.locator('text=ToR-SW-A').first().click();
    const selects = page.locator('.config-panel select');
    // Interface (IP) · Switchport port · Access VLAN
    await selects.nth(1).selectOption('sw-6');
    await selects.nth(2).selectOption('20');
    await page.getByRole('button', { name: 'Set access VLAN' }).click();
    await connectPorts(page, /ToR-SW-A Gi1\/0\/6 VLAN 20/, /SERVER-07 eth0 VLAN 20/);
    await expectDebrief(page);
    await shot(page, '23-m13-debrief');
  });

  test('Mission 17 static NAT inbound', async ({ page }) => {
    await clearApp(page);
    await unlockThrough(page, 17);
    await startMission(page, /Static NAT/i);
    await page.locator('text=FW-EDGE').first().click();
    await page.getByRole('button', { name: 'Apply static NAT' }).click();
    await page.getByRole('button', { name: /Insert permit WAN → LAN/i }).click();
    await expectDebrief(page);
    await shot(page, '24-m17-debrief');
  });

  test('Mission 18 deny one host', async ({ page }) => {
    await clearApp(page);
    await unlockThrough(page, 18);
    await startMission(page, /Deny One Host/i);
    await page.locator('text=FW-EDGE').first().click();
    await page.getByRole('button', { name: /Insert deny host 10\.10\.10\.20/i }).click();
    await expectDebrief(page);
    await shot(page, '25-m18-debrief');
  });

  test('sandbox shows PDU, firewall, config panel', async ({ page }) => {
    await clearApp(page);
    await unlockThrough(page, 4);
    await page.getByRole('button', { name: /Open Sandbox/i }).click();
    await expect(page.locator('.config-panel')).toBeVisible();
    await expect(page.locator('svg.rack-svg')).toContainText('PDU-A');
    await expect(page.locator('svg.rack-svg')).toContainText('FW-EDGE');
    await shot(page, '13-sandbox');
  });

  test('mobile viewport still usable', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await clearApp(page);
    await startMission(page, /First Lights On/i);
    await connectPorts(page, /Panel-A A-01/, /ToR-SW-A Gi1\/0\/1 VLAN 10/);
    await expectTip(page, /Link up|Connected/i);
    await shot(page, '17-mobile-rack');
  });
});
