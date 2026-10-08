use crate::error::{NativeError, Result};
use crate::types::{AuditEvent, AuditEventType, Severity};
use chrono::{DateTime, Duration, Utc};
use parking_lot::Mutex;
use std::fs::{self, File, OpenOptions};
use std::io::{BufWriter, Write};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;

/// Configuration for audit logger
#[derive(Debug, Clone)]
pub struct AuditConfig {
    pub log_dir: PathBuf,
    pub max_file_size: u64,      // bytes
    pub retention_days: u32,
}

impl Default for AuditConfig {
    fn default() -> Self {
        Self {
            log_dir: PathBuf::from("./logs"),
            max_file_size: 10 * 1024 * 1024, // 10MB
            retention_days: 30,
        }
    }
}

/// Audit logger with rotation and retention
pub struct AuditLogger {
    config: AuditConfig,
    current_file: Arc<Mutex<Option<BufWriter<File>>>>,
    current_file_path: Arc<Mutex<Option<PathBuf>>>,
    current_file_size: Arc<Mutex<u64>>,
    rotation_seq: AtomicU64,
}

impl AuditLogger {
    /// Create a new audit logger
    pub fn new(config: AuditConfig) -> Result<Self> {
        // Create log directory if it doesn't exist
        fs::create_dir_all(&config.log_dir)
            .map_err(|e| NativeError::AuditLogError(format!("Failed to create log directory: {}", e)))?;

        let logger = Self {
            config,
            current_file: Arc::new(Mutex::new(None)),
            current_file_path: Arc::new(Mutex::new(None)),
            current_file_size: Arc::new(Mutex::new(0)),
            rotation_seq: AtomicU64::new(0),
        };

        // Initialize first log file
        logger.rotate_logs()?;

        Ok(logger)
    }

    /// Log an audit event
    pub fn log_event(&self, event: AuditEvent) -> Result<()> {
        let json = serde_json::to_string(&event)
            .map_err(|e| NativeError::SerializationError(e))?;
        
        let log_line = format!("{}\n", json);
        let line_size = log_line.len() as u64;

        // Check if rotation is needed
        {
            let current_size = *self.current_file_size.lock();
            if current_size + line_size > self.config.max_file_size {
                self.rotate_logs()?;
            }
        }

        // Write to current file
        {
            let mut file_guard = self.current_file.lock();
            if let Some(file) = file_guard.as_mut() {
                file.write_all(log_line.as_bytes())
                    .map_err(|e| NativeError::AuditLogError(format!("Failed to write log: {}", e)))?;
                file.flush()
                    .map_err(|e| NativeError::AuditLogError(format!("Failed to flush log: {}", e)))?;
            }
        }

        // Update file size
        {
            let mut size = self.current_file_size.lock();
            *size += line_size;
        }

        Ok(())
    }

    /// Rotate log files
    pub fn rotate_logs(&self) -> Result<()> {
        // Close current file
        {
            let mut file_guard = self.current_file.lock();
            *file_guard = None;
        }

        // Generate a new filename. The sequence number keeps names unique when
        // several rotations happen within the same second; without it the
        // logger would reopen the same file and keep appending past max_file_size.
        let timestamp = Utc::now().format("%Y%m%d_%H%M%S");
        let seq = self.rotation_seq.fetch_add(1, Ordering::Relaxed);
        let filename = format!("audit_{}_{:04}.jsonl", timestamp, seq);
        let filepath = self.config.log_dir.join(&filename);

        // Open new file
        let file = OpenOptions::new()
            .create(true)
            .append(true)
            .open(&filepath)
            .map_err(|e| NativeError::AuditLogError(format!("Failed to open log file: {}", e)))?;

        let writer = BufWriter::new(file);

        // Update current file
        {
            let mut file_guard = self.current_file.lock();
            *file_guard = Some(writer);
        }

        {
            let mut path_guard = self.current_file_path.lock();
            *path_guard = Some(filepath);
        }

        {
            let mut size_guard = self.current_file_size.lock();
            *size_guard = 0;
        }

        // Cleanup old logs
        self.cleanup_old_logs()?;

        Ok(())
    }

    /// Remove logs older than retention period
    pub fn cleanup_old_logs(&self) -> Result<()> {
        let cutoff_date = Utc::now() - Duration::days(self.config.retention_days as i64);

        let entries = fs::read_dir(&self.config.log_dir)
            .map_err(|e| NativeError::AuditLogError(format!("Failed to read log directory: {}", e)))?;

        for entry in entries {
            let entry = entry.map_err(|e| NativeError::AuditLogError(format!("Failed to read entry: {}", e)))?;
            let path = entry.path();

            if path.is_file() && path.extension().map_or(false, |ext| ext == "jsonl") {
                if let Ok(metadata) = fs::metadata(&path) {
                    if let Ok(modified) = metadata.modified() {
                        let modified_datetime: DateTime<Utc> = modified.into();
                        
                        if modified_datetime < cutoff_date {
                            let _ = fs::remove_file(&path);
                        }
                    }
                }
            }
        }

        Ok(())
    }

    /// Export logs within a date range
    pub fn export_logs(
        &self,
        start: DateTime<Utc>,
        end: DateTime<Utc>,
    ) -> Result<Vec<AuditEvent>> {
        let mut events = Vec::new();

        let entries = fs::read_dir(&self.config.log_dir)
            .map_err(|e| NativeError::AuditLogError(format!("Failed to read log directory: {}", e)))?;

        for entry in entries {
            let entry = entry.map_err(|e| NativeError::AuditLogError(format!("Failed to read entry: {}", e)))?;
            let path = entry.path();

            if path.is_file() && path.extension().map_or(false, |ext| ext == "jsonl") {
                let content = fs::read_to_string(&path)
                    .map_err(|e| NativeError::AuditLogError(format!("Failed to read log file: {}", e)))?;

                for line in content.lines() {
                    if let Ok(event) = serde_json::from_str::<AuditEvent>(line) {
                        if event.timestamp >= start && event.timestamp <= end {
                            events.push(event);
                        }
                    }
                }
            }
        }

        // Sort by timestamp
        events.sort_by(|a, b| a.timestamp.cmp(&b.timestamp));

        Ok(events)
    }

    /// Get log statistics
    pub fn get_stats(&self) -> Result<LogStats> {
        let mut total_events = 0;
        let mut total_size = 0u64;
        let mut file_count = 0;

        let entries = fs::read_dir(&self.config.log_dir)
            .map_err(|e| NativeError::AuditLogError(format!("Failed to read log directory: {}", e)))?;

        for entry in entries {
            let entry = entry.map_err(|e| NativeError::AuditLogError(format!("Failed to read entry: {}", e)))?;
            let path = entry.path();

            if path.is_file() && path.extension().map_or(false, |ext| ext == "jsonl") {
                file_count += 1;

                if let Ok(metadata) = fs::metadata(&path) {
                    total_size += metadata.len();
                }

                if let Ok(content) = fs::read_to_string(&path) {
                    total_events += content.lines().count();
                }
            }
        }

        Ok(LogStats {
            total_events,
            total_size,
            file_count,
            current_file_size: *self.current_file_size.lock(),
        })
    }
}

/// Log statistics
#[derive(Debug, Clone)]
pub struct LogStats {
    pub total_events: usize,
    pub total_size: u64,
    pub file_count: usize,
    pub current_file_size: u64,
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::env;

    // Each test gets its own directory so parallel tests can't delete each other's files.
    fn create_test_config(name: &str) -> AuditConfig {
        let temp_dir = env::temp_dir().join(format!("leadminer_test_logs_{}", name));
        let _ = fs::remove_dir_all(&temp_dir);
        AuditConfig {
            log_dir: temp_dir,
            max_file_size: 1024, // 1KB for testing
            retention_days: 1,
        }
    }

    #[test]
    fn test_audit_logger_creation() {
        let config = create_test_config("test_audit_logger_creation");
        let logger = AuditLogger::new(config.clone());
        assert!(logger.is_ok());

        // Cleanup
        let _ = fs::remove_dir_all(&config.log_dir);
    }

    #[test]
    fn test_log_event() {
        let config = create_test_config("test_log_event");
        let logger = AuditLogger::new(config.clone()).unwrap();

        let event = AuditEvent::new(
            AuditEventType::Security,
            Severity::Info,
            "Test event".to_string(),
            serde_json::json!({"test": "data"}),
        );

        assert!(logger.log_event(event).is_ok());

        // Cleanup
        let _ = fs::remove_dir_all(&config.log_dir);
    }

    #[test]
    fn test_log_rotation() {
        let config = create_test_config("test_log_rotation");
        let logger = AuditLogger::new(config.clone()).unwrap();

        // Log enough events to trigger rotation
        for i in 0..100 {
            let event = AuditEvent::new(
                AuditEventType::Job,
                Severity::Info,
                format!("Event {}", i),
                serde_json::json!({"index": i}),
            );
            let _ = logger.log_event(event);
        }

        let stats = logger.get_stats().unwrap();
        assert!(stats.file_count > 1, "Should have rotated to multiple files");

        // Cleanup
        let _ = fs::remove_dir_all(&config.log_dir);
    }
}
