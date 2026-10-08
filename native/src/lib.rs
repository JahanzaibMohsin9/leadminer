mod error;
mod types;
mod job_queue;
mod job_manager;
mod rate_limiter;
mod license_validator;
mod security;
mod audit_logger;

use napi_derive::napi;
use parking_lot::Mutex;
use std::sync::Arc;

use error::NativeError;
use types::*;
use job_manager::{JobManager, JobManagerConfig, JobEvent};
use rate_limiter::{RateLimiter, DomainRateLimiter};
use license_validator::{LicenseManager, LicenseInfo};
use audit_logger::{AuditLogger, AuditConfig, LogStats};

/// NAPI wrapper for JobManager
#[napi]
pub struct NativeJobManager {
    inner: Arc<Mutex<JobManager>>,
}

#[napi]
impl NativeJobManager {
    #[napi(constructor)]
    pub fn new(max_concurrent: u32) -> Self {
        let config = JobManagerConfig {
            max_concurrent_jobs: max_concurrent as usize,
        };
        Self {
            inner: Arc::new(Mutex::new(JobManager::new(config))),
        }
    }

    #[napi]
    pub fn submit_job(&self, priority: u32, keyword: String, city: String, max_results: Option<u32>, speed: String) -> napi::Result<String> {
        let metadata = JobMetadata {
            keyword,
            city,
            max_results,
            speed,
        };
        
        self.inner
            .lock()
            .submit_job(priority as u8, metadata)
            .map_err(|e| napi::Error::from(e))
    }

    #[napi]
    pub fn start_next_job(&self) -> Option<String> {
        self.inner.lock().start_next_job().map(|job| job.id)
    }

    #[napi]
    pub fn get_job_status(&self, job_id: String) -> Option<String> {
        self.inner
            .lock()
            .get_job_status(&job_id)
            .map(|state| format!("{:?}", state))
    }

    #[napi]
    pub fn update_progress(&self, job_id: String, progress: f64) -> napi::Result<()> {
        self.inner
            .lock()
            .update_progress(&job_id, progress as f32)
            .map_err(|e| napi::Error::from(e))
    }

    #[napi]
    pub fn complete_job(&self, job_id: String) -> napi::Result<()> {
        self.inner
            .lock()
            .complete_job(&job_id)
            .map_err(|e| napi::Error::from(e))
    }

    #[napi]
    pub fn fail_job(&self, job_id: String, error_message: String) -> napi::Result<()> {
        self.inner
            .lock()
            .fail_job(&job_id, error_message)
            .map_err(|e| napi::Error::from(e))
    }

    #[napi]
    pub fn pause_job(&self, job_id: String) -> napi::Result<()> {
        self.inner
            .lock()
            .pause_job(&job_id)
            .map_err(|e| napi::Error::from(e))
    }

    #[napi]
    pub fn resume_job(&self, job_id: String) -> napi::Result<()> {
        self.inner
            .lock()
            .resume_job(&job_id)
            .map_err(|e| napi::Error::from(e))
    }

    #[napi]
    pub fn cancel_job(&self, job_id: String) -> napi::Result<()> {
        self.inner
            .lock()
            .cancel_job(&job_id)
            .map_err(|e| napi::Error::from(e))
    }

    #[napi]
    pub fn get_stats(&self) -> napi::Result<String> {
        let stats = self.inner.lock().get_stats();
        serde_json::to_string(&serde_json::json!({
            "queued": stats.queued,
            "running": stats.running,
            "paused": stats.paused,
            "active_total": stats.active_total,
            "max_concurrent": stats.max_concurrent,
        }))
        .map_err(|e| napi::Error::from_reason(e.to_string()))
    }
}

/// NAPI wrapper for RateLimiter
#[napi]
pub struct NativeRateLimiter {
    inner: Arc<Mutex<DomainRateLimiter>>,
}

#[napi]
impl NativeRateLimiter {
    #[napi(constructor)]
    pub fn new(algorithm: String, capacity: u32, refill_rate: f64) -> Self {
        let algo = match algorithm.as_str() {
            "token_bucket" => RateLimitAlgorithm::TokenBucket,
            "leaky_bucket" => RateLimitAlgorithm::LeakyBucket,
            "adaptive" => RateLimitAlgorithm::Adaptive,
            _ => RateLimitAlgorithm::TokenBucket,
        };

        let config = RateLimitConfig {
            algorithm: algo,
            capacity,
            refill_rate,
            burst_size: None,
        };

        Self {
            inner: Arc::new(Mutex::new(DomainRateLimiter::new(config))),
        }
    }

    #[napi]
    pub fn can_proceed(&self, domain: Option<String>) -> bool {
        let domain = domain.unwrap_or_else(|| "default".to_string());
        self.inner.lock().can_proceed(&domain)
    }

    #[napi]
    pub fn wait_time(&self, domain: Option<String>) -> u32 {
        let domain = domain.unwrap_or_else(|| "default".to_string());
        self.inner.lock().wait_time(&domain).as_millis() as u32
    }

    #[napi]
    pub fn record_success(&self, domain: Option<String>) {
        let domain = domain.unwrap_or_else(|| "default".to_string());
        self.inner.lock().record_success(&domain);
    }

    #[napi]
    pub fn record_failure(&self, domain: Option<String>) {
        let domain = domain.unwrap_or_else(|| "default".to_string());
        self.inner.lock().record_failure(&domain);
    }
}

/// NAPI wrapper for LicenseManager
#[napi]
pub struct NativeLicenseManager {
    inner: Arc<Mutex<LicenseManager>>,
}

#[napi]
impl NativeLicenseManager {
    #[napi(constructor)]
    pub fn new() -> napi::Result<Self> {
        LicenseManager::new()
            .map(|manager| Self {
                inner: Arc::new(Mutex::new(manager)),
            })
            .map_err(|e| napi::Error::from(e))
    }

    #[napi]
    pub fn activate_license(&self, license_key: String) -> napi::Result<()> {
        self.inner
            .lock()
            .activate_license(&license_key)
            .map_err(|e| napi::Error::from(e))
    }

    #[napi]
    pub fn deactivate_license(&self) {
        self.inner.lock().deactivate_license();
    }

    #[napi]
    pub fn is_licensed(&self) -> bool {
        self.inner.lock().is_licensed()
    }

    #[napi]
    pub fn get_tier(&self) -> Option<String> {
        self.inner
            .lock()
            .get_tier()
            .map(|tier| format!("{:?}", tier))
    }

    #[napi]
    pub fn get_hardware_fingerprint(&self) -> String {
        self.inner.lock().get_hardware_fingerprint()
    }

    #[napi]
    pub fn get_license_info(&self) -> Option<String> {
        self.inner
            .lock()
            .get_license_info()
            .and_then(|info| serde_json::to_string(&serde_json::json!({
                "tier": format!("{:?}", info.tier),
                "issued_at": info.issued_at.to_rfc3339(),
                "expires_at": info.expires_at.map(|d| d.to_rfc3339()),
                "days_remaining": info.days_remaining,
            })).ok())
    }
}

/// NAPI wrapper for AuditLogger
#[napi]
pub struct NativeAuditLogger {
    inner: Arc<Mutex<AuditLogger>>,
}

#[napi]
impl NativeAuditLogger {
    #[napi(constructor)]
    pub fn new(log_dir: String, max_file_size: Option<u32>, retention_days: Option<u32>) -> napi::Result<Self> {
        let config = AuditConfig {
            log_dir: log_dir.into(),
            max_file_size: max_file_size.unwrap_or(10 * 1024 * 1024) as u64,
            retention_days: retention_days.unwrap_or(30),
        };

        AuditLogger::new(config)
            .map(|logger| Self {
                inner: Arc::new(Mutex::new(logger)),
            })
            .map_err(|e| napi::Error::from(e))
    }

    #[napi]
    pub fn log_event(
        &self,
        event_type: String,
        severity: String,
        message: String,
        metadata: String,
    ) -> napi::Result<()> {
        let event_type = match event_type.as_str() {
            "security" => AuditEventType::Security,
            "license" => AuditEventType::License,
            "job" => AuditEventType::Job,
            "rate_limit" => AuditEventType::RateLimit,
            _ => AuditEventType::Error,
        };

        let severity = match severity.as_str() {
            "debug" => Severity::Debug,
            "info" => Severity::Info,
            "warning" => Severity::Warning,
            "error" => Severity::Error,
            "critical" => Severity::Critical,
            _ => Severity::Info,
        };

        let metadata_json: serde_json::Value = serde_json::from_str(&metadata)
            .unwrap_or(serde_json::json!({}));

        let event = AuditEvent::new(event_type, severity, message, metadata_json);

        self.inner
            .lock()
            .log_event(event)
            .map_err(|e| napi::Error::from(e))
    }

    #[napi]
    pub fn get_stats(&self) -> napi::Result<String> {
        self.inner
            .lock()
            .get_stats()
            .and_then(|stats| {
                serde_json::to_string(&serde_json::json!({
                    "total_events": stats.total_events,
                    "total_size": stats.total_size,
                    "file_count": stats.file_count,
                    "current_file_size": stats.current_file_size,
                }))
                .map_err(|e| NativeError::SerializationError(e))
            })
            .map_err(|e| napi::Error::from(e))
    }
}

// License validation functions using real RSA signature verification
#[napi]
pub fn validate_license_key(key: String) -> napi::Result<String> {
    use license_validator::LicenseValidator;

    let validator = LicenseValidator::new()
        .map_err(|e| napi::Error::from_reason(format!("Failed to initialize validator: {}", e)))?;

    let license = match validator.parse_license_key(&key) {
        Ok(l) => l,
        Err(e) => {
            let reason = match &e {
                NativeError::InvalidLicenseKey => "invalid_key",
                NativeError::CryptoError(_) => "malformed_key",
                _ => "unknown_error",
            };
            return Ok(serde_json::json!({
                "valid": false,
                "error": reason,
                "message": e.to_string()
            }).to_string());
        }
    };

    match validator.validate_license(&license) {
        Ok(_) => {
            let tier = format!("{:?}", license.tier);
            Ok(serde_json::json!({
                "valid": true,
                "tier": tier,
                "expires_at": license.expires_at.map(|d| d.to_rfc3339()),
            }).to_string())
        }
        Err(e) => {
            let reason = match &e {
                NativeError::LicenseExpired => "expired",
                NativeError::HardwareMismatch => "wrong_device",
                NativeError::InvalidLicenseKey => "invalid_signature",
                NativeError::CryptoError(_) => "invalid_signature",
                _ => "unknown_error",
            };
            Ok(serde_json::json!({
                "valid": false,
                "error": reason,
                "message": e.to_string()
            }).to_string())
        }
    }
}

#[napi]
pub fn get_hardware_id() -> napi::Result<String> {
    use license_validator::LicenseValidator;

    let validator = LicenseValidator::new()
        .map_err(|e| napi::Error::from_reason(format!("Failed to get hardware ID: {}", e)))?;

    Ok(validator.get_hardware_fingerprint())
}

#[napi]
pub fn get_lead_count() -> u32 {
    use once_cell::sync::Lazy;
    use std::sync::Mutex as StdMutex;
    static LEAD_COUNT: Lazy<StdMutex<u32>> = Lazy::new(|| StdMutex::new(0));
    let count = LEAD_COUNT.lock().unwrap();
    *count
}

#[napi]
pub fn increment_lead_count() -> u32 {
    use once_cell::sync::Lazy;
    use std::sync::Mutex as StdMutex;
    static LEAD_COUNT: Lazy<StdMutex<u32>> = Lazy::new(|| StdMutex::new(0));
    let mut count = LEAD_COUNT.lock().unwrap();
    *count += 1;
    *count
}

#[napi]
pub fn reset_lead_count() {
    use once_cell::sync::Lazy;
    use std::sync::Mutex as StdMutex;
    static LEAD_COUNT: Lazy<StdMutex<u32>> = Lazy::new(|| StdMutex::new(0));
    let mut count = LEAD_COUNT.lock().unwrap();
    *count = 0;
}

