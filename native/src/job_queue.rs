use crate::error::{NativeError, Result};
use crate::types::{Job, JobState};
use parking_lot::Mutex;
use std::cmp::Ordering;
use std::collections::{BinaryHeap, HashMap};
use std::sync::Arc;

/// Wrapper for Job to implement priority ordering
#[derive(Clone)]
struct PriorityJob(Job);

impl PartialEq for PriorityJob {
    fn eq(&self, other: &Self) -> bool {
        self.0.priority == other.0.priority && self.0.created_at == other.0.created_at
    }
}

impl Eq for PriorityJob {}

impl PartialOrd for PriorityJob {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}

impl Ord for PriorityJob {
    fn cmp(&self, other: &Self) -> Ordering {
        // Higher priority first, then earlier creation time
        match self.0.priority.cmp(&other.0.priority) {
            Ordering::Equal => other.0.created_at.cmp(&self.0.created_at),
            other => other,
        }
    }
}

/// Thread-safe job queue with priority ordering
pub struct JobQueue {
    queue: Arc<Mutex<BinaryHeap<PriorityJob>>>,
    active_jobs: Arc<Mutex<HashMap<String, Job>>>,
    max_concurrent: usize,
}

impl JobQueue {
    /// Create a new job queue with maximum concurrent job limit
    pub fn new(max_concurrent: usize) -> Self {
        Self {
            queue: Arc::new(Mutex::new(BinaryHeap::new())),
            active_jobs: Arc::new(Mutex::new(HashMap::new())),
            max_concurrent,
        }
    }

    /// Add a job to the queue
    pub fn enqueue(&self, job: Job) -> Result<()> {
        let mut queue = self.queue.lock();
        queue.push(PriorityJob(job));
        Ok(())
    }

    /// Get the next job from the queue if capacity allows
    pub fn dequeue(&self) -> Option<Job> {
        let active_count = self.active_jobs.lock().len();
        
        if active_count >= self.max_concurrent {
            return None;
        }

        let mut queue = self.queue.lock();
        queue.pop().map(|pj| pj.0)
    }

    /// Mark a job as active
    pub fn mark_active(&self, job: Job) -> Result<()> {
        let mut active = self.active_jobs.lock();
        active.insert(job.id.clone(), job);
        Ok(())
    }

    /// Remove a job from active jobs
    pub fn remove_active(&self, job_id: &str) -> Option<Job> {
        let mut active = self.active_jobs.lock();
        active.remove(job_id)
    }

    /// Get an active job by ID
    pub fn get_active(&self, job_id: &str) -> Option<Job> {
        let active = self.active_jobs.lock();
        active.get(job_id).cloned()
    }

    /// Update an active job
    pub fn update_active(&self, job: Job) -> Result<()> {
        let mut active = self.active_jobs.lock();
        if active.contains_key(&job.id) {
            active.insert(job.id.clone(), job);
            Ok(())
        } else {
            Err(NativeError::JobNotFound(job.id.clone()))
        }
    }

    /// Get the number of active jobs
    pub fn get_active_count(&self) -> usize {
        self.active_jobs.lock().len()
    }

    /// Get the number of queued jobs
    pub fn get_queued_count(&self) -> usize {
        self.queue.lock().len()
    }

    /// Cancel a job (remove from queue or mark active job as cancelled)
    pub fn cancel_job(&self, job_id: &str) -> Result<Job> {
        // First check if it's in active jobs
        if let Some(mut job) = self.get_active(job_id) {
            job.transition_to(JobState::Cancelled)
                .map_err(|e| NativeError::InvalidStateTransition {
                    from: format!("{:?}", job.state),
                    to: "Cancelled".to_string(),
                })?;
            self.update_active(job.clone())?;
            return Ok(job);
        }

        // If not active, search in the queue
        let mut queue = self.queue.lock();
        let mut temp_vec: Vec<PriorityJob> = queue.drain().collect();
        
        if let Some(pos) = temp_vec.iter().position(|pj| pj.0.id == job_id) {
            let mut job = temp_vec.remove(pos).0;
            job.transition_to(JobState::Cancelled)
                .map_err(|e| NativeError::InvalidStateTransition {
                    from: format!("{:?}", job.state),
                    to: "Cancelled".to_string(),
                })?;
            
            // Put remaining jobs back in queue
            for pj in temp_vec {
                queue.push(pj);
            }
            
            Ok(job)
        } else {
            Err(NativeError::JobNotFound(job_id.to_string()))
        }
    }

    /// Get all active jobs
    pub fn get_all_active(&self) -> Vec<Job> {
        let active = self.active_jobs.lock();
        active.values().cloned().collect()
    }

    /// Clear all jobs (for testing/reset)
    pub fn clear(&self) {
        self.queue.lock().clear();
        self.active_jobs.lock().clear();
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::JobMetadata;

    fn create_test_job(priority: u8, keyword: &str) -> Job {
        Job::new(
            priority,
            JobMetadata {
                keyword: keyword.to_string(),
                city: "Test City".to_string(),
                max_results: Some(100),
                speed: "normal".to_string(),
            },
        )
    }

    #[test]
    fn test_enqueue_dequeue() {
        let queue = JobQueue::new(5);
        let job = create_test_job(10, "test");
        
        queue.enqueue(job.clone()).unwrap();
        assert_eq!(queue.get_queued_count(), 1);
        
        let dequeued = queue.dequeue().unwrap();
        assert_eq!(dequeued.id, job.id);
    }

    #[test]
    fn test_priority_ordering() {
        let queue = JobQueue::new(5);
        
        let low_priority = create_test_job(5, "low");
        let high_priority = create_test_job(20, "high");
        let medium_priority = create_test_job(10, "medium");
        
        queue.enqueue(low_priority.clone()).unwrap();
        queue.enqueue(high_priority.clone()).unwrap();
        queue.enqueue(medium_priority.clone()).unwrap();
        
        // Should dequeue in priority order: high, medium, low
        assert_eq!(queue.dequeue().unwrap().id, high_priority.id);
        assert_eq!(queue.dequeue().unwrap().id, medium_priority.id);
        assert_eq!(queue.dequeue().unwrap().id, low_priority.id);
    }

    #[test]
    fn test_max_concurrent_limit() {
        let queue = JobQueue::new(2);
        
        let job1 = create_test_job(10, "job1");
        let job2 = create_test_job(10, "job2");
        let job3 = create_test_job(10, "job3");
        
        queue.enqueue(job1.clone()).unwrap();
        queue.enqueue(job2.clone()).unwrap();
        queue.enqueue(job3.clone()).unwrap();
        
        // Dequeue and mark as active
        let active1 = queue.dequeue().unwrap();
        queue.mark_active(active1).unwrap();
        
        let active2 = queue.dequeue().unwrap();
        queue.mark_active(active2).unwrap();
        
        // Should return None because we're at max concurrent
        assert!(queue.dequeue().is_none());
        assert_eq!(queue.get_active_count(), 2);
    }

    #[test]
    fn test_cancel_job() {
        let queue = JobQueue::new(5);
        let job = create_test_job(10, "test");
        let job_id = job.id.clone();
        
        queue.enqueue(job).unwrap();
        
        let cancelled = queue.cancel_job(&job_id).unwrap();
        assert_eq!(cancelled.state, JobState::Cancelled);
        assert_eq!(queue.get_queued_count(), 0);
    }
}
