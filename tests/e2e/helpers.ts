import { _electron as electron, ElectronApplication, Page, expect } from '@playwright/test';
import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

const ROOT = path.join(__dirname, '../..');
const PRIVATE_KEY = path.join(ROOT, 'native/keys/private_key.pem');

/** True when a local signing key exists, so the tests can issue themselves a license. */
export const canLicense = fs.existsSync(PRIVATE_KEY);

/**
 * Launches the built app in TEST_MODE (mock scraper) with a throwaway user-data directory,
 * so tests never read or overwrite a real stored license or database.
 */
export async function launchApp(env: Record<string, string> = {}): Promise<{ app: ElectronApplication; window: Page }> {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'leadminer-e2e-'));
  const app = await electron.launch({
    args: [ROOT, `--user-data-dir=${userData}`, '--no-sandbox', '--disable-gpu'],
    env: { ...process.env, NODE_ENV: 'production', TEST_MODE: 'true', ...env },
  });
  const window = await app.firstWindow();
  await window.waitForLoadState('domcontentloaded');
  return { app, window };
}

/** Generates a license for this machine with tools/generate-license.js and the local key. */
function makeTestLicense(): string {
  // napi modules are ABI-stable, so the Electron build of the native module also loads in Node.
  const native = require(path.join(ROOT, 'native/index.win32-x64-msvc.node'));
  const output = execFileSync(
    process.execPath,
    [path.join(ROOT, 'tools/generate-license.js'), '--hardware-id', native.getHardwareId(), '--tier', 'pro', '--lifetime'],
    { cwd: ROOT, encoding: 'utf8' }
  );
  const key = output.match(/LM-[A-Za-z0-9._=-]+/)?.[0];
  if (!key) throw new Error('Could not generate a test license');
  return key;
}

/** Activates the app through the license dialog. */
export async function activate(window: Page): Promise<void> {
  const input = window.getByLabel('License key');
  await expect(input).toBeVisible({ timeout: 10000 });
  await input.fill(makeTestLicense());
  await window.getByRole('button', { name: /Activate/ }).last().click();
  await expect(window.getByText('✓ Pro')).toBeVisible({ timeout: 10000 });
}

/** Fills the search form and starts a run. */
export async function startMining(window: Page, keyword = 'test keyword', city = 'Austin'): Promise<void> {
  await window.getByPlaceholder('e.g. Plumbers, Coffee Shops...').fill(keyword);
  await window.getByPlaceholder('Start typing city name...').fill(city);
  await window.keyboard.press('Escape'); // close the city suggestions
  await window.getByRole('button', { name: /Start Mining/ }).click();
}

/** The status badge in the header ("Idle", "Running", "Completed", ...). */
export function statusBadge(window: Page) {
  return window.locator('.status-indicator');
}
