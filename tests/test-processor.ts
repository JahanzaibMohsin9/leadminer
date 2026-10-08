import { DataProcessor } from '../src/main/processing/data-processor';
import { BusinessData } from '../src/common/types';

const processor = new DataProcessor();

const testData: BusinessData[] = [
  { id: '1', name: 'Biz A', phone: '(555) 123-4567', website: 'http://example.com' },
  { id: '2', name: 'Biz B', phone: '5551234567', website: 'https://www.example.com/about' }, // Duplicate phone & domain
  { id: '3', name: 'Biz C', phone: '123-456-7890', website: 'http://new.com' },
  { id: '4', name: 'Biz D', phone: '+1 (123) 456-7890', website: 'http://diff.com' }, // Duplicate phone
  { id: '5', name: 'Biz E', website: 'http://example.com' }, // Duplicate domain
];

console.log('--- Testing Data Processor ---');
const processed = processor.process(testData);

console.log('Processed Count:', processed.length);

processed.forEach(p => {
  console.log(`- ${p.name}: Phone=[${p.phone}] Domain=[${p.website}]`);
});

if (processed.length === 2) {
    // Expected: Biz A (unique), Biz C (unique).
    // Biz B: dup phone (of A) and domain (of A)
    // Biz D: dup phone (of C)
    // Biz E: dup domain (of A)
    console.log('SUCCESS: Deduplication logic working');
} else {
    console.log('FAILURE: Unexpected count');
}
