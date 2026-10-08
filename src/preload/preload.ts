import { contextBridge, ipcRenderer } from 'electron';
import { ScrapeConfig, BusinessData, ScrapeStatus } from '../common/types';

contextBridge.exposeInMainWorld('electron', {
  startScraping: (config: ScrapeConfig) => ipcRenderer.invoke('start-scraping', config),
  stopScraping: () => ipcRenderer.invoke('stop-scraping'),
  pauseScraping: () => ipcRenderer.invoke('pause-scraping'),
  resumeScraping: () => ipcRenderer.invoke('resume-scraping'),
  validateLicense: (key: string) => ipcRenderer.invoke('validate-license', key),
  getLicenseStatus: () => ipcRenderer.invoke('get-license-status'),
  getHardwareId: () => ipcRenderer.invoke('get-hardware-id'),
  onScrapeUpdate: (callback: (data: BusinessData[]) => void) => {
    const handler = (_event: any, data: BusinessData[]) => callback(data);
    ipcRenderer.on('scrape-update', handler);
    return () => ipcRenderer.removeListener('scrape-update', handler);
  },
  onStatusChange: (callback: (status: ScrapeStatus, message?: string) => void) => {
    const handler = (_event: any, status: ScrapeStatus, message?: string) => callback(status, message);
    ipcRenderer.on('status-change', handler);
    return () => ipcRenderer.removeListener('status-change', handler);
  },
});
