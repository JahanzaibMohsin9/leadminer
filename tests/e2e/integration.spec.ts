import { test, expect } from '@playwright/test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { activate, canLicense, launchApp, startMining, statusBadge } from './helpers';

test.describe('Scraping workflow', () => {
  test.skip(!canLicense, 'Needs native/keys/private_key.pem to issue a test license (see README).');

  test('scrapes, shows results and exports CSV', async () => {
    const { app, window } = await launchApp();
    await activate(window);
    await startMining(window);

    await expect(window.getByText('Mock Business 1')).toBeVisible({ timeout: 10000 });
    await expect(window.getByText('Mock Business 5')).toBeVisible({ timeout: 10000 });
    await expect(statusBadge(window)).toHaveText('Completed', { timeout: 10000 });
    await expect(window.locator('.data-table-count')).toHaveText('5');

    // Electron turns the download into a native "Save as" dialog; pre-set the path instead.
    const csvPath = path.join(os.tmpdir(), `leadminer-e2e-${Date.now()}.csv`);
    await app.evaluate(({ session }, savePath) => {
      session.defaultSession.once('will-download', (_event, item) => item.setSavePath(savePath));
    }, csvPath);
    await window.getByRole('button', { name: /CSV/ }).click();
    await expect.poll(() => fs.existsSync(csvPath) && fs.statSync(csvPath).size > 0, { timeout: 10000 }).toBe(true);
    const content = fs.readFileSync(csvPath, 'utf-8');
    expect(content).toContain('Name,Phone,Email,Website,Address');
    expect(content).toContain('"Mock Business 1"');

    await app.close();
  });

  test('shows an error status when scraping fails', async () => {
    const { app, window } = await launchApp({ FORCE_ERROR: 'true' });
    await activate(window);
    await startMining(window, 'error test');

    await expect(statusBadge(window)).toHaveText('Error', { timeout: 10000 });
    await expect(window.getByText('Simulated scraping failure (FORCE_ERROR)')).toBeVisible();

    await app.close();
  });

  test('pause and resume continue the run to completion', async () => {
    const { app, window } = await launchApp({ MOCK_COUNT: '10', MOCK_DELAY: '300' });
    await activate(window);
    await startMining(window);

    await expect(window.getByText('Mock Business 2')).toBeVisible({ timeout: 10000 });
    await window.getByRole('button', { name: /Pause/ }).click();
    await expect(statusBadge(window)).toHaveText('Paused');
    await window.getByRole('button', { name: /Resume/ }).click();

    await expect(statusBadge(window)).toHaveText('Completed', { timeout: 15000 });
    await expect(window.locator('.data-table-count')).toHaveText('10');

    await app.close();
  });

  test('blocks scraping until a license is activated', async () => {
    const { app, window } = await launchApp();
    await expect(window.getByLabel('License key')).toBeVisible({ timeout: 10000 });
    await expect(window.getByText('🔒 Unlicensed')).toBeVisible();
    await app.close();
  });
});
