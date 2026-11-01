import { lookup } from 'dns/promises';

export class SsrfError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SsrfError';
  }
}

const BLOCKED_HOSTS = new Set([
  'localhost',
  'localhost.localdomain',
  'ip6-localhost',
  'ip6-loopback',
  'metadata.google.internal',
  'metadata.google.com',
  'metadata',
]);

export function ipv4ToInt(ip: string): number | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  const nums = parts.map((p) => Number(p));
  if (nums.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return null;
  return ((nums[0] << 24) | (nums[1] << 16) | (nums[2] << 8) | nums[3]) >>> 0;
}

export function isPrivateIPv4(ip: string): boolean {
  const value = ipv4ToInt(ip);
  if (value === null) return false;

  const inRange = (start: string, prefix: number) => {
    const startInt = ipv4ToInt(start);
    if (startInt === null) return false;
    const mask = prefix === 0 ? 0 : (~((1 << (32 - prefix)) - 1)) >>> 0;
    return (value & mask) === (startInt & mask);
  };

  return (
    inRange('0.0.0.0', 8) ||
    inRange('10.0.0.0', 8) ||
    inRange('127.0.0.0', 8) ||
    inRange('169.254.0.0', 16) ||
    inRange('172.16.0.0', 12) ||
    inRange('192.168.0.0', 16) ||
    inRange('100.64.0.0', 10) ||
    inRange('192.0.2.0', 24) ||
    inRange('198.51.100.0', 24) ||
    inRange('203.0.113.0', 24) ||
    inRange('224.0.0.0', 4)
  );
}

export function isPrivateIPv6(ip: string): boolean {
  const normalized = ip.toLowerCase();
  if (normalized === '::1' || normalized === '::') return true;
  if (normalized.startsWith('fe80:') || normalized.startsWith('fe80::')) return true;
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true;
  if (normalized.startsWith('::ffff:')) {
    const mapped = normalized.slice('::ffff:'.length);
    if (mapped.includes('.')) return isPrivateIPv4(mapped);
  }
  return false;
}

export function isBlockedIp(ip: string): boolean {
  if (ip.includes(':') && !ip.includes('.')) {
    return isPrivateIPv6(ip);
  }
  if (ip.includes('.')) {
    const v4 = ip.includes(':') ? ip.slice(ip.lastIndexOf(':') + 1) : ip;
    return isPrivateIPv4(v4);
  }
  return isPrivateIPv6(ip);
}

export function parseHttpUrl(raw: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new SsrfError('Enter a valid website URL');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new SsrfError('Only http and https URLs are allowed');
  }

  if (parsed.username || parsed.password) {
    throw new SsrfError('URLs with credentials are not allowed');
  }

  const hostname = parsed.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (!hostname) {
    throw new SsrfError('URL is missing a hostname');
  }

  if (BLOCKED_HOSTS.has(hostname) || hostname.endsWith('.localhost') || hostname.endsWith('.local')) {
    throw new SsrfError('That host is not allowed');
  }

  if (isBlockedIp(hostname)) {
    throw new SsrfError('Private or reserved IP addresses are not allowed');
  }

  return parsed;
}

export async function assertPublicResolvedHost(hostname: string): Promise<string[]> {
  const addresses = await lookup(hostname, { all: true, verbatim: true });
  if (!addresses.length) {
    throw new SsrfError('Could not resolve that website');
  }

  const ips = addresses.map((a) => a.address);
  const blocked = ips.filter((ip) => isBlockedIp(ip));
  if (blocked.length > 0) {
    throw new SsrfError('That website resolves to a private or reserved address');
  }
  return ips;
}

export async function assertSafePublicUrl(raw: string): Promise<URL> {
  const parsed = parseHttpUrl(raw);
  await assertPublicResolvedHost(parsed.hostname.replace(/^\[|\]$/g, ''));
  return parsed;
}
