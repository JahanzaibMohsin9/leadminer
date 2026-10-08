import { chromium, Browser, BrowserContext, Page } from 'playwright';
import log from 'electron-log';

export class BrowserManager {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;

  async init(proxy?: string) {
    if (this.browser) return;

    try {
      const launchOptions: any = {
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
        ],
      };

      if (proxy) {
        launchOptions.proxy = { server: proxy };
      }

      const launchPromise = chromium.launch(launchOptions);
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Browser launch timed out after 30s')), 30000)
      );
      this.browser = await Promise.race([launchPromise, timeoutPromise]);

      this.context = await this.browser.newContext({
        viewport: { width: 1366, height: 768 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
      });

      this.page = await this.context.newPage();
    } catch (error) {
      // Cleanup partial initialization to prevent resource leaks
      log.error('Browser initialization failed:', error);
      await this.close();
      throw error;
    }
  }

  async getPage(proxy?: string): Promise<Page> {
    if (!this.page) {
      await this.init(proxy);
    }
    return this.page!;
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.context = null;
      this.page = null;
    }
  }
}
