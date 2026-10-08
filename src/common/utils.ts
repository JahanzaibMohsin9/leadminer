/**
 * Clean text by removing problematic Unicode characters that cause encoding issues.
 * Shared between renderer exports and main-process scraper.
 */
export function cleanText(text: string | undefined | null): string {
  if (!text) return '';
  return text
    .replace(/[\u0080-\u009F]/g, '')       // Control characters
    .replace(/[\u200B-\u200D\uFEFF]/g, '') // Zero-width spaces
    .replace(/[\u2000-\u206F]/g, '')        // General punctuation
    .replace(/[\uE000-\uF8FF]/g, '')        // Private use area (icons)
    .replace(/[\uD800-\uDFFF]/g, '')        // Surrogates
    .replace(/îƒˆ/g, '')                    // Specific corruption
    .replace(/\s+/g, ' ')
    .trim();
}
