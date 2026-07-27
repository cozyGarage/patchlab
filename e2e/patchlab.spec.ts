import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import {
  applyIp,
  clearApp,
  connectPorts,
  expectDebrief,
  expectTip,
  focusDevice,
  insertCustomAcl,
  pingFromFocused,
  pingPublicIpFromFocused,
  setAccessVlan,
  setTrunkMode,
  shot,
  shotDir,
  startMission,
  tapPort,
  unlockThrough,
  unplugPort,
} from './helpers';

test.beforeAll(() => {
  fs.mkdirSync(shotDir, { recursive: true });
});

test.describe('home & shell', () => {
  test('home, glossary, and sound toggle', async ({ page }) => {
    await clearApp(page);
    await shot(page, '01-home');
    await expect(page.getByText('PatchLab').first()).toBeVisible();
    await expect(page.getByRole('button', { name: /First Lights On/i })).toBeEnabled();
    await expect(page.locator('.stage-panel')).toContainText(/Stage 1 of 32/i);
    await expect(page.locator('.stage-panel')).toContainText(/Optional stars/i);
    await expect(page.locator('.chapter-rail')).toContainText('First Shift');
    await expect(page.locator('.chapter-rail')).toContainText('Incident Commander');
    await expect(page.getByRole('button', { name: /Traceroute Path/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Export progress/i })).toBeVisible();
    await page.getByRole('button', { name: 'Glossary' }).click();
    const glossary = page.getByRole('dialog', { name: 'Glossary' });
    await expect(glossary).toBeVisible();
    await expect(glossary.getByText('Firewall ACL')).toBeVisible();
    await expect(glossary.getByText('Static NAT', { exact: true })).toBeVisible();
    await expect(glossary.getByText('Default gateway')).toBeVisible();
    await expect(glossary.getByText('Longest-prefix match')).toBeVisible();
    await expect(glossary.getByText('Admin up / no shutdown')).toBeVisible();
    await glossary.getByRole('button', { name: 'Close' }).click();
    await page.getByRole('button', { name: /Sound:/i }).click();
    await expect(page.getByRole('button', { name: /Sound: Off/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Pace: Easy/i })).toBeVisible();
    await page.getByRole('button', { name: /Pace: Easy/i }).click();
    await expect(page.getByRole('button', { name: /Pace: Standard/i })).toBeVisible();
    await expect(page.locator('.progress-notice.ok')).toContainText(/Standard pace/i);
  });

  test('easy pace opens ticket details and coach tip', async ({ page }) => {
    await clearApp(page);
    await unlockThrough(page, 2);
    await page.getByRole('button', { name: /Wrong Port/i }).click();
    await expect(page.getByRole('heading', { name: /Wrong Port/i })).toBeVisible();
    await expect(page.getByText(/Easy coaching/i)).toBeVisible();
    await expect(page.getByRole('heading', { name: /Coach tip/i })).toBeVisible();
    await expect(page.locator('details').filter({ hasText: /Ticket details/i })).toHaveAttribute(
      'open',
      '',
    );
  });

  test('later missions stay locked until prior clears', async ({ page }) => {
    await clearApp(page);
    await expect(page.getByRole('button', { name: /Wrong Port/i })).toBeDisabled();
    await expect(page.getByRole('button', { name: /Static NAT/i })).toBeDisabled();
  });

  test('progress import validates and shows feedback', async ({ page }) => {
    await clearApp(page);
    const bad = await page.evaluate(async () => {
      const input = document.querySelector(
        '.import-label input[type="file"]',
      ) as HTMLInputElement | null;
      if (!input) return 'missing-input';
      const file = new File(['{bad'], 'bad.json', { type: 'application/json' });
      const dt = new DataTransfer();
      dt.items.add(file);
      input.files = dt.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
      return 'ok';
    });
    expect(bad).toBe('ok');
    await expect(page.locator('.progress-notice.bad')).toContainText(
      /Import failed/i,
    );

    const good = await page.evaluate(async () => {
      const input = document.querySelector(
        '.import-label input[type="file"]',
      ) as HTMLInputElement | null;
      if (!input) return 'missing-input';
      const payload = JSON.stringify({
        version: 1,
        clearedMissionIds: ['m1-first-lights'],
        stars: {
          'm1-first-lights': { correctness: 2, speed: 2, cleanliness: 1 },
        },
        sandboxUnlocked: false,
      });
      const file = new File([payload], 'good.json', {
        type: 'application/json',
      });
      const dt = new DataTransfer();
      dt.items.add(file);
      input.files = dt.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
      return 'ok';
    });
    expect(good).toBe('ok');
    await expect(page.locator('.progress-notice.ok')).toContainText(
      /Imported 1 cleared stage/i,
    );
    await expect(page.getByRole('button', { name: /Wrong Port/i })).toBeEnabled();
  });

  test('sandbox shows PDU, firewall, config panel', async ({ page }) => {
    await clearApp(page);
    await unlockThrough(page, 6);
    await page.getByRole('button', { name: /Open Sandbox/i }).click();
    await expect(page.locator('.config-panel')).toBeVisible();
    await expect(page.locator('svg.rack-svg')).toContainText('PDU-A');
    await expect(page.locator('svg.rack-svg')).toContainText('FW-EDGE');
    await expect(page.locator('svg.rack-svg')).toContainText('ISP-PEER');
    await focusDevice(page, 'ToR-SW-A');
    await expect(page.getByRole('button', { name: 'Set access VLAN' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Mode trunk' })).toBeVisible();
    await focusDevice(page, 'FW-EDGE');
    await expect(page.getByRole('button', { name: 'Apply static NAT' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Apply route' })).toBeVisible();
    await expect(page.locator('svg.rack-svg')).toContainText('BRANCH-01');
    // Focus sync: stale edits on FW must not stick when focusing SERVER-01.
    const address = page.locator('.config-panel input').nth(0);
    await address.fill('203.0.113.99');
    await focusDevice(page, 'SERVER-01');
    await expect(page.locator('.config-panel h3')).toHaveText('SERVER-01');
    await expect(address).not.toHaveValue('203.0.113.99');
    const pingSelect = page.locator('.config-panel select').last();
    await expect(pingSelect).not.toHaveValue('server-01');
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

test.describe('copper missions', () => {
  test('Mission 1 completes with tap-tap patching', async ({ page }) => {
    await clearApp(page);
    await startMission(page, /First Lights On/i);
    await shot(page, '03-m1-rack');
    await connectPorts(page, /Panel-A A-01/, /ToR-SW-A Gi1\/0\/1 VLAN 10/);
    await connectPorts(page, /ToR-SW-A Gi1\/0\/5 VLAN 10/, /SERVER-01 eth0 VLAN 10/);
    await expectDebrief(page);
    await shot(page, '05-m1-debrief');
  });

  test('Mission 2 moves panel to A-01', async ({ page }) => {
    await clearApp(page);
    await unlockThrough(page, 2);
    await startMission(page, /Wrong Port/i);
    // Drag/tap move: pull the busy A-03 end onto A-01 (peer stays on ToR).
    await connectPorts(page, /Panel-A A-03/, /Panel-A A-01/);
    await expectDebrief(page);
  });

  test('Mission 3 VLAN trap shows mismatch then completes', async ({ page }) => {
    await clearApp(page);
    await unlockThrough(page, 3);
    await startMission(page, /VLAN Trap/i);
    await expectTip(page, /VLAN mismatch/i);
    await unplugPort(page, /SERVER-07 eth0 VLAN 20/);
    await connectPorts(page, /ToR-SW-A Gi1\/0\/7 VLAN 20/, /SERVER-07 eth0 VLAN 20/);
    await expectDebrief(page);
  });

  test('Mission 4 escapes admin-down port', async ({ page }) => {
    await clearApp(page);
    await unlockThrough(page, 4);
    await startMission(page, /Admin Down/i);
    await expectTip(page, /admin down/i);
    await unplugPort(page, /ToR-SW-A Gi1\/0\/4/);
    await connectPorts(page, /Panel-A A-04/, /ToR-SW-A Gi1\/0\/6 VLAN 10/);
    await expectDebrief(page);
  });

  test('Mission 5 change window migration', async ({ page }) => {
    await clearApp(page);
    await unlockThrough(page, 5);
    await startMission(page, /Change Window/i);
    await unplugPort(page, /Panel-A A-01/);
    await connectPorts(page, /Panel-A A-08/, /ToR-SW-A Gi1\/0\/8 VLAN 10/);
    await expectDebrief(page);
  });

  test('Mission 8 dual server bring-up', async ({ page }) => {
    await clearApp(page);
    await unlockThrough(page, 8);
    await startMission(page, /Dual Server Bring-up/i);
    await connectPorts(page, /Panel-A A-01/, /ToR-SW-A Gi1\/0\/1 VLAN 10/);
    await connectPorts(page, /ToR-SW-A Gi1\/0\/5 VLAN 10/, /SERVER-01 eth0 VLAN 10/);
    await connectPorts(page, /Panel-A A-02/, /ToR-SW-A Gi1\/0\/3 VLAN 10/);
    await connectPorts(page, /ToR-SW-A Gi1\/0\/7 VLAN 20/, /SERVER-07 eth0 VLAN 20/);
    await expectDebrief(page);
  });
});

test.describe('fiber / power / console missions', () => {
  test('Mission 6 fiber path', async ({ page }) => {
    await clearApp(page);
    await unlockThrough(page, 6);
    await startMission(page, /Fiber First Light/i);
    await connectPorts(page, /Fiber-Tray F-01 fiber/, /ToR-SFP Te1\/0\/1 fiber/);
    await expectDebrief(page);
  });

  test('Mission 7 replaces wrong media with fiber', async ({ page }) => {
    await clearApp(page);
    await unlockThrough(page, 7);
    await startMission(page, /Wrong Media/i);
    await expectTip(page, /Wrong cord|Media mismatch/i);
    await unplugPort(page, /Fiber-Tray F-02 fiber/);
    await connectPorts(page, /Fiber-Tray F-02 fiber/, /ToR-SFP Te1\/0\/2 fiber/);
    await connectPorts(page, /SERVER-09 eth1-F fiber/, /ToR-SFP Te1\/0\/4 fiber/);
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
    await tapPort(page, /ToR-SW-A Gi1\/0\/1 VLAN 10/);
    await expect(page.locator('.config-panel')).toContainText(/ToR-SW-A/);
    await applyIp(page, {
      portId: 'sw-1',
      address: '10.10.10.2',
      prefix: '24',
      gateway: '10.10.10.1',
    });
    await expectDebrief(page);
    await shot(page, '21-m10-debrief');
  });
});

test.describe('logic / security missions', () => {
  test('Mission 11 same-subnet ping', async ({ page }) => {
    await clearApp(page);
    await unlockThrough(page, 11);
    await startMission(page, /Same Subnet Ping/i);
    await connectPorts(page, /ToR-SW-A Gi1\/0\/5 VLAN 10/, /SERVER-01 eth0 VLAN 10/);
    await focusDevice(page, 'SERVER-01');
    await applyIp(page, {
      portId: 'nic-1',
      address: '10.10.10.10',
      prefix: '24',
      gateway: '10.10.10.1',
    });
    await expectDebrief(page);
  });

  test('Mission 12 firewall permit then ping', async ({ page }) => {
    await clearApp(page);
    await unlockThrough(page, 12);
    await startMission(page, /Firewall Permit/i);
    await focusDevice(page, 'FW-EDGE');
    await page.getByRole('button', { name: /Insert permit 10\.10\.10\.0\/24/i }).click();
    await expectDebrief(page);
    await shot(page, '22-m12-debrief');
  });

  test('Mission 13 access VLAN assign', async ({ page }) => {
    await clearApp(page);
    await unlockThrough(page, 13);
    await startMission(page, /Access VLAN Assign/i);
    await focusDevice(page, 'ToR-SW-A');
    await setAccessVlan(page, 'sw-6', '20');
    await expectTip(page, /VLAN → 20|access VLAN → 20/i);
    await connectPorts(page, /ToR-SW-A Gi1\/0\/6 VLAN 20/, /SERVER-07 eth0 VLAN 20/);
    await expectDebrief(page);
    await shot(page, '23-m13-debrief');
  });

  test('Mission 14 VLAN isolation proves ping fail', async ({ page }) => {
    await clearApp(page);
    await unlockThrough(page, 14);
    await startMission(page, /VLAN Isolation/i);
    await connectPorts(page, /ToR-SW-A Gi1\/0\/5 VLAN 10/, /SERVER-01 eth0 VLAN 10/);
    await connectPorts(page, /ToR-SW-A Gi1\/0\/7 VLAN 20/, /SERVER-07 eth0 VLAN 20/);
    await focusDevice(page, 'SERVER-01');
    await applyIp(page, { address: '10.10.10.10', prefix: '24' });
    await focusDevice(page, 'SERVER-07');
    await applyIp(page, { address: '10.10.10.20', prefix: '24' });
    await focusDevice(page, 'SERVER-01');
    await pingFromFocused(page, /SERVER-07/);
    await expectTip(page, /Ping fail|Layer-2|VLAN/i);
    await expectDebrief(page);
  });

  test('Mission 15 default gateway to ISP peer', async ({ page }) => {
    await clearApp(page);
    await unlockThrough(page, 15);
    await startMission(page, /Default Gateway/i);
    await connectPorts(page, /ToR-SW-A Gi1\/0\/5 VLAN 10/, /SERVER-01 eth0 VLAN 10/);
    await connectPorts(page, /FW-EDGE LAN0/, /ToR-SW-A Gi1\/0\/2 VLAN 10/);
    await focusDevice(page, 'SERVER-01');
    await applyIp(page, {
      address: '10.10.10.10',
      prefix: '24',
      gateway: '10.10.10.1',
    });
    await focusDevice(page, 'FW-EDGE');
    await page.getByRole('button', { name: /Insert permit LAN → WAN/i }).click();
    await expectDebrief(page);
    await shot(page, '26-m15-debrief');
  });

  test('Mission 16 trunk uplink', async ({ page }) => {
    await clearApp(page);
    await unlockThrough(page, 16);
    await startMission(page, /Trunk Uplink/i);
    await focusDevice(page, 'ToR-SW-A');
    await setTrunkMode(page, 'sw-8');
    await expectTip(page, /mode → trunk/i);
    await connectPorts(page, /ToR-SW-A Gi1\/0\/8 VLAN 10/, /FW-EDGE LAN0/);
    await expectDebrief(page);
  });

  test('Mission 17 static NAT inbound', async ({ page }) => {
    await clearApp(page);
    await unlockThrough(page, 17);
    await startMission(page, /Static NAT/i);
    await focusDevice(page, 'FW-EDGE');
    await page.getByRole('button', { name: 'Apply static NAT' }).click();
    await expectTip(page, /NAT 10\.10\.10\.10/i);
    await page.getByRole('button', { name: /Insert permit WAN → LAN/i }).click();
    await focusDevice(page, 'ISP-PEER');
    await pingPublicIpFromFocused(page, '203.0.113.10');
    await expectDebrief(page);
    await shot(page, '24-m17-debrief');
  });

  test('Mission 18 deny one host', async ({ page }) => {
    await clearApp(page);
    await unlockThrough(page, 18);
    await startMission(page, /Deny One Host/i);
    await focusDevice(page, 'SERVER-07');
    await pingFromFocused(page, /ISP-PEER/);
    await expectTip(page, /Ping ok/i);
    await focusDevice(page, 'FW-EDGE');
    await insertCustomAcl(page, 'deny', '10.10.10.20/32', '203.0.113.0/30');
    await expectDebrief(page);
    await shot(page, '25-m18-debrief');
  });

  test('Mission 19 broken address fix', async ({ page }) => {
    await clearApp(page);
    await unlockThrough(page, 19);
    await startMission(page, /Broken Address/i);
    await focusDevice(page, 'SERVER-01');
    await applyIp(page, {
      address: '10.10.10.10',
      prefix: '24',
      gateway: '10.10.10.1',
    });
    await expectDebrief(page);
  });

  test('Mission 20 mask trap', async ({ page }) => {
    await clearApp(page);
    await unlockThrough(page, 20);
    await startMission(page, /Mask Trap/i);
    await focusDevice(page, 'SERVER-01');
    await pingFromFocused(page, /FW-EDGE/);
    await expectTip(page, /prefix|Ping fail/i);
    await applyIp(page, {
      address: '10.10.10.10',
      prefix: '24',
      gateway: '10.10.10.1',
    });
    await expectDebrief(page);
  });

  test('Mission 21 inter-VLAN router', async ({ page }) => {
    await clearApp(page);
    await unlockThrough(page, 21);
    await startMission(page, /Inter-VLAN Router/i);
    await connectPorts(page, /ToR-SW-A Gi1\/0\/5 VLAN 10/, /SERVER-01 eth0 VLAN 10/);
    await connectPorts(page, /ToR-SW-A Gi1\/0\/7 VLAN 20/, /SERVER-07 eth0 VLAN 20/);
    await connectPorts(page, /FW-EDGE LAN0/, /ToR-SW-A Gi1\/0\/2 VLAN 10/);
    await connectPorts(page, /FW-EDGE LAN20/, /ToR-SW-A Gi1\/0\/8 VLAN 20/);
    await focusDevice(page, 'SERVER-01');
    await applyIp(page, {
      address: '10.10.10.10',
      prefix: '24',
      gateway: '10.10.10.1',
    });
    await focusDevice(page, 'SERVER-07');
    await applyIp(page, {
      address: '10.10.20.10',
      prefix: '24',
      gateway: '10.10.20.1',
    });
    await expectDebrief(page);
    await shot(page, '26-m21-debrief');
  });

  test('Mission 22 static route to BRANCH', async ({ page }) => {
    await clearApp(page);
    await unlockThrough(page, 22);
    await startMission(page, /Static Route/i);
    await focusDevice(page, 'FW-EDGE');
    await page.getByRole('button', { name: 'Apply route' }).click();
    await expectTip(page, /Route 198\.51\.100\.0\/24/i);
    await page.getByRole('button', { name: /Insert permit LAN → BRANCH/i }).click();
    await expectDebrief(page);
    await shot(page, '27-m22-debrief');
  });

  test('Mission 23 no shutdown recovery', async ({ page }) => {
    await clearApp(page);
    await unlockThrough(page, 23);
    await startMission(page, /No Shutdown/i);
    await tapPort(page, /Gi1\/0\/4/);
    await page.getByRole('button', { name: 'Toggle admin' }).click();
    await expectDebrief(page);
    await shot(page, '28-m23-debrief');
  });

  test('Mission 24 wrong gateway', async ({ page }) => {
    await clearApp(page);
    await unlockThrough(page, 24);
    await startMission(page, /Wrong Gateway/i);
    await focusDevice(page, 'SERVER-01');
    await pingFromFocused(page, /ISP-PEER/);
    await expectTip(page, /gateway|Ping fail/i);
    await applyIp(page, {
      address: '10.10.10.10',
      prefix: '24',
      gateway: '10.10.10.1',
    });
    await expectDebrief(page);
    await shot(page, '29-m24-debrief');
  });

  test('Mission 25 host route override', async ({ page }) => {
    await clearApp(page);
    await unlockThrough(page, 25);
    await startMission(page, /Host Route/i);
    await focusDevice(page, 'FW-EDGE');
    const panel = page.locator('.config-panel');
    await panel
      .locator('label', { hasText: 'Destination CIDR' })
      .locator('input')
      .fill('198.51.100.10/32');
    await panel
      .locator('label', { hasText: 'Next hop' })
      .locator('input')
      .fill('203.0.113.2');
    await page.getByRole('button', { name: 'Apply route' }).click();
    await expectTip(page, /Route 198\.51\.100\.10\/32/i);
    await expectDebrief(page);
    await shot(page, '30-m25-debrief');
  });

  test('Mission 26 deny host to BRANCH', async ({ page }) => {
    await clearApp(page);
    await unlockThrough(page, 26);
    await startMission(page, /Deny to Branch/i);
    await focusDevice(page, 'FW-EDGE');
    await page
      .getByRole('button', { name: /Insert deny host 10\.10\.10\.20 → BRANCH/i })
      .click();
    await expectDebrief(page);
    await shot(page, '31-m26-debrief');
  });

  test('Mission 27 branch exception via console + custom ACL', async ({
    page,
  }) => {
    await clearApp(page);
    await unlockThrough(page, 27);
    await startMission(page, /Branch Exception/i);
    await connectPorts(page, /Console TTY2 console/, /FW-EDGE CON console/);
    await focusDevice(page, 'FW-EDGE');
    await page
      .locator('.config-panel')
      .locator('label', { hasText: 'Action' })
      .locator('select')
      .selectOption('permit');
    await page
      .locator('.config-panel')
      .locator('label', { hasText: 'Source CIDR' })
      .locator('input')
      .fill('10.10.10.10/32');
    await page
      .locator('.config-panel')
      .locator('label', { hasText: 'Dest CIDR' })
      .locator('input')
      .fill('198.51.100.10/32');
    await page.getByRole('button', { name: 'Insert custom ACL' }).click();
    await expectDebrief(page);
    await shot(page, '32-m27-debrief');
  });

  test('Mission 28 fiber no-shutdown', async ({ page }) => {
    await clearApp(page);
    await unlockThrough(page, 28);
    await startMission(page, /Fiber No-Shut/i);
    await tapPort(page, /ToR-SFP Te1\/0\/3 fiber/);
    await page.getByRole('button', { name: 'Toggle admin' }).click();
    await expectDebrief(page);
    await shot(page, '33-m28-debrief');
  });

  test('Mission 29 spare PDU outlets', async ({ page }) => {
    await clearApp(page);
    await unlockThrough(page, 29);
    await startMission(page, /Spare PDU/i);
    await connectPorts(page, /FW-EDGE PSU power/, /PDU-A OUT5 power/);
    await connectPorts(page, /SERVER-07 PSU power/, /PDU-A OUT6 power/);
    await expectDebrief(page);
    await shot(page, '34-m29-debrief');
  });

  test('Mission 30 floating static failover', async ({ page }) => {
    await clearApp(page);
    await unlockThrough(page, 30);
    await startMission(page, /Floating Static/i);
    await focusDevice(page, 'FW-EDGE');
    const panel = page.locator('.config-panel');
    await panel
      .locator('label', { hasText: 'Admin distance' })
      .locator('input')
      .fill('10');
    await page.getByRole('button', { name: 'Apply route' }).click();
    await expectTip(page, /AD10/i);
    await expectDebrief(page);
  });

  test('Mission 31 PAT overload', async ({ page }) => {
    await clearApp(page);
    await unlockThrough(page, 31);
    await startMission(page, /PAT Overload/i);
    await focusDevice(page, 'FW-EDGE');
    await page.getByRole('button', { name: /Apply PAT overload/i }).click();
    await expectDebrief(page);
  });

  test('Mission 32 traceroute path', async ({ page }) => {
    await clearApp(page);
    await unlockThrough(page, 32);
    await startMission(page, /Traceroute Path/i);
    await focusDevice(page, 'FW-EDGE');
    await page.getByRole('button', { name: 'Apply route' }).click();
    await insertCustomAcl(page, 'permit', '10.10.10.0/24', '198.51.100.0/24');
    await focusDevice(page, 'SERVER-01');
    const diagnostics = page.locator('.config-block', {
      has: page.getByRole('heading', { name: /Traceroute/ }),
    });
    const target = diagnostics.getByLabel('Target');
    const branchValue = await target
      .locator('option', { hasText: /BRANCH-01/ })
      .getAttribute('value');
    expect(branchValue).toBeTruthy();
    await target.selectOption(branchValue!);
    await diagnostics.getByRole('button', { name: /^Traceroute from /i }).click();
    await expectDebrief(page);
  });
});
