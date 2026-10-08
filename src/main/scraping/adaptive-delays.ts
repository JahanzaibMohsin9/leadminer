export class AdaptiveDelay {
  private baseDelay: number;
  private minDelay: number;
  private maxDelay: number;
  private consecutiveErrors: number = 0;
  private successCount: number = 0;

  constructor(speed: 'slow' | 'normal' | 'fast') {
    switch (speed) {
      case 'slow':
        this.baseDelay = 3000;
        this.minDelay = 2000;
        this.maxDelay = 5000;
        break;
      case 'fast':
        this.baseDelay = 500;
        this.minDelay = 300;
        this.maxDelay = 1000;
        break;
      case 'normal':
      default:
        this.baseDelay = 1500;
        this.minDelay = 1000;
        this.maxDelay = 3000;
        break;
    }
  }

  /**
   * Returns a randomized delay based on the current state.
   * If there have been recent errors, the delay is increased.
   */
  getDelay(): number {
    let delay = this.baseDelay;

    // Add randomization (±20%)
    const randomFactor = 0.8 + Math.random() * 0.4;
    delay *= randomFactor;

    // Increase delay if there have been consecutive errors
    if (this.consecutiveErrors > 0) {
      const errorFactor = Math.min(this.consecutiveErrors + 1, 5); // Cap at 5x
      delay *= errorFactor;
    }

    // Clamp to min/max (extended max if errors)
    const currentMax = this.consecutiveErrors > 0 ? this.maxDelay * 5 : this.maxDelay;
    return Math.max(this.minDelay, Math.min(delay, currentMax));
  }

  reportSuccess() {
    this.successCount++;
    this.consecutiveErrors = 0;
  }

  reportError() {
    this.consecutiveErrors++;
    this.successCount = 0;
  }

  getStats() {
    return {
      consecutiveErrors: this.consecutiveErrors,
      successCount: this.successCount
    };
  }
}
