import { describe, expect, it } from 'vitest';
import {
  inCidr,
  isValidHostIp,
  parseCidr,
  parseIpv4,
  sameSubnet,
  toIpv4,
} from './ip';

describe('IPv4 helpers', () => {
  it('parses and formats dotted quads', () => {
    expect(parseIpv4('10.10.10.10')).toBe((10 << 24) + (10 << 16) + (10 << 8) + 10);
    expect(toIpv4(parseIpv4('203.0.113.2')!)).toBe('203.0.113.2');
    expect(parseIpv4('10.10.10')).toBeNull();
    expect(parseIpv4('10.10.10.256')).toBeNull();
  });

  it('matches hosts inside CIDR ranges including /32', () => {
    expect(inCidr('10.10.10.20', '10.10.10.0/24')).toBe(true);
    expect(inCidr('10.10.11.1', '10.10.10.0/24')).toBe(false);
    expect(inCidr('10.10.10.20', '10.10.10.20/32')).toBe(true);
    expect(inCidr('10.10.10.21', '10.10.10.20/32')).toBe(false);
    expect(inCidr('8.8.8.8', '0.0.0.0/0')).toBe(true);
  });

  it('parses CIDR and rejects bad prefixes', () => {
    expect(parseCidr('203.0.113.0/30')?.prefix).toBe(30);
    expect(parseCidr('10.0.0.0/33')).toBeNull();
    expect(parseCidr('not-a-cidr')).toBeNull();
  });

  it('compares same-subnet membership', () => {
    expect(
      sameSubnet(
        { address: '10.10.10.10', prefix: 24 },
        { address: '10.10.10.1', prefix: 24 },
      ),
    ).toBe(true);
    expect(
      sameSubnet(
        { address: '10.10.10.10', prefix: 24 },
        { address: '10.10.20.10', prefix: 24 },
      ),
    ).toBe(false);
    expect(
      sameSubnet(
        { address: '10.10.10.10', prefix: 24 },
        { address: '10.10.10.1', prefix: 25 },
      ),
    ).toBe(false);
  });

  it('rejects network and broadcast host addresses', () => {
    expect(isValidHostIp('10.10.10.10', 24)).toBe(true);
    expect(isValidHostIp('10.10.10.0', 24)).toBe(false);
    expect(isValidHostIp('10.10.10.255', 24)).toBe(false);
    expect(isValidHostIp('203.0.113.2', 30)).toBe(true);
  });
});
