import { ScrapeConfig, ScrapeStatus, BusinessData } from '../../common/types';
import log from 'electron-log';

export class MockScraper {
  private interval: NodeJS.Timeout | null = null;
  private isPaused = false;

  constructor(
    private onData: (data: BusinessData[]) => void,
    private onStatus: (status: ScrapeStatus) => void
  ) { }

  scrape(config: ScrapeConfig) {
    this.onStatus('running');
    log.info('Mock scraping started:', config);

    if (process.env.FORCE_ERROR === 'true') {
      setTimeout(() => {
        this.onStatus('error');
        this.stop();
      }, 1000);
      return;
    }

    const limit = process.env.MOCK_COUNT ? parseInt(process.env.MOCK_COUNT) : 5;
    const delay = process.env.MOCK_DELAY ? parseInt(process.env.MOCK_DELAY) : 100;

    let count = 0;
    this.interval = setInterval(() => {
      count++;
      const data: BusinessData[] = [{
        id: `mock-${count}`,
        name: `Mock Business ${count}`,
        phone: `555-000-${String(count).padStart(4, '0')}`,
        website: `http://mock-${count}.com`,
        address: `${count} Mock St`
      }];

      this.onData(data);

      if (count >= limit) {
        this.stop();
        this.onStatus('completed');
      }
    }, delay);
  }

  async stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    this.isPaused = false;
    this.onStatus('idle');
  }

  async pause() {
    this.isPaused = true;
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    this.onStatus('paused');
  }

  async resume() {
    if (this.isPaused) {
      this.isPaused = false;
      this.onStatus('running');
      // Note: In production, this would need to resume from where it left off
      // For now, this is just a mock implementation
    }
  }
}
