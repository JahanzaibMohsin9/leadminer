use thiserror::Error;

#[derive(Error, Debug)]
pub enum NativeError {
    #[error("Job error: {0}")]
    JobError(String),

    #[error("Job not found: {0}")]
    JobNotFound(String),

    #[error("Invalid job state transition from {from:?} to {to:?}")]
    InvalidStateTransition { from: String, to: String },

    #[error("Rate limit exceeded")]
    RateLimitExceeded,

    #[error("License validation failed: {0}")]
    LicenseValidationFailed(String),

    #[error("Invalid license key")]
    InvalidLicenseKey,

    #[error("License expired")]
    LicenseExpired,

    #[error("Hardware mismatch")]
    HardwareMismatch,

    #[error("Audit log error: {0}")]
    AuditLogError(String),

    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),

    #[error("Serialization error: {0}")]
    SerializationError(#[from] serde_json::Error),

    #[error("Cryptography error: {0}")]
    CryptoError(String),

    #[error("System error: {0}")]
    SystemError(String),

    #[error("Configuration error: {0}")]
    ConfigError(String),
}

pub type Result<T> = std::result::Result<T, NativeError>;

impl From<NativeError> for napi::Error {
    fn from(err: NativeError) -> Self {
        napi::Error::from_reason(err.to_string())
    }
}
