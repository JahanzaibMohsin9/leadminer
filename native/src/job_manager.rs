use crate::error::{NativeError, Result};
use crate::job_queue::JobQueue;
use crate::types::{Job, JobMetadata, JobState, Priority};
use parking_lot::Mutex;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::mpsc;

/// Job events for external notification
#[derive(Debug, Clone)]
pub enum JobEvent {
    JobQueued { job_id: String },
    JobStarted { job_id: String },
    JobProgress { job_id: String, progress: f32 },
    JobCompleted { job_id: String },
    JobFailed { job_id: String, error: String },
    JobCancelled { job_id: String },
}

/// Configuration for job manager
#[derive(Debug, Clone)]
pub struct JobManagerConfig {
    pub max_concurrent_jobs: usize,
}

impl Default for JobManagerConfig {
    fn default() -> Self {
        Self {
            max_concurrent_jobs: 5,
        }
    }
}

/// High-level job orchestration manager
pub struct JobManager {
    queue: Arc<JobQueue>,
    config: JobManagerConfig,
    event_tx: Option<mpsc::UnboundedSender<JobEvent>>,
    job_metadata: Arc<Mutex<HashMap<String, JobMetadata>>>,
}

impl JobManager {
    /// Create a new job manager
    pub fn new(config: JobManagerConfig) -> Self {
        Self {
            queue: Arc::new(JobQueue::new(config.max_concurrent_jobs)),
            config,
            event_tx: None,
            job_metadata: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// Set event channel for job notifications
    pub fn set_event_channel(&mut self, tx: mpsc::UnboundedSender<JobEvent>) {
        self.event_tx = Some(tx);
    }

    /// Submit a new job
    pub fn submit_job(&self, priority: Priority, metadata: JobMetadata) -> Result<String> {
        let job = Job::new(priority, metadata.clone());
        let job_id = job.id.clone();

        // Store metadata
        self.job_metadata.lock().insert(job_id.clone(), metadata);

        // Enqueue the job
        self.queue.enqueue(job)?;

        // Send event
        self.send_event(JobEvent::JobQueued {
            job_id: job_id.clone(),
        });

        Ok(job_id)
    }

    /// Start the next job from the queue
    pub fn start_next_job(&self) -> Option<Job> {
        if let Some(mut job) = self.queue.dequeue() {
            // Transition to running state
            if job.transition_to(JobState::Running).is_ok() {
                let job_id = job.id.clone();
                
                // Mark as active
                if self.queue.mark_active(job.clone()).is_ok() {
                    self.send_event(JobEvent::JobStarted { job_id });
                    return Some(job);
                }
            }
        }
        None
    }

    /// Get job status
    pub fn get_job_status(&self, job_id: &str) -> Option<JobState> {
        self.queue.get_active(job_id).map(|job| job.state)
    }

    /// Get full job details
    pub fn get_job(&self, job_id: &str) -> Option<Job> {
        self.queue.get_active(job_id)
    }

    /// Update job progress
    pub fn update_progress(&self, job_id: &str, progress: f32) -> Result<()> {
        if let Some(mut job) = self.queue.get_active(job_id) {
            job.progress = progress.clamp(0.0, 1.0);
            self.queue.update_active(job)?;
            
            self.send_event(JobEvent::JobProgress {
                job_id: job_id.to_string(),
                progress,
            });
            
            Ok(())
        } else {
            Err(NativeError::JobNotFound(job_id.to_string()))
        }
    }

    /// Mark job as completed
    pub fn complete_job(&self, job_id: &str) -> Result<()> {
        if let Some(mut job) = self.queue.get_active(job_id) {
            job.transition_to(JobState::Completed)
                .map_err(|e| NativeError::InvalidStateTransition {
                    from: format!("{:?}", job.state),
                    to: "Completed".to_string(),
                })?;
            
            self.queue.update_active(job)?;
            self.queue.remove_active(job_id);
            
            self.send_event(JobEvent::JobCompleted {
                job_id: job_id.to_string(),
            });
            
            Ok(())
        } else {
            Err(NativeError::JobNotFound(job_id.to_string()))
        }
    }

    /// Mark job as failed
    pub fn fail_job(&self, job_id: &str, error_message: String) -> Result<()> {
        if let Some(mut job) = self.queue.get_active(job_id) {
            job.transition_to(JobState::Failed)
                .map_err(|e| NativeError::InvalidStateTransition {
                    from: format!("{:?}", job.state),
                    to: "Failed".to_string(),
                })?;
            
            job.error_message = Some(error_message.clone());
            self.queue.update_active(job)?;
            self.queue.remove_active(job_id);
            
            self.send_event(JobEvent::JobFailed {
                job_id: job_id.to_string(),
                error: error_message,
            });
            
            Ok(())
        } else {
            Err(NativeError::JobNotFound(job_id.to_string()))
        }
    }

    /// Pause a running job
    pub fn pause_job(&self, job_id: &str) -> Result<()> {
        if let Some(mut job) = self.queue.get_active(job_id) {
            job.transition_to(JobState::Paused)
                .map_err(|e| NativeError::InvalidStateTransition {
                    from: format!("{:?}", job.state),
                    to: "Paused".to_string(),
                })?;
            
            self.queue.update_active(job)?;
            Ok(())
        } else {
            Err(NativeError::JobNotFound(job_id.to_string()))
        }
    }

    /// Resume a paused job
    pub fn resume_job(&self, job_id: &str) -> Result<()> {
        if let Some(mut job) = self.queue.get_active(job_id) {
            job.transition_to(JobState::Running)
                .map_err(|e| NativeError::InvalidStateTransition {
                    from: format!("{:?}", job.state),
                    to: "Running".to_string(),
                })?;
            
            self.queue.update_active(job)?;
            Ok(())
        } else {
            Err(NativeError::JobNotFound(job_id.to_string()))
        }
    }

    /// Cancel a job
    pub fn cancel_job(&self, job_id: &str) -> Result<()> {
        let job = self.queue.cancel_job(job_id)?;
        
        self.send_event(JobEvent::JobCancelled {
            job_id: job_id.to_string(),
        });
        
        Ok(())
    }

    /// Get statistics
    pub fn get_stats(&self) -> JobStats {
        let active_jobs = self.queue.get_all_active();
        let running_count = active_jobs
            .iter()
            .filter(|j| j.state == JobState::Running)
            .count();
        let paused_count = active_jobs
            .iter()
            .filter(|j| j.state == JobState::Paused)
            .count();

        JobStats {
            queued: self.queue.get_queued_count(),
            running: running_count,
            paused: paused_count,
            active_total: self.queue.get_active_count(),
            max_concurrent: self.config.max_concurrent_jobs,
        }
    }

    /// Get all active jobs
    pub fn get_active_jobs(&self) -> Vec<Job> {
        self.queue.get_all_active()
    }

    /// Send event to listeners
    fn send_event(&self, event: JobEvent) {
        if let Some(tx) = &self.event_tx {
            let _ = tx.send(event);
        }
    }

    /// Clear all jobs (for testing)
    pub fn clear(&self) {
        self.queue.clear();
        self.job_metadata.lock().clear();
    }
}

/// Job statistics
#[derive(Debug, Clone)]
pub struct JobStats {
    pub queued: usize,
    pub running: usize,
    pub paused: usize,
    pub active_total: usize,
    pub max_concurrent: usize,
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_metadata(keyword: &str) -> JobMetadata {
        JobMetadata {
            keyword: keyword.to_string(),
            city: "Test City".to_string(),
            max_results: Some(100),
            speed: "normal".to_string(),
        }
    }

    #[test]
    fn test_submit_and_start_job() {
        let manager = JobManager::new(JobManagerConfig::default());
        
        let job_id = manager
            .submit_job(10, create_test_metadata("test"))
            .unwrap();
        
        let stats = manager.get_stats();
        assert_eq!(stats.queued, 1);
        
        let job = manager.start_next_job().unwrap();
        assert_eq!(job.id, job_id);
        assert_eq!(job.state, JobState::Running);
    }

    #[test]
    fn test_job_lifecycle() {
        let manager = JobManager::new(JobManagerConfig::default());
        
        let job_id = manager
            .submit_job(10, create_test_metadata("test"))
            .unwrap();
        
        manager.start_next_job().unwrap();
        
        // Update progress
        manager.update_progress(&job_id, 0.5).unwrap();
        let job = manager.get_job(&job_id).unwrap();
        assert_eq!(job.progress, 0.5);
        
        // Complete job
        manager.complete_job(&job_id).unwrap();
        assert!(manager.get_job(&job_id).is_none());
    }

    #[test]
    fn test_pause_resume() {
        let manager = JobManager::new(JobManagerConfig::default());
        
        let job_id = manager
            .submit_job(10, create_test_metadata("test"))
            .unwrap();
        
        manager.start_next_job().unwrap();
        
        // Pause
        manager.pause_job(&job_id).unwrap();
        let job = manager.get_job(&job_id).unwrap();
        assert_eq!(job.state, JobState::Paused);
        
        // Resume
        manager.resume_job(&job_id).unwrap();
        let job = manager.get_job(&job_id).unwrap();
        assert_eq!(job.state, JobState::Running);
    }

    #[test]
    fn test_cancel_job() {
        let manager = JobManager::new(JobManagerConfig::default());
        
        let job_id = manager
            .submit_job(10, create_test_metadata("test"))
            .unwrap();
        
        manager.cancel_job(&job_id).unwrap();
        
        let stats = manager.get_stats();
        assert_eq!(stats.queued, 0);
    }
}
