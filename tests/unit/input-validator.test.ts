import { InputValidator } from '../../src/main/scraping/input-validator';
import { ScrapeConfig } from '../../src/common/types';

describe('InputValidator', () => {
  const validConfig: ScrapeConfig = {
    keyword: 'plumbers',
    city: 'New York',
    speed: 'normal',
  };

  test('should return null for valid config', () => {
    expect(InputValidator.validate(validConfig)).toBeNull();
  });

  test('should return error if keyword is missing', () => {
    const invalidConfig = { ...validConfig, keyword: '' };
    expect(InputValidator.validate(invalidConfig)).toBe('Keyword is required');
  });

  test('should return error if city is missing', () => {
    const invalidConfig = { ...validConfig, city: '   ' };
    expect(InputValidator.validate(invalidConfig)).toBe('City is required');
  });

  test('should return error if keyword exceeds max length', () => {
    const invalidConfig = { ...validConfig, keyword: 'a'.repeat(101) };
    expect(InputValidator.validate(invalidConfig)).toBe('Keyword must be 100 characters or less');
  });

  test('should return error if city exceeds max length', () => {
    const invalidConfig = { ...validConfig, city: 'a'.repeat(101) };
    expect(InputValidator.validate(invalidConfig)).toBe('City must be 100 characters or less');
  });

  test('should return error if keyword contains invalid characters', () => {
    const invalidConfig = { ...validConfig, keyword: 'plumbers <script>' };
    expect(InputValidator.validate(invalidConfig)).toBe('Keyword contains invalid characters');
  });

  test('should return error if city contains invalid characters', () => {
    const invalidConfig = { ...validConfig, city: 'New York; DROP TABLE' };
    expect(InputValidator.validate(invalidConfig)).toBe('City contains invalid characters');
  });

  test('should allow international characters', () => {
    const intlConfig = { ...validConfig, keyword: 'café', city: 'São Paulo' };
    expect(InputValidator.validate(intlConfig)).toBeNull();
  });

  test('should validate proxies when useProxy is true', () => {
    const proxyConfig: ScrapeConfig = {
      ...validConfig,
      useProxy: true,
      proxies: ['not-a-proxy'],
    };
    expect(InputValidator.validate(proxyConfig)).toContain('Invalid proxy format');
  });

  test('should accept valid proxy formats', () => {
    const proxyConfig: ScrapeConfig = {
      ...validConfig,
      useProxy: true,
      proxies: ['http://proxy.example.com:8080', '192.168.1.1:3128'],
    };
    expect(InputValidator.validate(proxyConfig)).toBeNull();
  });

  test('should reject too many proxies', () => {
    const proxyConfig: ScrapeConfig = {
      ...validConfig,
      useProxy: true,
      proxies: Array(51).fill('proxy.example.com:8080'),
    };
    expect(InputValidator.validate(proxyConfig)).toBe('Maximum 50 proxies allowed');
  });

  test('should format search query correctly', () => {
    expect(InputValidator.formatSearchQuery(validConfig)).toBe('plumbers in New York');
  });

  describe('validateProxy', () => {
    test('should validate host:port', () => {
      expect(InputValidator.validateProxy('proxy.example.com:8080')).toBe(true);
    });

    test('should validate protocol://host:port', () => {
      expect(InputValidator.validateProxy('http://proxy.example.com:8080')).toBe(true);
    });

    test('should validate proxy with auth', () => {
      expect(InputValidator.validateProxy('http://user:pass@proxy.com:8080')).toBe(true);
    });

    test('should reject empty string', () => {
      expect(InputValidator.validateProxy('')).toBe(false);
    });

    test('should reject invalid format', () => {
      expect(InputValidator.validateProxy('not-a-proxy')).toBe(false);
    });
  });
});
