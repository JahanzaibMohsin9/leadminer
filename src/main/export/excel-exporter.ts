import { BusinessData } from '../../common/types';
import { cleanText } from '../../common/utils';
import * as XLSX from 'xlsx';

export class ExcelExporter {
  export(data: BusinessData[]): Buffer {
    const worksheet = XLSX.utils.json_to_sheet(data.map(item => ({
      Name: cleanText(item.name),
      Phone: cleanText(item.phone),
      Email: cleanText(item.email),
      Website: cleanText(item.website),
      Address: cleanText(item.address)
    })));

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Leads');

    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  }
}
