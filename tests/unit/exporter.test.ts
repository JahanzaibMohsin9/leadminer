import { CsvExporter } from '../../src/main/export/csv-exporter';
import { ExcelExporter } from '../../src/main/export/excel-exporter';
import { BusinessData } from '../../src/common/types';
import * as XLSX from 'xlsx';

describe('Exporter', () => {
  const testData: BusinessData[] = [
    {
      id: '1',
      name: 'Test Business',
      phone: '(555) 123-4567',
      email: 'test@example.com',
      website: 'https://example.com',
      address: '123 Main St'
    },
    {
      id: '2',
      name: 'Comma, Business',
      phone: '',
      address: 'Line 1\nLine 2'
    }
  ];

  describe('CsvExporter', () => {
    const exporter = new CsvExporter();

    test('should export data to CSV format', () => {
      const csv = exporter.export(testData);
      
      const expectedHeader = 'Name,Phone,Email,Website,Address';
      const expectedRow1 = 'Test Business,(555) 123-4567,test@example.com,https://example.com,123 Main St';
      const expectedRow2 = '"Comma, Business",,,,Line 1 Line 2';

      expect(csv).toContain(expectedHeader);
      expect(csv).toContain(expectedRow1);
      expect(csv).toContain(expectedRow2);
    });

    test('should handle empty data', () => {
      const csv = exporter.export([]);
      expect(csv).toBe('');
    });
  });

  describe('ExcelExporter', () => {
    const exporter = new ExcelExporter();

    test('should export data to Excel buffer', () => {
      const buffer = exporter.export(testData);
      expect(buffer).toBeInstanceOf(Buffer);

      // Verify content by reading it back
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const sheet = workbook.Sheets['Leads'];
      const data = XLSX.utils.sheet_to_json(sheet);

      expect(data).toHaveLength(2);
      expect(data[0]).toMatchObject({
        Name: 'Test Business',
        Phone: '(555) 123-4567'
      });
    });
  });
});
