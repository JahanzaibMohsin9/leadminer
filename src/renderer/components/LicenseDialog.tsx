import React, { useState, useEffect } from 'react';
import { LicenseValidationResult } from '../../common/types';

interface LicenseDialogProps {
    onActivate: (key: string) => Promise<LicenseValidationResult>;
    onClose?: () => void;
}

export const LicenseDialog: React.FC<LicenseDialogProps> = ({ onActivate, onClose }) => {
    const [licenseKey, setLicenseKey] = useState('');
    const [isActivating, setIsActivating] = useState(false);
    const [error, setError] = useState('');
    const [hardwareId, setHardwareId] = useState('');
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (window.electron?.getHardwareId) {
            window.electron.getHardwareId().then(setHardwareId);
        }
    }, []);

    const getErrorMessage = (result: LicenseValidationResult): string => {
        switch (result.error) {
            case 'expired':
                return 'This license key has expired. Please contact support for renewal.';
            case 'wrong_device':
                return 'This license key is registered to a different device. Please contact support with your Device ID for a reissue.';
            case 'invalid_signature':
                return 'Invalid license key. The key could not be verified.';
            case 'invalid_key':
            case 'malformed_key':
                return 'Invalid license key format. Please check and try again.';
            default:
                return result.message || 'Invalid license key. Please check and try again.';
        }
    };

    const handleActivate = async () => {
        if (!licenseKey.trim()) {
            setError('Please enter a license key');
            return;
        }

        setIsActivating(true);
        setError('');

        try {
            const result = await onActivate(licenseKey.trim());
            if (!result.valid) {
                setError(getErrorMessage(result));
            }
        } catch (err) {
            setError('Failed to validate license. Please try again.');
        } finally {
            setIsActivating(false);
        }
    };

    const handleCopyDeviceId = () => {
        navigator.clipboard.writeText(hardwareId).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content" style={{ maxWidth: '480px' }}>
                {/* Header */}
                <div className="modal-header">
                    <h2 className="modal-title">🔐 Activate LeadMiner</h2>
                    {onClose && (
                        <button className="modal-close" onClick={onClose} disabled={isActivating}>
                            ✕
                        </button>
                    )}
                </div>

                {/* Body */}
                <div className="modal-body">
                    <p style={{
                        color: 'var(--text-secondary)',
                        marginBottom: 'var(--space-lg)',
                        fontSize: 'var(--font-size-sm)'
                    }}>
                        Enter your license key to unlock all features of LeadMiner Desktop.
                    </p>

                    <div className="form-group" style={{ marginBottom: 'var(--space-md)' }}>
                        <label className="form-label">License Key</label>
                        <input
                            type="password"
                            className="form-input"
                            value={licenseKey}
                            onChange={(e) => setLicenseKey(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && handleActivate()}
                            placeholder="LM-XXXX-XXXX-XXXX-XXXX"
                            disabled={isActivating}
                            aria-label="License key"
                            style={{ fontFamily: 'monospace', letterSpacing: '1px' }}
                        />
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="toast error" style={{
                            position: 'relative',
                            marginBottom: 'var(--space-md)',
                            animation: 'none'
                        }}>
                            <span className="toast-icon">⚠️</span>
                            <span className="toast-message">{error}</span>
                        </div>
                    )}

                    {/* Info Box */}
                    <div style={{
                        padding: 'var(--space-md)',
                        background: 'var(--bg-tertiary)',
                        borderRadius: 'var(--radius-md)',
                        border: 'var(--border-subtle)'
                    }}>
                        <p style={{
                            margin: 0,
                            fontSize: 'var(--font-size-xs)',
                            color: 'var(--text-muted)'
                        }}>
                            <strong style={{ color: 'var(--text-secondary)' }}>Format:</strong> LM-XXXX-XXXX-XXXX-XXXX
                        </p>
                        <p style={{
                            margin: 'var(--space-xs) 0 0 0',
                            fontSize: 'var(--font-size-xs)',
                            color: 'var(--text-muted)'
                        }}>
                            Don't have a license key? Visit <span style={{ color: 'var(--accent-blue)' }}>leadminer.com</span>
                        </p>
                    </div>

                    {/* Device ID Section */}
                    {hardwareId && (
                        <div style={{
                            marginTop: 'var(--space-md)',
                            padding: 'var(--space-md)',
                            background: 'var(--bg-tertiary)',
                            borderRadius: 'var(--radius-md)',
                            border: 'var(--border-subtle)'
                        }}>
                            <p style={{
                                margin: '0 0 var(--space-xs) 0',
                                fontSize: 'var(--font-size-xs)',
                                color: 'var(--text-secondary)',
                                fontWeight: 600
                            }}>
                                🖥️ Your Device ID
                            </p>
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 'var(--space-sm)',
                            }}>
                                <code style={{
                                    flex: 1,
                                    fontSize: 'var(--font-size-xs)',
                                    color: 'var(--text-muted)',
                                    fontFamily: 'monospace',
                                    wordBreak: 'break-all',
                                    userSelect: 'all',
                                }}>
                                    {hardwareId}
                                </code>
                                <button
                                    type="button"
                                    className="btn btn-ghost"
                                    onClick={handleCopyDeviceId}
                                    style={{ fontSize: 'var(--font-size-xs)', padding: '4px 8px', whiteSpace: 'nowrap' }}
                                >
                                    {copied ? '✓ Copied' : '📋 Copy'}
                                </button>
                            </div>
                            <p style={{
                                margin: 'var(--space-xs) 0 0 0',
                                fontSize: '10px',
                                color: 'var(--text-muted)'
                            }}>
                                Send this ID when requesting a license key.
                            </p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="modal-footer">
                    {onClose && (
                        <button
                            className="btn btn-ghost"
                            onClick={onClose}
                            disabled={isActivating}
                        >
                            Cancel
                        </button>
                    )}
                    <button
                        className="btn btn-primary"
                        onClick={handleActivate}
                        disabled={isActivating}
                    >
                        {isActivating ? (
                            <>
                                <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⏳</span>
                                Validating...
                            </>
                        ) : (
                            <>✓ Activate</>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};
