import React from 'react';

interface WarningSystemProps {
  status: string;
  errorMessage?: string;
}

export const WarningSystem: React.FC<WarningSystemProps> = ({ status, errorMessage }) => {
  if (status !== 'error') return null;

  return (
    <div style={{ marginTop: 'var(--space-md)' }}>
      <div className="toast error" style={{
        position: 'relative',
        animation: 'fadeInUp var(--transition-normal)',
        width: '100%'
      }}>
        <span className="toast-icon">⚠️</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, marginBottom: 'var(--space-xs)' }}>
            Scraping Error Detected
          </div>
          {errorMessage && (
            <div style={{
              fontSize: 'var(--font-size-xs)',
              color: 'var(--text-secondary)',
              marginBottom: 'var(--space-sm)'
            }}>
              {errorMessage}
            </div>
          )}
          <div style={{
            fontSize: 'var(--font-size-xs)',
            color: 'var(--text-muted)'
          }}>
            <strong>Possible causes:</strong>
            <ul style={{
              margin: 'var(--space-xs) 0 0 0',
              paddingLeft: 'var(--space-md)',
              lineHeight: 1.6
            }}>
              <li>Network connection lost</li>
              <li>CAPTCHA detected (try slower speed)</li>
              <li>Rate limiting by the map service</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
