import { test, expect } from '@playwright/test';
import { activate, canLicense, launchApp, startMining, statusBadge } from '../e2e/helpers';

test.describe('Performance benchmark', () => {
  test.skip(!canLicense, 'Needs native/keys/private_key.pem to issue a test license (see README).');

  test('handles 50 leads quickly', async () => {
    const { app, window } = await launchApp({ MOCK_COUNT: '50', MOCK_DELAY: '10' });
    await activate(window);

    const start = Date.now();
    await startMining(window, 'perf test');
    await expect(statusBadge(window)).toHaveText('Completed', { timeout: 30000 });
    await expect(window.locator('.data-table-count')).toHaveText('50');

    const duration = Date.now() - start;
    console.log(`50 leads took ${duration}ms`);
    expect(duration).toBeLessThan(10000);

    await app.close();
  });

  test('handles 500 leads without crashing', async () => {
    test.setTimeout(60000);
    const { app, window } = await launchApp({ MOCK_COUNT: '500', MOCK_DELAY: '5' });
    await activate(window);

    await startMining(window, 'stress test');
    await expect(statusBadge(window)).toHaveText('Completed', { timeout: 45000 });
    await expect(window.locator('.data-table-count')).toHaveText('500');

    await app.close();
  });
});
