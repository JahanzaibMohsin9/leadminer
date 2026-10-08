import { app } from 'electron';
import path from 'path';

let native: any;

try {
  let nativePath: string;

  if (app.isPackaged) {
    // Check platform and load appropriate native module
    if (process.platform === 'win32') {
      nativePath = path.join(process.resourcesPath, 'native', 'index.win32-x64-msvc.node');
    } else if (process.platform === 'darwin') {
      // macOS support - would need to build native module for macOS
      const arch = process.arch === 'arm64' ? 'aarch64' : 'x86_64';
      nativePath = path.join(process.resourcesPath, 'native', `index.darwin-${arch}.node`);
    } else {
      throw new Error(`Unsupported platform: ${process.platform}. This application currently supports Windows only.`);
    }
  } else {
    // In dev, the app path is the project root (where package.json lives).
    if (process.platform === 'win32') {
      nativePath = path.join(app.getAppPath(), 'native', 'index.win32-x64-msvc.node');
    } else {
      // Dev mode on non-Windows will use fallback mock
      throw new Error('Development mode: native module only available for Windows');
    }
  }

  console.log('Loading native module from:', nativePath);
  native = require(nativePath);
} catch (error) {
  console.warn('Failed to load native module:', error);

  // In production, fail loudly to prevent licensing bypass
  if (app.isPackaged) {
    const { dialog } = require('electron');

    let errorMessage = 'Failed to load required components. Please reinstall the application.\n\n';

    if (error instanceof Error) {
      if (error.message.includes('Unsupported platform')) {
        errorMessage = `This application is currently only available for Windows.\n\nYour platform: ${process.platform}\n\nPlease check for a compatible version or contact support.`;
      } else {
        errorMessage += `Error: Native module not found.\nDetails: ${error.message}`;
      }
    }

    dialog.showErrorBox('Critical Error', errorMessage);
    app.quit();
    throw error;
  }

  // Development fallback mock to prevent crash during development
  console.warn('Using fallback mock - development mode only');
  native = {
    RateLimiter: class {
      constructor(_ms: number) { }
      canProceed() { return true; }
      waitTime() { return 0; }
    },
    validateLicenseKey: () => JSON.stringify({ valid: true, tier: 'Pro', expires_at: null }),
    getHardwareId: () => 'dev-mock-hardware-id',
    incrementLeadCount: () => 0,
    getLeadCount: () => 0,
    resetLeadCount: () => { },
  };
}

export interface LicenseResult {
  valid: boolean;
  tier?: string;
  expires_at?: string | null;
  error?: string;
  message?: string;
}

export const RateLimiter = native.RateLimiter;

export function validateLicenseKey(key: string): LicenseResult {
  const resultJson: string = native.validateLicenseKey(key);
  return JSON.parse(resultJson) as LicenseResult;
}

export function getHardwareId(): string {
  return native.getHardwareId();
}

export const incrementLeadCount = native.incrementLeadCount;
export const getLeadCount = native.getLeadCount;
export const resetLeadCount = native.resetLeadCount;
