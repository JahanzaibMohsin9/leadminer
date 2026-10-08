use crate::error::{NativeError, Result};
use crate::types::{RateLimitAlgorithm, RateLimitConfig};
use parking_lot::Mutex;
use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};

/// Token bucket rate limiter
#[derive(Debug)]
pub struct TokenBucket {
    capacity: u32,
    tokens: f64,
    refill_rate: f64, // tokens per second
    last_refill: Instant,
}

impl TokenBucket {
    pub fn new(capacity: u32, refill_rate: f64) -> Self {
        Self {
            capacity,
            tokens: capacity as f64,
            refill_rate,
            last_refill: Instant::now(),
        }
    }

    pub fn try_acquire(&mut self, tokens: u32) -> bool {
        self.refill();
        
        if self.tokens >= tokens as f64 {
            self.tokens -= tokens as f64;
            true
        } else {
            false
        }
    }

    pub fn wait_time(&self, tokens: u32) -> Duration {
        if self.tokens >= tokens as f64 {
            Duration::from_secs(0)
        } else {
            let needed = tokens as f64 - self.tokens;
            let seconds = needed / self.refill_rate;
            Duration::from_secs_f64(seconds)
        }
    }

    fn refill(&mut self) {
        let now = Instant::now();
        let elapsed = now.duration_since(self.last_refill).as_secs_f64();
        
        let new_tokens = elapsed * self.refill_rate;
        self.tokens = (self.tokens + new_tokens).min(self.capacity as f64);
        self.last_refill = now;
    }
}

/// Leaky bucket rate limiter
#[derive(Debug)]
pub struct LeakyBucket {
    capacity: u32,
    water_level: u32,
    leak_rate: f64, // units per second
    last_leak: Instant,
}

impl LeakyBucket {
    pub fn new(capacity: u32, leak_rate: f64) -> Self {
        Self {
            capacity,
            water_level: 0,
            leak_rate,
            last_leak: Instant::now(),
        }
    }

    pub fn try_add(&mut self, amount: u32) -> bool {
        self.leak();
        
        if self.water_level + amount <= self.capacity {
            self.water_level += amount;
            true
        } else {
            false
        }
    }

    pub fn wait_time(&self, amount: u32) -> Duration {
        if self.water_level + amount <= self.capacity {
            Duration::from_secs(0)
        } else {
            let overflow = (self.water_level + amount - self.capacity) as f64;
            let seconds = overflow / self.leak_rate;
            Duration::from_secs_f64(seconds)
        }
    }

    fn leak(&mut self) {
        let now = Instant::now();
        let elapsed = now.duration_since(self.last_leak).as_secs_f64();
        
        let leaked = (elapsed * self.leak_rate) as u32;
        self.water_level = self.water_level.saturating_sub(leaked);
        self.last_leak = now;
    }
}

/// Adaptive rate limiter that adjusts based on success/failure
#[derive(Debug)]
pub struct AdaptiveRateLimiter {
    base_limiter: TokenBucket,
    success_count: u32,
    failure_count: u32,
    adjustment_factor: f64,
    min_rate: f64,
    max_rate: f64,
    last_adjustment: Instant,
}

impl AdaptiveRateLimiter {
    pub fn new(initial_capacity: u32, initial_rate: f64) -> Self {
        Self {
            base_limiter: TokenBucket::new(initial_capacity, initial_rate),
            success_count: 0,
            failure_count: 0,
            adjustment_factor: 1.0,
            min_rate: initial_rate * 0.1, // 10% of initial
            max_rate: initial_rate * 2.0,  // 200% of initial
            last_adjustment: Instant::now(),
        }
    }

    pub fn try_acquire(&mut self, tokens: u32) -> bool {
        self.maybe_adjust();
        self.base_limiter.try_acquire(tokens)
    }

    pub fn wait_time(&self, tokens: u32) -> Duration {
        self.base_limiter.wait_time(tokens)
    }

    pub fn record_success(&mut self) {
        self.success_count += 1;
    }

    pub fn record_failure(&mut self) {
        self.failure_count += 1;
    }

    fn maybe_adjust(&mut self) {
        let now = Instant::now();
        let elapsed = now.duration_since(self.last_adjustment);
        
        // Adjust every 10 seconds
        if elapsed < Duration::from_secs(10) {
            return;
        }

        let total = self.success_count + self.failure_count;
        if total == 0 {
            return;
        }

        let success_rate = self.success_count as f64 / total as f64;
        
        // Adjust rate based on success rate
        if success_rate > 0.95 {
            // Very high success rate - increase speed
            self.adjustment_factor = (self.adjustment_factor * 1.1).min(2.0);
        } else if success_rate < 0.8 {
            // Low success rate - decrease speed
            self.adjustment_factor = (self.adjustment_factor * 0.9).max(0.1);
        }

        // Apply adjustment
        let new_rate = (self.base_limiter.refill_rate * self.adjustment_factor)
            .clamp(self.min_rate, self.max_rate);
        self.base_limiter.refill_rate = new_rate;

        // Reset counters
        self.success_count = 0;
        self.failure_count = 0;
        self.last_adjustment = now;
    }
}

/// Unified rate limiter supporting multiple algorithms
pub struct RateLimiter {
    algorithm: RateLimitAlgorithm,
    token_bucket: Option<TokenBucket>,
    leaky_bucket: Option<LeakyBucket>,
    adaptive: Option<AdaptiveRateLimiter>,
}

impl RateLimiter {
    pub fn new(config: RateLimitConfig) -> Self {
        match config.algorithm {
            RateLimitAlgorithm::TokenBucket => Self {
                algorithm: config.algorithm,
                token_bucket: Some(TokenBucket::new(config.capacity, config.refill_rate)),
                leaky_bucket: None,
                adaptive: None,
            },
            RateLimitAlgorithm::LeakyBucket => Self {
                algorithm: config.algorithm,
                token_bucket: None,
                leaky_bucket: Some(LeakyBucket::new(config.capacity, config.refill_rate)),
                adaptive: None,
            },
            RateLimitAlgorithm::Adaptive => Self {
                algorithm: config.algorithm,
                token_bucket: None,
                leaky_bucket: None,
                adaptive: Some(AdaptiveRateLimiter::new(config.capacity, config.refill_rate)),
            },
        }
    }

    pub fn can_proceed(&mut self) -> bool {
        self.try_acquire(1)
    }

    pub fn try_acquire(&mut self, tokens: u32) -> bool {
        match self.algorithm {
            RateLimitAlgorithm::TokenBucket => {
                self.token_bucket.as_mut().unwrap().try_acquire(tokens)
            }
            RateLimitAlgorithm::LeakyBucket => {
                self.leaky_bucket.as_mut().unwrap().try_add(tokens)
            }
            RateLimitAlgorithm::Adaptive => {
                self.adaptive.as_mut().unwrap().try_acquire(tokens)
            }
        }
    }

    pub fn wait_time(&self) -> Duration {
        self.wait_time_for(1)
    }

    pub fn wait_time_for(&self, tokens: u32) -> Duration {
        match self.algorithm {
            RateLimitAlgorithm::TokenBucket => {
                self.token_bucket.as_ref().unwrap().wait_time(tokens)
            }
            RateLimitAlgorithm::LeakyBucket => {
                self.leaky_bucket.as_ref().unwrap().wait_time(tokens)
            }
            RateLimitAlgorithm::Adaptive => {
                self.adaptive.as_ref().unwrap().wait_time(tokens)
            }
        }
    }

    pub fn record_success(&mut self) {
        if let Some(adaptive) = &mut self.adaptive {
            adaptive.record_success();
        }
    }

    pub fn record_failure(&mut self) {
        if let Some(adaptive) = &mut self.adaptive {
            adaptive.record_failure();
        }
    }
}

/// Domain-specific rate limiter
pub struct DomainRateLimiter {
    limiters: Arc<Mutex<HashMap<String, RateLimiter>>>,
    default_config: RateLimitConfig,
}

impl DomainRateLimiter {
    pub fn new(default_config: RateLimitConfig) -> Self {
        Self {
            limiters: Arc::new(Mutex::new(HashMap::new())),
            default_config,
        }
    }

    pub fn can_proceed(&self, domain: &str) -> bool {
        let mut limiters = self.limiters.lock();
        let limiter = limiters
            .entry(domain.to_string())
            .or_insert_with(|| RateLimiter::new(self.default_config.clone()));
        
        limiter.can_proceed()
    }

    pub fn wait_time(&self, domain: &str) -> Duration {
        let limiters = self.limiters.lock();
        limiters
            .get(domain)
            .map(|l| l.wait_time())
            .unwrap_or(Duration::from_secs(0))
    }

    pub fn record_success(&self, domain: &str) {
        let mut limiters = self.limiters.lock();
        if let Some(limiter) = limiters.get_mut(domain) {
            limiter.record_success();
        }
    }

    pub fn record_failure(&self, domain: &str) {
        let mut limiters = self.limiters.lock();
        if let Some(limiter) = limiters.get_mut(domain) {
            limiter.record_failure();
        }
    }

    pub fn clear(&self) {
        self.limiters.lock().clear();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_token_bucket_basic() {
        let mut bucket = TokenBucket::new(10, 1.0);
        
        // Should be able to acquire initially
        assert!(bucket.try_acquire(5));
        assert!(bucket.try_acquire(5));
        
        // Should fail when empty
        assert!(!bucket.try_acquire(1));
    }

    #[test]
    fn test_token_bucket_refill() {
        let mut bucket = TokenBucket::new(10, 10.0); // 10 tokens per second
        
        bucket.try_acquire(10);
        assert!(!bucket.try_acquire(1));
        
        std::thread::sleep(Duration::from_millis(500));
        
        // Should have refilled ~5 tokens
        assert!(bucket.try_acquire(4));
    }

    #[test]
    fn test_leaky_bucket() {
        let mut bucket = LeakyBucket::new(10, 1.0);
        
        assert!(bucket.try_add(5));
        assert!(bucket.try_add(5));
        assert!(!bucket.try_add(1)); // Full
    }

    #[test]
    fn test_adaptive_rate_limiter() {
        let mut limiter = AdaptiveRateLimiter::new(100, 10.0);
        
        // Record successes
        for _ in 0..100 {
            limiter.record_success();
        }
        
        // Force adjustment
        limiter.last_adjustment = Instant::now() - Duration::from_secs(11);
        limiter.maybe_adjust();
        
        // Rate should have increased
        assert!(limiter.base_limiter.refill_rate > 10.0);
    }

    #[test]
    fn test_domain_rate_limiter() {
        let config = RateLimitConfig {
            algorithm: RateLimitAlgorithm::TokenBucket,
            capacity: 10,
            refill_rate: 1.0,
            burst_size: None,
        };
        
        let limiter = DomainRateLimiter::new(config);
        
        // Different domains should have independent limits
        assert!(limiter.can_proceed("example.com"));
        assert!(limiter.can_proceed("another.com"));
    }
}
