use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Job priority levels (0 = lowest, 255 = highest)
pub type Priority = u8;

/// Job progress (0.0 = not started, 1.0 = complete)
pub type Progress = f32;

/// Job state enumeration
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum JobState {
    Queued,
    Running,
    Paused,
    Completed,
    Failed,
    Cancelled,
}

impl JobState {
    /// Check if transition to another state is valid
    pub fn can_transition_to(&self, target: &JobState) -> bool {
        use JobState::*;
        match (self, target) {
            (Queued, Running) => true,
            (Queued, Cancelled) => true,
            (Running, Paused) => true,
            (Running, Completed) => true,
            (Running, Failed) => true,
            (Running, Cancelled) => true,
            (Paused, Running) => true,
            (Paused, Cancelled) => true,
            _ => false,
        }
    }

    pub fn is_terminal(&self) -> bool {
        matches!(self, JobState::Completed | JobState::Failed | JobState::Cancelled)
    }
}

/// Job metadata containing scraping parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JobMetadata {
    pub keyword: String,
    pub city: String,
    pub max_results: Option<u32>,
    pub speed: String, // "slow", "normal", "fast"
}

/// Complete job structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Job {
    pub id: String,
    pub state: JobState,
    pub priority: Priority,
    pub created_at: DateTime<Utc>,
    pub started_at: Option<DateTime<Utc>>,
    pub completed_at: Option<DateTime<Utc>>,
    pub progress: Progress,
    pub metadata: JobMetadata,
    pub error_message: Option<String>,
}

impl Job {
    pub fn new(priority: Priority, metadata: JobMetadata) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            state: JobState::Queued,
            priority,
            created_at: Utc::now(),
            started_at: None,
            completed_at: None,
            progress: 0.0,
            metadata,
            error_message: None,
        }
    }

    pub fn transition_to(&mut self, new_state: JobState) -> Result<(), String> {
        if !self.state.can_transition_to(&new_state) {
            return Err(format!(
                "Invalid state transition from {:?} to {:?}",
                self.state, new_state
            ));
        }

        self.state = new_state;

        match new_state {
            JobState::Running if self.started_at.is_none() => {
                self.started_at = Some(Utc::now());
            }
            JobState::Completed | JobState::Failed | JobState::Cancelled => {
                self.completed_at = Some(Utc::now());
                if new_state == JobState::Completed {
                    self.progress = 1.0;
                }
            }
            _ => {}
        }

        Ok(())
    }
}

/// Rate limiting configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RateLimitConfig {
    pub algorithm: RateLimitAlgorithm,
    pub capacity: u32,
    pub refill_rate: f64, // tokens/requests per second
    pub burst_size: Option<u32>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RateLimitAlgorithm {
    TokenBucket,
    LeakyBucket,
    Adaptive,
}

/// License tier enumeration
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum LicenseTier {
    Basic,
    Pro,
    Enterprise,
}

/// License structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct License {
    pub key: String,
    pub tier: LicenseTier,
    pub issued_at: DateTime<Utc>,
    pub expires_at: Option<DateTime<Utc>>,
    pub hardware_id: String,
    pub signature: Vec<u8>,
}

/// Audit event types
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AuditEventType {
    Security,
    License,
    Job,
    RateLimit,
    Error,
}

/// Severity levels for audit events
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Severity {
    Debug,
    Info,
    Warning,
    Error,
    Critical,
}

/// Audit event structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditEvent {
    pub id: String,
    pub timestamp: DateTime<Utc>,
    pub event_type: AuditEventType,
    pub severity: Severity,
    pub message: String,
    pub metadata: serde_json::Value,
}

impl AuditEvent {
    pub fn new(
        event_type: AuditEventType,
        severity: Severity,
        message: String,
        metadata: serde_json::Value,
    ) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            timestamp: Utc::now(),
            event_type,
            severity,
            message,
            metadata,
        }
    }
}
