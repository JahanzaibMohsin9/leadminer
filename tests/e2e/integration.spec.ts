import { _electron as electron, test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

test.describe('Scraping Workflow', () => {
  test('should scrape and display data', async () => {
    const electronApp = await electron.launch({
      args: [path.join(__dirname, '../../out/main/main/main.js'), '--no-sandbox', '--disable-gpu'],
      env: {
        ...process.env,
        NODE_ENV: 'production',
        TEST_MODE: 'true',
      }
    });

    const window = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');

    // Input data
    await window.fill('input[placeholder*="Keyword"]', 'test keyword');
    await window.fill('input[placeholder*="City"]', 'test city');

    // Start scraping
    await window.click('text=Start Scraping');

    // Verify status changes to RUNNING
    await expect(window.locator('text=Status: RUNNING')).toBeVisible();

    // Verify data appears in table (MockScraper emits data)
    await expect(window.locator('text=Mock Business 1')).toBeVisible({ timeout: 10000 });
    await expect(window.locator('text=Mock Business 5')).toBeVisible({ timeout: 10000 });

    // Verify status changes to COMPLETED (MockScraper stops after 5)
    await expect(window.locator('text=Status: COMPLETED')).toBeVisible({ timeout: 10000 });

    // Verify lead count
    await expect(window.locator('text=Leads Found: 5')).toBeVisible();

    // Test Export
    // Prepare for download
    const downloadPromise = window.waitForEvent('download');
    await window.click('text=Export CSV');
    const download = await downloadPromise;

    // Save to temporary path
    const downloadPath = await download.path();
    expect(downloadPath).toBeTruthy();
    
    const content = fs.readFileSync(downloadPath!, 'utf-8');
    expect(content).toContain('Name,Phone,Email,Website,Address');
    expect(content).toContain('"Mock Business 1"');

    await electronApp.close();
  });

  test('should handle scraping errors', async () => {
    const electronApp = await electron.launch({
      args: [path.join(__dirname, '../../out/main/main/main.js'), '--no-sandbox', '--disable-gpu'],
      env: {
        ...process.env,
        NODE_ENV: 'production',
        TEST_MODE: 'true',
        FORCE_ERROR: 'true'
      }
    });

    const window = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');

    // Input data
    await window.fill('input[placeholder*="Keyword"]', 'error test');
    await window.fill('input[placeholder*="City"]', 'test city');

    // Start scraping
    await window.click('text=Start Scraping');

    // Verify status changes to RUNNING then ERROR
    await expect(window.locator('text=Status: RUNNING')).toBeVisible();
    await expect(window.locator('text=Status: ERROR')).toBeVisible({ timeout: 10000 });

    await electronApp.close();
  });
});
