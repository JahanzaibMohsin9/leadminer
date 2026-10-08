import React from 'react';

interface ProgressBarProps {
  status: 'idle' | 'running' | 'paused' | 'completed' | 'error';
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ status }) => {
  if (status === 'idle') return null;

  const getStatusInfo = () => {
    switch (status) {
      case 'running':
        return { text: 'Mining leads...', color: 'var(--accent-primary)' };
      case 'paused':
        return { text: 'Paused', color: 'var(--accent-amber)' };
      case 'completed':
        return { text: 'Completed!', color: 'var(--accent-green)' };
      case 'error':
        return { text: 'Error occurred', color: 'var(--accent-red)' };
      default:
        return { text: '', color: 'var(--text-muted)' };
    }
  };

  const { text, color } = getStatusInfo();

  return (
    <div className="progress-container">
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 'var(--space-sm)'
      }}>
        <span style={{
          fontSize: 'var(--font-size-xs)',
          color: 'var(--text-secondary)',
          fontWeight: 500
        }}>
          {text}
        </span>
        {status === 'running' && (
          <span style={{
            fontSize: 'var(--font-size-xs)',
            color: 'var(--accent-primary)',
            animation: 'pulse 1.5s infinite'
          }}>
            ⚡ Active
          </span>
        )}
      </div>

      <div className="progress-bar">
        {status === 'running' && (
          <div
            className="progress-fill animated"
            style={{ width: '100%' }}
          />
        )}
        {status === 'paused' && (
          <div
            className="progress-fill"
            style={{
              width: '60%',
              background: 'var(--gradient-warning)'
            }}
          />
        )}
        {status === 'completed' && (
          <div
            className="progress-fill"
            style={{
              width: '100%',
              background: 'var(--gradient-success)'
            }}
          />
        )}
        {status === 'error' && (
          <div
            className="progress-fill"
            style={{
              width: '100%',
              background: 'var(--gradient-danger)'
            }}
          />
        )}
      </div>
    </div>
  );
};
