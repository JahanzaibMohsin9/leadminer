import { Page } from 'playwright';

// Configuration: Base URL for business search
// Note: This can be made user-configurable in future versions
const SEARCH_BASE_URL = process.env.SEARCH_BASE_URL || 'https://www.google.com/maps/search/';

export class Navigator {
  constructor(private page: Page) { }

  async navigateToSearch(query: string) {
    // Construct search URL for map-based business listings
    const url = `${SEARCH_BASE_URL}${encodeURIComponent(query)}`;
    await this.page.goto(url, { waitUntil: 'domcontentloaded' }); // faster than networkidle

    // Wait for the main content to load
    // Handle consent dialogs if present
    await this.handleConsent();
  }

  private async handleConsent() {
    try {
      // Common selectors for map service consent dialogs
      // This is heuristic and might need updates
      const selectors = [
        'button[aria-label="Accept all"]',
        'button:has-text("Accept all")',
        'form[action*="consent"] button'
      ];

      for (const selector of selectors) {
        if (await this.page.isVisible(selector, { timeout: 2000 })) {
          await this.page.click(selector);
          await this.page.waitForLoadState('domcontentloaded');
          return;
        }
      }
    } catch (e) {
      // Consent dialog not found or already accepted
    }
  }
}
