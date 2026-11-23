// Clave del límite de intentos de login (CA-01.8) a partir de la IP del cliente.
import { isIPv4, isIPv6 } from 'node:net';

/** Bits del prefijo IPv6 que identifican a un cliente: a cada conexión se le asigna al menos un /64. */
const IPV6_PREFIX_GROUPS = 4;

/** Convierte una IPv6 (con `::` y con IPv4 incrustada al final) en sus 8 grupos numéricos. */
function ipv6Groups(ip: string): number[] {
  const [head = '', tail] = ip.split('::');
  const parse = (part: string): number[] =>
    part === ''
      ? []
      : part.split(':').flatMap((group) => {
          if (!group.includes('.')) return [Number.parseInt(group, 16)];
          const [a = 0, b = 0, c = 0, d = 0] = group.split('.').map(Number);
          return [(a << 8) | b, (c << 8) | d];
        });
  const left = parse(head);
  const right = tail === undefined ? [] : parse(tail);
  return [...left, ...Array<number>(8 - left.length - right.length).fill(0), ...right];
}

/**
 * IPv4 → tal cual. IPv6 → su prefijo /64, para que rotar direcciones dentro de su propia red no dé
 * a un atacante un contador nuevo. IPv4 mapeada en IPv6 (`::ffff:a.b.c.d`) → la IPv4. Se hace
 * explícito aunque `@fastify/rate-limit` ya lo haga por defecto, para no depender de ese valor.
 */
export function rateLimitKey(ip: string): string {
  if (isIPv4(ip)) return ip;

  const address = ip.split('%')[0] ?? ip; // sin el identificador de zona (`fe80::1%eth0`)
  if (!isIPv6(address)) return ip;

  const groups = ipv6Groups(address);
  const isMappedIPv4 = groups.slice(0, 5).every((group) => group === 0) && groups[5] === 0xffff;
  if (isMappedIPv4) {
    const [high = 0, low = 0] = groups.slice(6);
    return [high >> 8, high & 0xff, low >> 8, low & 0xff].join('.');
  }

  const prefix = groups.slice(0, IPV6_PREFIX_GROUPS).map((group) => group.toString(16));
  return `${prefix.join(':')}::/64`;
}
