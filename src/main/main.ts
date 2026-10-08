import { app, BrowserWindow, ipcMain, safeStorage } from 'electron';
import path from 'path';
import log from 'electron-log';
import { BrowserManager } from './scraping/browser-manager';
import { Navigator } from './scraping/navigator';
import { Scraper } from './scraping/scraper';
import { MockScraper } from './scraping/mock-scraper';
import { DataProcessor } from './processing/data-processor';
import { ScrapeConfig } from '../common/types';
import { validateLicenseKey, resetLeadCount, getHardwareId } from './native-bridge';
import { ProxyManager } from './scraping/proxy-manager';
import { DatabaseManager } from './storage/database-manager';
import { InputValidator } from './scraping/input-validator';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';

const execAsync = promisify(exec);

// Configure electron-log
log.transports.file.level = 'info';
log.transports.file.maxSize = 5 * 1024 * 1024; // 5MB
log.transports.console.level = 'debug';
log.info('LeadMiner Desktop starting...');

const browserManager = new BrowserManager();
const dataProcessor = new DataProcessor();
const dbManager = new DatabaseManager();
let scraper: Scraper | MockScraper | null = null;
let currentSessionId: number | null = null;
let isLicenseValid = false; // Track license status

// License storage constants
const LICENSE_FILE_NAME = 'license.enc';

/**
 * Cleanup orphaned Playwright/Chromium processes from previous crashes
 */
async function cleanupOrphanProcesses() {
  try {
    log.info('Checking for orphan Playwright/Chromium processes');
    if (process.platform === 'win32') {
      // Kill orphaned Chrome/Chromium processes
      const { stdout } = await execAsync('tasklist /fi "imagename eq chrome.exe" /fo csv');
      if (stdout.includes('chrome.exe')) {
        log.warn('Found orphaned Chrome processes, cleaning up');
        await execAsync('taskkill /f /im chrome.exe /t').catch(() => { });
      }
    } else if (process.platform === 'darwin') {
      // macOS cleanup for Chromium processes
      await execAsync('pkill -f "Chromium"').catch(() => { });
    }
  } catch (error) {
    log.error('Error during orphan process cleanup:', error);
  }
}

/**
 * Load and validate stored license key
 */
function loadStoredLicense(): boolean {
  try {
    if (!safeStorage.isEncryptionAvailable()) {
      log.warn('Encryption not available on this system');
      return false;
    }

    const licensePath = path.join(app.getPath('userData'), LICENSE_FILE_NAME);

    if (!fs.existsSync(licensePath)) {
      log.info('No stored license found');
      return false;
    }

    const encryptedData = fs.readFileSync(licensePath);
    const decryptedKey = safeStorage.decryptString(encryptedData);

    const result = validateLicenseKey(decryptedKey);
    if (result.valid) {
      isLicenseValid = true;
      log.info('Stored license validated successfully');
      return true;
    } else {
      log.warn('Stored license is invalid:', result.error);
      fs.unlinkSync(licensePath);
      return false;
    }
  } catch (error) {
    log.error('Error loading stored license:', error);
    return false;
  }
}

/**
 * Persist license key to secure storage
 */
function persistLicense(key: string): boolean {
  try {
    if (!safeStorage.isEncryptionAvailable()) {
      log.error('Cannot persist license: encryption not available');
      return false;
    }

    const licensePath = path.join(app.getPath('userData'), LICENSE_FILE_NAME);
    const encryptedData = safeStorage.encryptString(key);
    fs.writeFileSync(licensePath, encryptedData);
    log.info('License persisted successfully');
    return true;
  } catch (error) {
    log.error('Error persisting license:', error);
    return false;
  }
}

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: path.join(app.getAppPath(), 'build', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  if (!app.isPackaged && process.env.NODE_ENV !== 'production') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    // In production, load from out/renderer
    // __dirname is out/main/main, so we need ../.. to get to out/
    mainWindow.loadFile(path.join(__dirname, '..', '..', 'renderer', 'index.html'));
  }
}

app.whenReady().then(async () => {
  // Cleanup orphaned processes from previous crashes
  await cleanupOrphanProcesses();

  // Try to load stored license
  loadStoredLicense();

  createWindow();

  ipcMain.handle('start-scraping', async (event, config: ScrapeConfig) => {
    log.info('Start scraping request:', { keyword: config.keyword, city: config.city });

    // Check license before allowing scraping
    if (!isLicenseValid) {
      log.warn('Scraping blocked: No valid license');
      return { success: false, error: 'Valid license required. Please activate your license.' };
    }

    // Validate input before proceeding
    const validationError = InputValidator.validate(config);
    if (validationError) {
      log.warn('Input validation failed:', validationError);
      return { success: false, error: validationError };
    }

    try {
      // Create new session in database
      currentSessionId = dbManager.createSession(config);
      log.info(`Created session ID: ${currentSessionId}`);

      // Reset data processor for new session
      dataProcessor.reset();
      resetLeadCount();

      // Handle Proxy
      let proxy: string | undefined;
      if (config.useProxy && config.proxies && config.proxies.length > 0) {
        const proxyManager = new ProxyManager(config.proxies);
        proxy = proxyManager.getNextProxy();
        log.info(`Using proxy: ${proxy}`);
      }

      // Ensure fresh browser instance for new settings (especially proxy)
      await browserManager.close();
      scraper = null; // Reset scraper since page is gone

      if (process.env.TEST_MODE === 'true') {
        if (!scraper) {
          scraper = new MockScraper(
            (data) => {
              const cleanData = dataProcessor.process(data);
              if (cleanData.length > 0) {
                // Save to database (MockScraper)
                if (currentSessionId) {
                  dbManager.saveLeads(currentSessionId, cleanData);
                }
                event.sender.send('scrape-update', cleanData);
              }
            },
            (status) => {
              if (currentSessionId) {
                dbManager.updateSessionStatus(currentSessionId, status);
              }
              event.sender.send('status-change', status);
            }
          );
        }
        scraper.scrape(config);
        return { success: true };
      }

      const page = await browserManager.getPage(proxy);

      if (!scraper) {
        const navigator = new Navigator(page);
        scraper = new Scraper(
          page,
          navigator,
          (data) => {
            const cleanData = dataProcessor.process(data);
            if (cleanData.length > 0) {
              // Save to database
              if (currentSessionId) {
                dbManager.saveLeads(currentSessionId, cleanData);
              }
              event.sender.send('scrape-update', cleanData);
            }
          },
          (status) => {
            if (currentSessionId) {
              dbManager.updateSessionStatus(currentSessionId, status);
            }
            event.sender.send('status-change', status);
          }
        );
      }

      // Run scraping in background
      scraper.scrape(config);
      return { success: true };
    } catch (e: any) {
      log.error('Failed to start scraping:', e);
      const errorMessage = e.message || 'An unexpected error occurred while starting scraping';
      return { success: false, error: errorMessage };
    }
  });

  ipcMain.handle('stop-scraping', async () => {
    log.info('Stop scraping request');
    if (scraper) {
      await scraper.stop();
    }
  });

  ipcMain.handle('pause-scraping', async () => {
    log.info('Pause scraping request');
    if (scraper) {
      await scraper.pause();
    }
  });

  ipcMain.handle('resume-scraping', async () => {
    log.info('Resume scraping request');
    if (scraper) {
      await scraper.resume();
    }
  });

  ipcMain.handle('validate-license', (event, key: string) => {
    const result = validateLicenseKey(key);
    if (result.valid) {
      isLicenseValid = true;
      persistLicense(key);
      log.info('License activated and persisted successfully');
    } else {
      log.warn('License validation failed:', result.error);
    }
    return result;
  });

  ipcMain.handle('get-license-status', () => {
    return isLicenseValid;
  });

  ipcMain.handle('get-hardware-id', () => {
    try {
      return getHardwareId();
    } catch (error) {
      log.error('Failed to get hardware ID:', error);
      return 'unavailable';
    }
  });

  // Database access handlers
  ipcMain.handle('get-recent-sessions', () => {
    return dbManager.getRecentSessions();
  });

  ipcMain.handle('get-session-leads', (event, sessionId: number) => {
    return dbManager.getSessionLeads(sessionId);
  });

  ipcMain.handle('load-session', (event, sessionId: number) => {
    const session = dbManager.getSession(sessionId);
    if (!session) return null;
    const leads = dbManager.getSessionLeads(sessionId);
    return { session, leads };
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

let isQuitting = false;

app.on('before-quit', async (event) => {
  if (!isQuitting) {
    event.preventDefault();
    isQuitting = true;
    await browserManager.close();
    dbManager.close();
    app.quit();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
