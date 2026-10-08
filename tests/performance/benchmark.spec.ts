import { _electron as electron, test, expect } from '@playwright/test';
import path from 'path';

test.describe('Performance Benchmark', () => {
  test('should handle 50 leads efficiently', async () => {
    const startTime = Date.now();
    const electronApp = await electron.launch({
      args: [path.join(__dirname, '../../out/main/main/main.js'), '--no-sandbox', '--disable-gpu'],
      env: {
        ...process.env,
        NODE_ENV: 'production',
        TEST_MODE: 'true',
        MOCK_COUNT: '50',
        MOCK_DELAY: '10' // Fast generation
      }
    });

    const window = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');

    await window.fill('input[placeholder*="Keyword"]', 'perf test');
    await window.fill('input[placeholder*="City"]', 'test city');
    await window.click('text=Start Scraping');

    // Wait for completion
    await expect(window.locator('text=Status: COMPLETED')).toBeVisible({ timeout: 30000 });
    
    // Verify count
    await expect(window.locator('text=Leads Found: 50')).toBeVisible();

    const duration = Date.now() - startTime;
    console.log(`50 leads took ${duration}ms`);
    
    expect(duration).toBeLessThan(10000); // Should be very fast with mock

    await electronApp.close();
  });

  test('should handle 500 leads without crash', async () => {
    test.setTimeout(60000);
    const startTime = Date.now();
    const electronApp = await electron.launch({
      args: [path.join(__dirname, '../../out/main/main/main.js'), '--no-sandbox', '--disable-gpu'],
      env: {
        ...process.env,
        NODE_ENV: 'production',
        TEST_MODE: 'true',
        MOCK_COUNT: '500',
        MOCK_DELAY: '5' // Very fast
      }
    });

    const window = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');

    await window.fill('input[placeholder*="Keyword"]', 'stress test');
    await window.fill('input[placeholder*="City"]', 'test city');
    await window.click('text=Start Scraping');

    // Wait for completion
    await expect(window.locator('text=Status: COMPLETED')).toBeVisible({ timeout: 60000 });
    
    // Verify count
    await expect(window.locator('text=Leads Found: 500')).toBeVisible();

    const duration = Date.now() - startTime;
    console.log(`500 leads took ${duration}ms`);

    await electronApp.close();
  });
});
