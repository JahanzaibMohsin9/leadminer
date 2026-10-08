export class ProxyManager {
  private proxies: string[] = [];
  private currentIndex: number = 0;

  constructor(proxies: string[] = []) {
    this.proxies = proxies;
  }

  setProxies(proxies: string[]) {
    this.proxies = proxies;
    this.currentIndex = 0;
  }

  getNextProxy(): string | undefined {
    if (this.proxies.length === 0) return undefined;
    const proxy = this.proxies[this.currentIndex];
    this.currentIndex = (this.currentIndex + 1) % this.proxies.length;
    return proxy;
  }

  validateProxy(proxy: string): boolean {
    if (!proxy || proxy.trim().length === 0) return false;
    // Match host:port or protocol://host:port (with optional auth)
    const proxyPattern = /^(https?:\/\/)?([\w.-]+(:[\w.-]+)?@)?[\w.-]+:\d{1,5}$/;
    return proxyPattern.test(proxy.trim());
  }
}
