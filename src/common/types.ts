export interface ScrapeConfig {
  keyword: string;
  city: string;
  speed: 'slow' | 'normal' | 'fast';
  useProxy?: boolean;
  proxies?: string[];
}

export interface BusinessData {
  id: string;
  name: string;
  phone?: string;
  website?: string;
  address?: string;
  email?: string;
}

export type ScrapeStatus = 'idle' | 'running' | 'paused' | 'completed' | 'error';

export interface LicenseValidationResult {
  valid: boolean;
  tier?: string;
  expires_at?: string | null;
  error?: string;
  message?: string;
}

export interface IpcApi {
  startScraping: (config: ScrapeConfig) => Promise<{ success: boolean; error?: string }>;
  stopScraping: () => Promise<void>;
  pauseScraping: () => Promise<void>;
  resumeScraping: () => Promise<void>;
  validateLicense: (key: string) => Promise<LicenseValidationResult>;
  getLicenseStatus: () => Promise<boolean>;
  getHardwareId: () => Promise<string>;
  onScrapeUpdate: (callback: (data: BusinessData[]) => void) => () => void;
  onStatusChange: (callback: (status: ScrapeStatus, message?: string) => void) => () => void;
}
