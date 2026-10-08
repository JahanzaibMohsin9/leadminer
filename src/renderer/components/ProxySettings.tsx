import React from 'react';

interface ProxySettingsProps {
  useProxy: boolean;
  onUseProxyChange: (checked: boolean) => void;
  proxies: string;
  onProxiesChange: (proxies: string) => void;
  disabled: boolean;
}

export const ProxySettings: React.FC<ProxySettingsProps> = ({
  useProxy,
  onUseProxyChange,
  proxies,
  onProxiesChange,
  disabled
}) => {
  return (
    <div style={{
      marginTop: 'var(--space-lg)',
      paddingTop: 'var(--space-lg)',
      borderTop: 'var(--border-subtle)'
    }}>
      <label className="proxy-toggle">
        <input
          type="checkbox"
          checked={useProxy}
          onChange={(e) => onUseProxyChange(e.target.checked)}
          disabled={disabled}
        />
        <span style={{
          fontSize: 'var(--font-size-sm)',
          color: 'var(--text-secondary)',
          fontWeight: 500
        }}>
          🛡️ Use Proxy (Recommended for high volume)
        </span>
      </label>

      {useProxy && (
        <div style={{
          marginTop: 'var(--space-md)',
          marginLeft: 'calc(44px + var(--space-sm))',
          animation: 'fadeIn var(--transition-fast)'
        }}>
          <p style={{
            fontSize: 'var(--font-size-xs)',
            color: 'var(--text-muted)',
            marginBottom: 'var(--space-sm)'
          }}>
            Enter proxies (one per line) • Format: <code style={{
              background: 'var(--bg-tertiary)',
              padding: '2px 6px',
              borderRadius: 'var(--radius-sm)',
              fontFamily: 'monospace',
              fontSize: 'var(--font-size-xs)'
            }}>http://user:pass@host:port</code>
          </p>
          <textarea
            className="proxy-textarea"
            value={proxies}
            onChange={(e) => onProxiesChange(e.target.value)}
            disabled={disabled}
            placeholder="http://1.2.3.4:8080&#10;http://5.6.7.8:3128"
            style={{ fontFamily: 'monospace' }}
          />
        </div>
      )}
    </div>
  );
};
