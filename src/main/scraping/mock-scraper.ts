import { ScrapeConfig, ScrapeStatus, BusinessData } from '../../common/types';
import log from 'electron-log';

// Fictional sample listings used when MOCK_DATA=demo (e.g. for screenshots).
// Phone numbers use the 555-01xx range reserved for fiction; emails use example.com.
const DEMO_LISTINGS = [
  ['Lakeview Family Dentistry', 'lakeviewfamilydental', '2100 Lakeview Blvd'],
  ['Bright Smile Dental Studio', 'brightsmilestudio', '418 Congress Ave'],
  ['Cedar Park Orthodontics', 'cedarparkortho', '1301 Medical Pkwy'],
  ['Riverside Dental Care', 'riversidedentalcare', '77 Riverside Dr'],
  ['Hill Country Pediatric Dentistry', 'hcpediatricdental', '5500 Bee Cave Rd'],
  ['South Lamar Dental Group', 'southlamardental', '2901 S Lamar Blvd'],
  ['Northside Implant Center', 'northsideimplants', '9600 N Mopac Expy'],
  ['Mueller Smiles', 'muellersmiles', '1920 Aldrich St'],
  ['Barton Creek Dental', 'bartoncreekdental', '3801 Capital of Texas Hwy'],
  ['Eastside Dental Clinic', 'eastsidedentalclinic', '1100 E 6th St'],
  ['Domain Dental Spa', 'domaindentalspa', '11601 Alterra Pkwy'],
  ['Westlake Cosmetic Dentistry', 'westlakecosmetic', '701 Westlake Dr'],
];

export class MockScraper {
  private interval: NodeJS.Timeout | null = null;
  private isPaused = false;
  private count = 0;
  private limit = 5;
  private delay = 100;

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

    const demo = process.env.MOCK_DATA === 'demo';
    this.limit = process.env.MOCK_COUNT ? parseInt(process.env.MOCK_COUNT) : demo ? DEMO_LISTINGS.length : 5;
    this.delay = process.env.MOCK_DELAY ? parseInt(process.env.MOCK_DELAY) : 100;
    this.count = 0;
    this.startTimer();
  }

  private makeLead(n: number): BusinessData {
    if (process.env.MOCK_DATA === 'demo') {
      const [name, slug, street] = DEMO_LISTINGS[(n - 1) % DEMO_LISTINGS.length];
      return {
        id: `mock-${n}`,
        name,
        phone: `512-555-01${String(n).padStart(2, '0')}`,
        // Not every site exposes an email, like a real crawl.
        email: n % 4 === 0 ? undefined : `hello@${slug}.example.com`,
        website: `https://${slug}.example.com`,
        address: `${street}, Austin, TX`,
      };
    }
    return {
      id: `mock-${n}`,
      name: `Mock Business ${n}`,
      phone: `555-000-${String(n).padStart(4, '0')}`,
      website: `http://mock-${n}.com`,
      address: `${n} Mock St`,
    };
  }

  private startTimer() {
    this.interval = setInterval(() => {
      this.count++;
      this.onData([this.makeLead(this.count)]);

      if (this.count >= this.limit) {
        this.stop();
        this.onStatus('completed');
      }
    }, this.delay);
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
      // Continue from the last emitted lead.
      this.startTimer();
    }
  }
}
