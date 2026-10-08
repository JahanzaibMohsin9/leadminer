import React from 'react';

export const HelpContent: React.FC = () => {
    const [show, setShow] = React.useState(false);

    if (!show) {
        return (
            <button
                onClick={() => setShow(true)}
                className="btn btn-ghost"
                style={{ marginTop: 'var(--space-md)', alignSelf: 'flex-start' }}
            >
                ❓ Need Help?
            </button>
        );
    }

    return (
        <div style={{
            marginTop: 'var(--space-md)',
            padding: 'var(--space-md)',
            background: 'var(--bg-tertiary)',
            borderRadius: 'var(--radius-md)',
            border: 'var(--border-subtle)',
            animation: 'fadeIn var(--transition-fast)'
        }}>
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 'var(--space-sm)'
            }}>
                <strong style={{
                    fontSize: 'var(--font-size-sm)',
                    color: 'var(--text-primary)'
                }}>
                    💡 Troubleshooting Tips
                </strong>
                <button
                    onClick={() => setShow(false)}
                    className="modal-close"
                    style={{ width: '24px', height: '24px', fontSize: '12px' }}
                >
                    ✕
                </button>
            </div>
            <ul style={{
                fontSize: 'var(--font-size-xs)',
                color: 'var(--text-secondary)',
                paddingLeft: 'var(--space-md)',
                margin: 0,
                lineHeight: 1.8
            }}>
                <li>
                    <strong style={{ color: 'var(--accent-amber)' }}>CAPTCHA detected:</strong>
                    {' '}Stop the scraper, wait a few minutes, or switch to a slower speed.
                </li>
                <li>
                    <strong style={{ color: 'var(--accent-blue)' }}>No results:</strong>
                    {' '}Try a broader keyword or a larger city.
                </li>
                <li>
                    <strong style={{ color: 'var(--accent-red)' }}>Network errors:</strong>
                    {' '}Check your internet connection or proxy settings.
                </li>
                <li>
                    <strong style={{ color: 'var(--accent-purple)' }}>Rate limiting:</strong>
                    {' '}Use proxies or reduce scraping speed.
                </li>
            </ul>
        </div>
    );
};
