import React, { useCallback, useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import { ControlPanel } from './components/ControlPanel';
import { ResultsTable } from './components/ResultsTable';
import { LicenseDialog } from './components/LicenseDialog';
import { BusinessData, ScrapeConfig, ScrapeStatus, LicenseValidationResult } from '../common/types';
import { cleanText } from '../common/utils';

const App: React.FC = () => {
  const [data, setData] = useState<BusinessData[]>([]);
  const [status, setStatus] = useState<ScrapeStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [isLicensed, setIsLicensed] = useState(false);
  const [showLicenseDialog, setShowLicenseDialog] = useState(false);

  useEffect(() => {
    if (!window.electron) return;

    // Check license status on mount
    window.electron.getLicenseStatus().then((licensed: boolean) => {
      setIsLicensed(licensed);
      if (!licensed) {
        setShowLicenseDialog(true);
      }
    });

    // Listen for updates from main process and capture cleanup functions
    const cleanupScrapeUpdate = window.electron.onScrapeUpdate((newData) => {
      setData((prev) => [...prev, ...newData]);
    });

    const cleanupStatusChange = window.electron.onStatusChange((newStatus, message) => {
      setStatus(newStatus);
      setErrorMessage(newStatus === 'error' ? message : undefined);
    });

    // Return cleanup function to remove listeners on unmount
    return () => {
      cleanupScrapeUpdate();
      cleanupStatusChange();
    };
  }, []);

  const handleStart = useCallback(async (config: ScrapeConfig) => {
    if (!isLicensed) {
      setShowLicenseDialog(true);
      return;
    }

    setData([]);
    if (window.electron) {
      const result = await window.electron.startScraping(config);
      if (!result.success && result.error) {
        alert(result.error);
      }
    }
  }, [isLicensed]);

  const handleStop = useCallback(async () => {
    if (window.electron) {
      await window.electron.stopScraping();
    }
  }, []);

  const handlePause = useCallback(async () => {
    if (window.electron) {
      await window.electron.pauseScraping();
    }
  }, []);

  const handleResume = useCallback(async () => {
    if (window.electron) {
      await window.electron.resumeScraping();
    }
  }, []);


  const handleExport = useCallback(() => {
    if (data.length === 0) return;

    // Convert to CSV with proper escaping
    const headers = ['Name', 'Phone', 'Email', 'Website', 'Address'];
    const csvContent = [
      headers.join(','),
      ...data.map(item => [
        `"${cleanText(item.name)}"`,
        `"${cleanText(item.phone || '')}"`,
        `"${cleanText(item.email || '')}"`,
        `"${cleanText(item.website || '')}"`,
        `"${cleanText(item.address || '')}"`
      ].join(','))
    ].join('\n');

    // Add UTF-8 BOM (Byte Order Mark) for proper encoding
    const csvWithBOM = '\uFEFF' + csvContent;

    // Trigger download
    const blob = new Blob([csvWithBOM], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `leads_${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [data]);

  const handleExportExcel = useCallback(() => {
    if (data.length === 0) return;

    // Create worksheet from data with cleaned text
    const worksheet = XLSX.utils.json_to_sheet(data.map(item => ({
      Name: cleanText(item.name),
      Phone: cleanText(item.phone || ''),
      Email: cleanText(item.email || ''),
      Website: cleanText(item.website || ''),
      Address: cleanText(item.address || '')
    })));

    // Create workbook and add worksheet
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Leads');

    // Generate .xlsx file and trigger download
    XLSX.writeFile(workbook, `leads_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }, [data]);

  const handleLicenseActivate = useCallback(async (key: string): Promise<LicenseValidationResult> => {
    if (!window.electron) return { valid: false, error: 'unknown_error', message: 'Application not ready' };

    const result = await window.electron.validateLicense(key);
    if (result.valid) {
      setIsLicensed(true);
      setShowLicenseDialog(false);
    }
    return result;
  }, []);

  return (
    <div className="app-container">
      {/* Premium Header */}
      <header className="app-header">
        <div className="app-logo">
          <div className="app-logo-icon">⛏️</div>
          <span className="app-logo-text">LeadMiner</span>
          {!isLicensed && (
            <span className="license-badge">
              🔒 Unlicensed
            </span>
          )}
          {isLicensed && (
            <span className="license-badge active">
              ✓ Pro
            </span>
          )}
        </div>
        <div className="flex items-center gap-md">
          <div className={`status-indicator ${status}`}>
            <span className="status-dot"></span>
            <span>{status.charAt(0).toUpperCase() + status.slice(1)}</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="app-content">
        <ControlPanel
          status={status}
          onStart={handleStart}
          onStop={handleStop}
          onPause={handlePause}
          onResume={handleResume}
          onExport={handleExport}
          onExportExcel={handleExportExcel}
          count={data.length}
          errorMessage={errorMessage}
        />

        <ResultsTable data={data} />
      </div>

      {/* Footer */}
      <footer className="app-footer">
        <span>LeadMiner Desktop v1.0.0</span>
        <span>© 2026 • All data stays on your computer</span>
      </footer>

      {showLicenseDialog && (
        <LicenseDialog
          onActivate={handleLicenseActivate}
          onClose={isLicensed ? () => setShowLicenseDialog(false) : undefined}
        />
      )}
    </div>
  );
};

export default App;
