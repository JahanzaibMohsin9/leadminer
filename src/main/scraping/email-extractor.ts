import { Page } from 'playwright';
import log from 'electron-log';

export class EmailExtractor {
  private static readonly EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  // Common file extensions that might be mistaken for emails in source code or filenames
  private static readonly IGNORED_EXTENSIONS = [
    '.png', '.jpg', '.jpeg', '.gif', '.css', '.js', '.ico', '.svg', 
    '.woff', '.woff2', '.ttf', '.eot', '.mp4', '.webp'
  ];

  constructor(private page: Page) {}

  async extract(url: string): Promise<string | undefined> {
    try {
      log.debug(`Visiting ${url} for email extraction...`);
      // Ensure protocol
      const targetUrl = url.startsWith('http') ? url : `http://${url}`;

      // Set a short timeout for loading - we don't need the full page to be interactive
      await this.page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
      
      // 1. Check homepage
      let email = await this.findEmailOnPage();
      if (email) return email;

      // 2. Look for Contact/About pages if no email found
      const contactUrl = await this.findContactLink();
      if (contactUrl) {
        log.debug(`Visiting contact page: ${contactUrl}`);
        await this.page.goto(contactUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });
        email = await this.findEmailOnPage();
        if (email) return email;
      }

      return undefined;
    } catch (error) {
      log.debug(`Email extraction skipped for ${url}: ${(error as Error).message}`);
      return undefined;
    }
  }

  private async findEmailOnPage(): Promise<string | undefined> {
    try {
        // Method 1: Check for mailto links first (highest confidence)
        // We use $$eval to check all mailto links and find a valid one
        const mailtoEmail = await this.page.$$eval('a[href^="mailto:"]', (elements: HTMLAnchorElement[]) => {
            for (const el of elements) {
                const href = el.getAttribute('href');
                if (href) {
                    const match = href.replace('mailto:', '').split('?')[0];
                    if (match) return match;
                }
            }
            return null;
        });

        if (mailtoEmail && this.isValidEmail(mailtoEmail)) {
            return mailtoEmail;
        }

        // Method 2: Regex scan of the body text
        const content = await this.page.content();
        const matches = content.match(EmailExtractor.EMAIL_REGEX);
        
        if (matches) {
            // Find the first valid email that isn't a false positive
            const valid = matches.find((m: string) => this.isValidEmail(m));
            if (valid) return valid;
        }
    } catch (e) {
        log.debug('Error scanning page content:', e);
    }
    return undefined;
  }

  private async findContactLink(): Promise<string | undefined> {
    try {
        // Look for common keywords in links
        const keywords = [/contact/i, /about/i, /get in touch/i];
        
        for (const regex of keywords) {
            // We use getByRole to find accessible links
            const link = this.page.getByRole('link', { name: regex }).first();
            
            // Check if exists and is visible
            if (await link.count() > 0 && await link.isVisible()) {
                const href = await link.getAttribute('href');
                if (href) {
                    return new URL(href, this.page.url()).toString();
                }
            }
        }
    } catch (e) {
        // Ignore navigation/selector errors
    }
    return undefined;
  }

  private isValidEmail(email: string): boolean {
    if (!email) return false;
    const lower = email.toLowerCase();
    
    // Filter out common false positives
    if (EmailExtractor.IGNORED_EXTENSIONS.some(ext => lower.endsWith(ext))) return false;
    
    // Filter out generic placeholders
    if (lower.includes('domain.com') || lower.includes('email.com') || lower.includes('example.com')) return false;
    
    return true;
  }
}
