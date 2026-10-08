import { BusinessData } from '../../common/types';
import log from 'electron-log';

export class DataProcessor {
  private seenPhones = new Set<string>();
  private seenDomains = new Set<string>();

  reset() {
    this.seenPhones.clear();
    this.seenDomains.clear();
  }

  process(batch: BusinessData[]): BusinessData[] {
    const processed: BusinessData[] = [];

    for (const item of batch) {
      // 1. Normalize Phone
      if (item.phone) {
        item.phone = this.normalizePhone(item.phone);
      }

      // 2. Deduplicate
      if (this.isDuplicate(item)) {
        log.debug(`Duplicate skipped: ${item.name} (${item.phone || 'no phone'}, ${item.website || 'no web'})`);
        continue;
      }

      // 3. Mark/Track for future deduplication
      if (item.phone) this.seenPhones.add(item.phone);
      if (item.website) {
        const domain = this.extractDomain(item.website);
        if (domain) this.seenDomains.add(domain);
      }

      // 4. Mark missing fields (ensure consistent output)
      // We'll keep them as undefined in the type, but ensure they are handled
      // if we were exporting to CSV, we'd handle it there.
      // For now, let's just ensure the object is clean.
      
      processed.push(item);
    }

    return processed;
  }

  private normalizePhone(phone: string): string {
    // Remove all non-numeric characters
    const digits = phone.replace(/\D/g, '');
    
    // Simple US formatting (10 digits)
    if (digits.length === 10) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
    // US with country code 1
    if (digits.length === 11 && digits.startsWith('1')) {
      return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
    }

    // Return original if pattern doesn't match or clean digits?
    // Let's return the cleaned version if it looks like a phone number, 
    // otherwise keep original (some international might be different)
    return digits.length > 0 ? digits : phone;
  }

  private isDuplicate(item: BusinessData): boolean {
    // Check Phone
    if (item.phone && this.seenPhones.has(item.phone)) {
      return true;
    }

    // Check Domain
    if (item.website) {
      const domain = this.extractDomain(item.website);
      if (domain && this.seenDomains.has(domain)) {
        return true;
      }
    }

    return false;
  }

  private extractDomain(url: string): string | null {
    try {
      // Handle cases where url might not have protocol
      const safeUrl = url.startsWith('http') ? url : `http://${url}`;
      const hostname = new URL(safeUrl).hostname;
      return hostname.replace(/^www\./, '');
    } catch {
      return null;
    }
  }
}
