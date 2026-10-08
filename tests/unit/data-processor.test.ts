import { DataProcessor } from '../../src/main/processing/data-processor';
import { BusinessData } from '../../src/common/types';

describe('DataProcessor', () => {
  let processor: DataProcessor;

  beforeEach(() => {
    processor = new DataProcessor();
  });

  test('should normalize US phone numbers', () => {
    const data: BusinessData[] = [{
      id: '1',
      name: 'Test Business',
      phone: '1 (555) 123-4567',
    }];
    const processed = processor.process(data);
    expect(processed[0].phone).toBe('(555) 123-4567');
  });

  test('should normalize 10-digit phone numbers', () => {
    const data: BusinessData[] = [{
      id: '1',
      name: 'Test Business',
      phone: '5551234567',
    }];
    const processed = processor.process(data);
    expect(processed[0].phone).toBe('(555) 123-4567');
  });

  test('should deduplicate by phone number', () => {
    const data: BusinessData[] = [
      { id: '1', name: 'Business 1', phone: '555-123-4567' },
      { id: '2', name: 'Business 2', phone: '5551234567' }, // Same phone after normalization
    ];
    const processed = processor.process(data);
    expect(processed).toHaveLength(1);
    expect(processed[0].id).toBe('1');
  });

  test('should deduplicate by domain', () => {
    const data: BusinessData[] = [
      { id: '1', name: 'Business 1', website: 'https://www.example.com' },
      { id: '2', name: 'Business 2', website: 'http://example.com/contact' }, // Same domain
    ];
    const processed = processor.process(data);
    expect(processed).toHaveLength(1);
    expect(processed[0].id).toBe('1');
  });

  test('should handle invalid URLs gracefully', () => {
    const data: BusinessData[] = [
      { id: '1', name: 'Business 1', website: 'not-a-url' },
    ];
    const processed = processor.process(data);
    expect(processed).toHaveLength(1);
  });

  test('should reset state', () => {
    const data1: BusinessData[] = [{ id: '1', name: 'Business 1', phone: '555-123-4567' }];
    processor.process(data1);

    processor.reset();

    const data2: BusinessData[] = [{ id: '2', name: 'Business 2', phone: '555-123-4567' }];
    const processed = processor.process(data2);
    expect(processed).toHaveLength(1); // Should be accepted after reset
  });
});
