import { BusinessData } from '../../common/types';
import { cleanText } from '../../common/utils';

export class CsvExporter {
  export(data: BusinessData[]): string {
    if (data.length === 0) {
      return '';
    }

    const headers = ['Name', 'Phone', 'Email', 'Website', 'Address'];
    const rows = data.map(item => [
      this.escapeCsv(cleanText(item.name)),
      this.escapeCsv(cleanText(item.phone)),
      this.escapeCsv(cleanText(item.email)),
      this.escapeCsv(cleanText(item.website)),
      this.escapeCsv(cleanText(item.address))
    ]);

    return [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');
  }

  /**
   * Export data with UTF-8 BOM to ensure proper encoding in Excel and other readers
   */
  exportWithBOM(data: BusinessData[]): string {
    const csv = this.export(data);
    // Add UTF-8 BOM (Byte Order Mark) to ensure proper character encoding
    return '\uFEFF' + csv;
  }

  private escapeCsv(field: string): string {
    if (field.includes(',') || field.includes('"') || field.includes('\n')) {
      return `"${field.replace(/"/g, '""')}"`;
    }
    return field;
  }
}
