import { describe, expect, it } from 'vitest';
import { rateLimitKey } from './rate-limit-key';

describe('rateLimitKey', () => {
  it.each(['203.0.113.5', '10.0.0.1', '127.0.0.1'])('CA-01.8: la IPv4 %s se usa tal cual', (ip) => {
    expect(rateLimitKey(ip)).toBe(ip);
  });

  it.each([
    ['2001:db8:1:2:3:4:5:6', '2001:db8:1:2::/64'],
    ['2001:db8:1:2::1', '2001:db8:1:2::/64'],
    ['2001:0DB8:0001:0002:FFFF::', '2001:db8:1:2::/64'],
    ['2001:db8::', '2001:db8:0:0::/64'],
    ['2001:db8::1:2:3:4', '2001:db8:0:0::/64'],
    ['::1', '0:0:0:0::/64'],
    ['::', '0:0:0:0::/64'],
    ['fe80::1%eth0', 'fe80:0:0:0::/64'],
    ['64:ff9b::203.0.113.5', '64:ff9b:0:0::/64'],
  ])('CA-01.8: la IPv6 %s se reduce a su prefijo /64 (%s)', (ip, expected) => {
    expect(rateLimitKey(ip)).toBe(expected);
  });

  it('CA-01.8: dos IPv6 del mismo /64 comparten clave y una de otro /64 no', () => {
    expect(rateLimitKey('2001:db8:1:2::a')).toBe(rateLimitKey('2001:db8:1:2:ffff:ffff:ffff:ffff'));
    expect(rateLimitKey('2001:db8:1:2::a')).not.toBe(rateLimitKey('2001:db8:1:3::a'));
  });

  it.each([
    ['::ffff:203.0.113.5', '203.0.113.5'],
    ['::FFFF:203.0.113.5', '203.0.113.5'],
    ['::ffff:cb00:7105', '203.0.113.5'],
    ['0:0:0:0:0:ffff:203.0.113.5', '203.0.113.5'],
  ])('CA-01.8: la IPv4 mapeada %s cuenta como la IPv4 %s', (ip, expected) => {
    expect(rateLimitKey(ip)).toBe(expected);
  });

  it('una dirección que no es IP se devuelve sin cambios', () => {
    expect(rateLimitKey('desconocida')).toBe('desconocida');
  });
});
