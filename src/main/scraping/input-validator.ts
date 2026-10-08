import { ScrapeConfig } from '../../common/types';

export class InputValidator {
  private static readonly MAX_KEYWORD_LENGTH = 100;
  private static readonly MAX_CITY_LENGTH = 100;
  private static readonly MAX_PROXIES = 50;
  // Allow alphanumeric, spaces, hyphens, apostrophes, periods, commas, and common international characters
  private static readonly SAFE_TEXT_PATTERN = /^[\p{L}\p{N}\s.,'-]+$/u;

  static validate(config: ScrapeConfig): string | null {
    if (!config.keyword || config.keyword.trim().length === 0) {
      return 'Keyword is required';
    }
    if (config.keyword.trim().length > InputValidator.MAX_KEYWORD_LENGTH) {
      return `Keyword must be ${InputValidator.MAX_KEYWORD_LENGTH} characters or less`;
    }
    if (!InputValidator.SAFE_TEXT_PATTERN.test(config.keyword.trim())) {
      return 'Keyword contains invalid characters';
    }

    if (!config.city || config.city.trim().length === 0) {
      return 'City is required';
    }
    if (config.city.trim().length > InputValidator.MAX_CITY_LENGTH) {
      return `City must be ${InputValidator.MAX_CITY_LENGTH} characters or less`;
    }
    if (!InputValidator.SAFE_TEXT_PATTERN.test(config.city.trim())) {
      return 'City contains invalid characters';
    }

    if (config.useProxy && config.proxies) {
      if (config.proxies.length > InputValidator.MAX_PROXIES) {
        return `Maximum ${InputValidator.MAX_PROXIES} proxies allowed`;
      }
      for (const proxy of config.proxies) {
        if (!InputValidator.validateProxy(proxy)) {
          return `Invalid proxy format: ${proxy.substring(0, 50)}`;
        }
      }
    }

    return null;
  }

  static validateProxy(proxy: string): boolean {
    if (!proxy || proxy.trim().length === 0) return false;
    // Match host:port or protocol://host:port (with optional auth)
    const proxyPattern = /^(https?:\/\/)?([\w.-]+(:[\w.-]+)?@)?[\w.-]+:\d{1,5}$/;
    return proxyPattern.test(proxy.trim());
  }

  static formatSearchQuery(config: ScrapeConfig): string {
    return `${config.keyword.trim()} in ${config.city.trim()}`;
  }
}
