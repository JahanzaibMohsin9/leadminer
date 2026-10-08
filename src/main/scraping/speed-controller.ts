import { Page } from 'playwright';
import { AdaptiveDelay } from './adaptive-delays';
import { RateLimiter } from '../native-bridge';

export class SpeedController {
  private adaptiveDelay: AdaptiveDelay;
  private rateLimiter: any; // Type is from native module

  constructor(speed: 'slow' | 'normal' | 'fast') {
    this.adaptiveDelay = new AdaptiveDelay(speed);
    
    // Initialize Rust RateLimiter with minimum safe interval
    // This acts as a hard safety floor enforced by native code
    const minIntervals = {
      slow: 2000,
      normal: 1000,
      fast: 300
    };
    this.rateLimiter = new RateLimiter(minIntervals[speed]);
  }

  async waitForNextAction(page: Page) {
    // 1. Get adaptive delay (smart logic in JS)
    const smartDelay = this.adaptiveDelay.getDelay();
    
    // 2. Check native rate limiter (hard enforcement)
    const hardWait = this.rateLimiter.waitTime();
    
    // 3. Wait for the longer of the two
    const finalDelay = Math.max(smartDelay, hardWait);
    
    // Ensure native limiter is updated
    this.rateLimiter.canProceed(); 

    await page.waitForTimeout(finalDelay);
  }

  reportSuccess() {
    this.adaptiveDelay.reportSuccess();
  }

  reportError() {
    this.adaptiveDelay.reportError();
  }
}
