import { Page } from 'playwright';
import { BusinessData, ScrapeConfig, ScrapeStatus } from '../../common/types';
import { Navigator } from './navigator';
import { EmailExtractor } from './email-extractor';
import { incrementLeadCount } from '../native-bridge';
import { SpeedController } from './speed-controller';
import log from 'electron-log';

export class Scraper {
  private isRunning = false;
  private shouldStop = false;
  private isPaused = false;
  private sessionLeadCount = 0;
  private static readonly MAX_LEADS_PER_SESSION = 1000; // Safety limit

  private static readonly SELECTORS = {
    feed: 'div[role="feed"]',
    resultLink: 'a[href*="/maps/place/"]',
    name: 'h1',
    address: 'button[data-item-id="address"]',
    phone: 'button[data-item-id^="phone"]',
    website: 'a[data-item-id="authority"]',
    websiteFallback: 'a[aria-label^="Website"]',
  };

  // Fallback selectors for resilience
  private static readonly FALLBACK_SELECTORS = {
    name: ['h1', 'h2.fontHeadlineLarge', '[role="heading"]'],
    feed: ['div[role="feed"]', '[role="main"]'],
    phone: ['button[data-item-id^="phone"]', 'button[aria-label*="Phone"]', '[data-tooltip*="phone"]'],
    address: ['button[data-item-id="address"]', 'button[aria-label*="Address"]', '[data-tooltip*="address"]'],
    website: ['a[data-item-id="authority"]', 'a[aria-label^="Website"]', 'a[href^="http"][data-item-id]'],
  };

  constructor(
    private page: Page,
    private navigator: Navigator,
    private onUpdate: (data: BusinessData[]) => void,
    private onStatus: (status: ScrapeStatus) => void
  ) { }

  async stop() {
    this.shouldStop = true;
    this.isPaused = false; // Clear pause state on stop
  }

  async pause() {
    if (this.isRunning && !this.isPaused && !this.shouldStop) {
      this.isPaused = true;
      this.onStatus('paused');
    }
  }

  async resume() {
    if (this.isPaused) {
      this.isPaused = false;
      this.onStatus('running');
    }
  }

  private async waitWhilePaused() {
    while (this.isPaused && !this.shouldStop) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  async scrape(config: ScrapeConfig) {
    if (this.isRunning) return;
    this.isRunning = true;
    this.shouldStop = false;
    this.sessionLeadCount = 0; // Reset session counter
    this.onStatus('running');

    try {
      const query = `${config.keyword} in ${config.city}`;
      await this.navigator.navigateToSearch(query);

      // Check for CAPTCHA
      const captchaDetected = await this.detectCaptcha();
      if (captchaDetected) {
        log.warn('CAPTCHA detected, aborting scrape');
        const errorMsg = 'CAPTCHA detected. Please slow down your scraping speed or try again later. Consider using a proxy or waiting a few hours.';
        this.onStatus({ status: 'error', message: errorMsg } as any);
        return;
      }

      // 1. Collect links (Pagination Handling)
      const links = await this.collectLinks(config);
      log.info(`Collected ${links.length} links`);

      // Check run limits
      if (links.length > Scraper.MAX_LEADS_PER_SESSION) {
        log.warn(`Limiting scrape to ${Scraper.MAX_LEADS_PER_SESSION} leads for safety`);
        links.splice(Scraper.MAX_LEADS_PER_SESSION);
      }

      // 2. Process each link (Data Extraction)
      const speedController = new SpeedController(config.speed);

      for (const link of links) {
        if (this.shouldStop) break;

        // Check if paused and wait
        await this.waitWhilePaused();
        if (this.shouldStop) break;

        // Adaptive Delay
        await speedController.waitForNextAction(this.page);

        const success = await this.processBusiness(link);
        if (success) {
          incrementLeadCount();
          this.sessionLeadCount++;
          speedController.reportSuccess();

          // Check session limit
          if (this.sessionLeadCount >= Scraper.MAX_LEADS_PER_SESSION) {
            log.info('Session limit reached, stopping scrape');
            break;
          }
        } else {
          speedController.reportError();
        }
      }

      this.onStatus(this.shouldStop ? 'paused' : 'completed');
    } catch (error: any) {
      log.error('Scrape error:', error);
      const errorMsg = error.message || 'An unexpected error occurred during scraping';
      this.onStatus({ status: 'error', message: errorMsg } as any);
    } finally {
      this.isRunning = false;
    }
  }

  private async detectCaptcha(): Promise<boolean> {
    try {
      // Common CAPTCHA selectors and indicators
      const captchaSelectors = [
        'iframe[src*="recaptcha"]',
        'iframe[src*="captcha"]',
        '#captcha',
        '.g-recaptcha',
      ];

      for (const selector of captchaSelectors) {
        const element = await this.page.$(selector);
        if (element) {
        log.debug(`CAPTCHA detected: ${selector}`);
          return true;
        }
      }

      // Check for rate limit indicators in page content
      const content = await this.page.content();
      if (content.includes('unusual traffic') || content.includes('automated requests')) {
        log.warn('Rate limit/CAPTCHA text detected');
        return true;
      }

      return false;
    } catch (error) {
      log.error('Error detecting CAPTCHA:', error);
      return false;
    }
  }

  private async collectLinks(config: ScrapeConfig): Promise<string[]> {
    const links = new Set<string>();

    // Try primary selector first, then fallbacks
    let feedSelector = Scraper.SELECTORS.feed;
    let found = false;

    try {
      await this.page.waitForSelector(feedSelector, { timeout: 10000 });
      found = true;
    } catch {
      log.debug('Primary feed selector failed, trying fallbacks');
      for (const fallback of Scraper.FALLBACK_SELECTORS.feed) {
        try {
          await this.page.waitForSelector(fallback, { timeout: 3000 });
          feedSelector = fallback;
          found = true;
          log.debug(`Using fallback selector: ${fallback}`);
          break;
        } catch {
          continue;
        }
      }
    }

    if (!found) {
      log.warn('No feed found with any selector');
      return [];
    }

    const feed = this.page.locator(feedSelector);
    let previousHeight = 0;
    let noChangeCount = 0;

    // Limit for safety
    const LIMIT = 1000;

    while (!this.shouldStop) {
      // Collect visible links
      const elements = await this.page.$$(Scraper.SELECTORS.resultLink);
      for (const el of elements) {
        const href = await el.getAttribute('href');
        if (href) links.add(href);
      }

      if (links.size >= LIMIT) break;

      // Scroll the feed
      await feed.evaluate((el: HTMLElement) => el.scrollBy(0, 1000));
      await this.page.waitForTimeout(1000); // Wait for load

      // Check for end of list
      const currentHeight = await feed.evaluate((el: HTMLElement) => el.scrollHeight);
      if (currentHeight === previousHeight) {
        noChangeCount++;
        if (noChangeCount > 3) break;
      } else {
        noChangeCount = 0;
        previousHeight = currentHeight;
      }
    }
    return Array.from(links);
  }

  /**
   * Clean extracted text by removing special Unicode characters and fixing encoding issues
   * This removes invisible characters, control characters, and problematic Unicode symbols
   * that often come from web scraping (like map icons, directional arrows, etc.)
   */
  private cleanText(text: string | undefined): string | undefined {
    if (!text) return undefined;

    return text
      // Remove common problematic Unicode characters
      .replace(/[\u0080-\u009F]/g, '') // Control characters
      .replace(/[\u200B-\u200D\uFEFF]/g, '') // Zero-width spaces
      .replace(/[\u2000-\u206F]/g, '') // General punctuation (includes various spaces and formatting)
      .replace(/[\uE000-\uF8FF]/g, '') // Private use area (often used for icons)
      .replace(/[\uD800-\uDFFF]/g, '') // Surrogates (can cause encoding issues)
      // Remove specific problematic sequences
      .replace(/îƒˆ/g, '') // The specific corruption reported
      // Normalize whitespace
      .replace(/\s+/g, ' ')
      .trim() || undefined;
  }

  private async processBusiness(url: string): Promise<boolean> {
    try {
      await this.page.goto(url, { waitUntil: 'domcontentloaded' });
      await this.page.waitForSelector(Scraper.SELECTORS.name, { timeout: 5000 });

      const getText = async (selector: string) => {
        const el = this.page.locator(selector).first();
        if (await el.isVisible()) {
          const text = await el.textContent();
          return this.cleanText(text?.trim());
        }
        return undefined;
      };

      // Try multiple selectors with fallbacks
      const getTextWithFallbacks = async (selectors: string[]) => {
        for (const selector of selectors) {
          try {
            const text = await getText(selector);
            if (text) return text;
          } catch {
            continue;
          }
        }
        return undefined;
      };

      // Website might be in different attributes or elements
      const getHref = async (selector: string) => {
        const el = this.page.locator(selector).first();
        if (await el.isVisible()) {
          return await el.getAttribute('href') || undefined;
        }
        return undefined;
      };

      const getHrefWithFallbacks = async (selectors: string[]) => {
        for (const selector of selectors) {
          try {
            const href = await getHref(selector);
            if (href) return href;
          } catch {
            continue;
          }
        }
        return undefined;
      };

      const name = await getText(Scraper.SELECTORS.name);
      if (!name) return false;

      const phone = await getTextWithFallbacks(Scraper.FALLBACK_SELECTORS.phone);
      const address = await getTextWithFallbacks(Scraper.FALLBACK_SELECTORS.address);
      const website = await getHrefWithFallbacks(Scraper.FALLBACK_SELECTORS.website);

      let email: string | undefined;
      if (website) {
        const extractor = new EmailExtractor(this.page);
        email = await extractor.extract(website);
      }

      const data: BusinessData = {
        id: url,
        name,
        phone,
        address,
        website,
        email
      };

      this.onUpdate([data]);
      return true;
    } catch (e) {
      log.debug(`Failed to process ${url}`, e);
      return false;
    }
  }
}
