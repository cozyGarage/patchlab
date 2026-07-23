/** Small IPv4 helpers for training (not a full stack). */

export function parseIpv4(ip: string): number | null {
  const parts = ip.trim().split('.');
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    if (!/^\d+$/.test(p)) return null;
    const v = Number(p);
    if (v < 0 || v > 255) return null;
    n = (n << 8) + v;
  }
  return n >>> 0;
}

export function toIpv4(n: number): string {
  return [
    (n >>> 24) & 255,
    (n >>> 16) & 255,
    (n >>> 8) & 255,
    n & 255,
  ].join('.');
}

export function parseCidr(cidr: string): { network: number; prefix: number } | null {
  const [ip, prefRaw] = cidr.trim().split('/');
  if (!ip || prefRaw == null) return null;
  const prefix = Number(prefRaw);
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > 32) return null;
  const addr = parseIpv4(ip);
  if (addr == null) return null;
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  return { network: (addr & mask) >>> 0, prefix };
}

export function inCidr(ip: string, cidr: string): boolean {
  const addr = parseIpv4(ip);
  const net = parseCidr(cidr);
  if (addr == null || !net) return false;
  const mask = net.prefix === 0 ? 0 : (0xffffffff << (32 - net.prefix)) >>> 0;
  return ((addr & mask) >>> 0) === net.network;
}

export function sameSubnet(
  a: { address: string; prefix: number },
  b: { address: string; prefix: number },
): boolean {
  if (a.prefix !== b.prefix) return false;
  const aa = parseIpv4(a.address);
  const bb = parseIpv4(b.address);
  if (aa == null || bb == null) return false;
  const mask = a.prefix === 0 ? 0 : (0xffffffff << (32 - a.prefix)) >>> 0;
  return ((aa & mask) >>> 0) === ((bb & mask) >>> 0);
}

export function isValidHostIp(address: string, prefix: number): boolean {
  const addr = parseIpv4(address);
  if (addr == null) return false;
  if (prefix < 0 || prefix > 32) return false;
  // Reject obvious network/broadcast for common prefixes
  if (prefix <= 30) {
    const mask = (0xffffffff << (32 - prefix)) >>> 0;
    const host = addr & ~mask;
    const max = (~mask) >>> 0;
    if (host === 0 || host === max) return false;
  }
  return true;
}
