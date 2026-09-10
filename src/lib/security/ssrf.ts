import dns from 'dns';
import net from 'net';

const BIG_ZERO = BigInt(0);
const BIG_ONE = BigInt(1);
const BIG_16 = BigInt(16);
const BIG_128 = BigInt(128);
const BIG_IPV4_MAX = BigInt('0xffffffff');

/**
 * IP CIDR range representation
 */
interface IPRange {
  start: bigint;
  end: bigint;
}

/**
 * Convert an IPv4 string to BigInt
 */
function ipv4ToBigInt(ip: string): bigint {
  const parts = ip.split('.').map((p) => parseInt(p, 10));
  if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
    throw new Error(`Invalid IPv4 address: ${ip}`);
  }
  return (
    (BigInt(parts[0]) << BigInt(24)) +
    (BigInt(parts[1]) << BigInt(16)) +
    (BigInt(parts[2]) << BigInt(8)) +
    BigInt(parts[3])
  );
}

/**
 * Parse an IPv4 CIDR string to BigInt range
 */
function parseIPv4CIDR(cidr: string): IPRange {
  const [ip, prefixStr] = cidr.split('/');
  const prefix = parseInt(prefixStr, 10);
  const ipBig = ipv4ToBigInt(ip);
  const mask =
    prefix === 0
      ? BIG_ZERO
      : ((BIG_ONE << BigInt(prefix)) - BIG_ONE) << BigInt(32 - prefix);
  const start = ipBig & mask;
  const hostMask =
    prefix === 0
      ? BIG_IPV4_MAX
      : (BIG_ONE << BigInt(32 - prefix)) - BIG_ONE;
  const end = start | hostMask;
  return { start, end };
}

/**
 * Normalize IPv6 address string to 8 16-bit hexadecimal groups
 */
function normalizeIPv6(ip: string): string {
  // Handle IPv4-mapped IPv6 e.g. ::ffff:192.168.1.1
  const lastColon = ip.lastIndexOf(':');
  const possibleIPv4 = ip.substring(lastColon + 1);
  if (possibleIPv4.includes('.')) {
    const ipv4Parts = possibleIPv4.split('.').map((p) => parseInt(p, 10));
    if (ipv4Parts.length === 4) {
      const hex1 = ((ipv4Parts[0] << 8) + ipv4Parts[1]).toString(16);
      const hex2 = ((ipv4Parts[2] << 8) + ipv4Parts[3]).toString(16);
      ip = ip.substring(0, lastColon + 1) + hex1 + ':' + hex2;
    }
  }

  const parts = ip.split('::');
  let left = parts[0] ? parts[0].split(':') : [];
  let right = parts[1] ? parts[1].split(':') : [];

  if (parts.length > 1) {
    const missing = 8 - (left.length + right.length);
    const zeros = new Array(missing).fill('0');
    return [...left, ...zeros, ...right].map((p) => p || '0').join(':');
  }

  return left.join(':');
}

/**
 * Convert an IPv6 string to BigInt
 */
function ipv6ToBigInt(ip: string): bigint {
  const fullAddress = normalizeIPv6(ip);
  const hexParts = fullAddress.split(':');
  let result = BIG_ZERO;
  for (const part of hexParts) {
    result = (result << BIG_16) | BigInt(parseInt(part || '0', 16));
  }
  return result;
}

/**
 * Parse an IPv6 CIDR string to BigInt range
 */
function parseIPv6CIDR(cidr: string): IPRange {
  const [ip, prefixStr] = cidr.split('/');
  const prefix = parseInt(prefixStr, 10);
  const ipBig = ipv6ToBigInt(ip);
  const mask =
    prefix === 0
      ? BIG_ZERO
      : ((BIG_ONE << BigInt(prefix)) - BIG_ONE) << BigInt(128 - prefix);
  const start = ipBig & mask;
  const hostMask =
    prefix === 0
      ? (BIG_ONE << BIG_128) - BIG_ONE
      : (BIG_ONE << BigInt(128 - prefix)) - BIG_ONE;
  const end = start | hostMask;
  return { start, end };
}

// Blocked IPv4 CIDR ranges
const BLOCKED_IPV4_RANGES: IPRange[] = [
  '0.0.0.0/8', // Current network (RFC 1122)
  '10.0.0.0/8', // Private network (RFC 1918)
  '100.64.0.0/10', // Shared address space / CGNAT (RFC 6598)
  '127.0.0.0/8', // Loopback (RFC 1122)
  '169.254.0.0/16', // Link-local / Cloud metadata (AWS, GCP, Azure, DigitalOcean)
  '172.16.0.0/12', // Private network (RFC 1918)
  '192.0.0.0/24', // IETF Protocol Assignments (RFC 6890)
  '192.0.2.0/24', // TEST-NET-1 (RFC 5737)
  '192.168.0.0/16', // Private network (RFC 1918)
  '198.18.0.0/15', // Network benchmark testing (RFC 2544)
  '198.51.100.0/24', // TEST-NET-2 (RFC 5737)
  '203.0.113.0/24', // TEST-NET-3 (RFC 5737)
  '224.0.0.0/4', // Multicast (RFC 5771)
  '240.0.0.0/4', // Reserved for future use (RFC 1112)
  '255.255.255.255/32', // Broadcast (RFC 919)
].map(parseIPv4CIDR);

// Blocked IPv6 CIDR ranges
const BLOCKED_IPV6_RANGES: IPRange[] = [
  '::1/128', // Loopback
  '::/128', // Unspecified
  '::ffff:0:0/96', // IPv4-mapped IPv6 (checked separately as IPv4)
  '64:ff9b::/96', // IPv4/IPv6 translation (RFC 6052)
  '64:ff9b:1::/48', // Local IPv4/IPv6 translation (RFC 8215)
  '100::/64', // Discard prefix (RFC 6666)
  '2001:db8::/32', // Documentation (RFC 3849)
  '2001:10::/28', // ORCHID (RFC 4843)
  '2001:20::/28', // ORCHIDv2 (RFC 7343)
  '2002::/16', // 6to4 relay (RFC 3056)
  'fc00::/7', // Unique local addresses (RFC 4193)
  'fe80::/10', // Link-local unicast (RFC 4291)
  'ff00::/8', // Multicast (RFC 4291)
].map(parseIPv6CIDR);

// Hostnames that are blocked directly without DNS resolution
const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'localhost.localdomain',
  'ip6-localhost',
  'ip6-loopback',
  'broadcasthost',
  'metadata.google.internal',
  'metadata.internal',
  'instance-data',
  'instance-data.ec2.internal',
  'metadata',
  'host.docker.internal',
  'gateway.docker.internal',
  'kubernetes.default',
  'kubernetes.default.svc',
  'kubernetes.default.svc.cluster.local',
]);

const BLOCKED_DOMAIN_SUFFIXES = [
  '.localhost',
  '.local',
  '.internal',
  '.lan',
  '.home.arpa',
  '.corp',
  '.home',
  '.intranet',
  '.test',
  '.example',
  '.invalid',
  '.cluster.local',
  '.svc',
];

/**
 * Check if a hostname string represents a blocked local or cloud metadata domain
 */
export function isBlockedHostname(hostname: string): boolean {
  let normalized = hostname.toLowerCase().trim();
  // Strip trailing FQDN dots (e.g. "localhost." -> "localhost")
  normalized = normalized.replace(/\.+$/, '');

  if (BLOCKED_HOSTNAMES.has(normalized)) {
    return true;
  }

  for (const suffix of BLOCKED_DOMAIN_SUFFIXES) {
    if (normalized.endsWith(suffix)) {
      return true;
    }
  }

  // Block single-label hostnames (unqualified names without dots, e.g. "metadata", "admin", "router", "myserver")
  if (!normalized.includes('.')) {
    return true;
  }

  return false;
}

/**
 * Check if an IP address string belongs to a private, loopback, or blocked range
 */
export function isPrivateOrBlockedIP(ip: string): boolean {
  const ipType = net.isIP(ip);
  if (ipType === 0) return true; // Invalid IP is considered blocked

  if (ipType === 4) {
    try {
      const ipBig = ipv4ToBigInt(ip);
      return BLOCKED_IPV4_RANGES.some(
        (range) => ipBig >= range.start && ipBig <= range.end,
      );
    } catch {
      return true;
    }
  }

  if (ipType === 6) {
    try {
      // Check if this is an IPv4-mapped IPv6 address (e.g., ::ffff:192.168.1.1)
      const lower = ip.toLowerCase();
      if (lower.startsWith('::ffff:') || lower.includes(':ffff:')) {
        const parts = lower.split(':');
        const lastPart = parts[parts.length - 1];
        if (net.isIPv4(lastPart)) {
          return isPrivateOrBlockedIP(lastPart);
        }
      }

      const ipBig = ipv6ToBigInt(ip);
      return BLOCKED_IPV6_RANGES.some(
        (range) => ipBig >= range.start && ipBig <= range.end,
      );
    } catch {
      return true;
    }
  }

  return true;
}

export interface SSRFValidationResult {
  valid: boolean;
  reason?: string;
  url?: URL;
  resolvedIPs?: string[];
}

/**
 * Validate a URL against SSRF (Server-Side Request Forgery) attacks.
 * Verifies protocol (http/https only), blocked hostnames, and resolves DNS to verify
 * all associated IP addresses are publicly routable and not in private/reserved ranges.
 */
export async function validateUrlForSSRF(
  urlString: string,
): Promise<SSRFValidationResult> {
  if (!urlString || typeof urlString !== 'string') {
    return { valid: false, reason: 'URL must be a non-empty string' };
  }

  let parsed: URL;
  try {
    parsed = new URL(urlString.trim());
  } catch (err) {
    return { valid: false, reason: 'Invalid URL format' };
  }

  // Enforce HTTP / HTTPS protocol only
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return {
      valid: false,
      reason: `Blocked protocol: "${parsed.protocol}". Only "http:" and "https:" are allowed.`,
    };
  }

  // Reject credentials in URL (e.g. http://user:pass@host)
  if (parsed.username || parsed.password) {
    return {
      valid: false,
      reason: 'URLs with embedded user credentials are not permitted.',
    };
  }

  const hostname = parsed.hostname;
  if (!hostname) {
    return { valid: false, reason: 'URL must contain a valid hostname' };
  }

  // Check static blocked hostnames
  if (isBlockedHostname(hostname)) {
    return {
      valid: false,
      reason: `Access to internal hostname "${hostname}" is blocked.`,
    };
  }

  // If hostname is directly an IP literal (IPv4 or [IPv6])
  const ipLiteral = hostname.startsWith('[') && hostname.endsWith(']')
    ? hostname.slice(1, -1)
    : hostname;

  if (net.isIP(ipLiteral)) {
    if (isPrivateOrBlockedIP(ipLiteral)) {
      return {
        valid: false,
        reason: `Access to private or restricted IP address "${ipLiteral}" is blocked.`,
      };
    }
    return { valid: true, url: parsed, resolvedIPs: [ipLiteral] };
  }

  // Resolve hostname via DNS to inspect all associated IPs
  const cleanHostname = hostname.replace(/\.+$/, '');
  try {
    const addresses = await dns.promises.lookup(cleanHostname, { all: true });

    if (!addresses || addresses.length === 0) {
      return {
        valid: false,
        reason: `DNS resolution failed for hostname "${hostname}".`,
      };
    }

    const resolvedIPs = addresses.map((a) => a.address);

    for (const addr of addresses) {
      if (isPrivateOrBlockedIP(addr.address)) {
        return {
          valid: false,
          reason: `Hostname "${hostname}" resolves to private/blocked IP address "${addr.address}".`,
          resolvedIPs,
        };
      }
    }

    return { valid: true, url: parsed, resolvedIPs };
  } catch (dnsErr: any) {
    return {
      valid: false,
      reason: `DNS lookup failed for "${hostname}": ${dnsErr.message || 'unknown error'}`,
    };
  }
}

/**
 * Simple helper to check if a URL string is a valid HTTP/HTTPS URL
 */
export function validateHttpUrl(urlString: string): boolean {
  if (!urlString || typeof urlString !== 'string') return false;
  try {
    const u = new URL(urlString.trim());
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

const CLOUD_METADATA_HOSTNAMES = new Set([
  'metadata.google.internal',
  'metadata.internal',
  'instance-data',
  'instance-data.ec2.internal',
  'metadata',
]);

const CLOUD_METADATA_SUFFIXES = [
  '.google.internal',
  '.ec2.internal',
  '.compute.internal',
];

/**
 * Check if an IP address string is a link-local / cloud metadata IP (e.g. 169.254.169.254)
 */
export function isCloudMetadataIP(ip: string): boolean {
  const normalized = ip.trim().toLowerCase();
  if (normalized.startsWith('169.254.') || normalized === '100.100.100.200') {
    return true;
  }
  if (normalized.startsWith('fe80:') || normalized.startsWith('::ffff:169.254.')) {
    return true;
  }
  return false;
}

/**
 * Validate SearXNG instance URL against SSRF and cloud metadata access.
 *
 * SearXNG can run locally (127.0.0.1, localhost, host.docker.internal, LAN) or on public servers,
 * but is strictly prohibited from accessing cloud metadata (169.254.169.254, 100.100.100.200, fe80::,
 * metadata.google.internal, instance-data.ec2.internal, etc.) or non-HTTP protocols.
 */
export async function validateSearxngURL(
  urlString: string,
): Promise<SSRFValidationResult> {
  if (!urlString || typeof urlString !== 'string') {
    return { valid: false, reason: 'SearXNG URL must be a non-empty string.' };
  }

  let parsed: URL;
  try {
    parsed = new URL(urlString.trim());
  } catch {
    return { valid: false, reason: 'Invalid SearXNG URL format.' };
  }

  // Enforce HTTP / HTTPS protocol only
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return {
      valid: false,
      reason: `Blocked protocol: "${parsed.protocol}". Only "http:" and "https:" are allowed for SearXNG.`,
    };
  }

  // Reject credentials in URL
  if (parsed.username || parsed.password) {
    return {
      valid: false,
      reason: 'SearXNG URL cannot contain embedded credentials.',
    };
  }

  const hostname = parsed.hostname.toLowerCase().trim();
  if (!hostname) {
    return { valid: false, reason: 'SearXNG URL must contain a valid hostname.' };
  }

  // Block cloud metadata hostnames
  if (
    CLOUD_METADATA_HOSTNAMES.has(hostname) ||
    CLOUD_METADATA_SUFFIXES.some((suffix) => hostname.endsWith(suffix))
  ) {
    return {
      valid: false,
      reason: `Access to cloud metadata hostname "${hostname}" is strictly blocked.`,
    };
  }

  const ipLiteral =
    hostname.startsWith('[') && hostname.endsWith(']')
      ? hostname.slice(1, -1)
      : hostname;

  // Block cloud metadata IPs
  if (isCloudMetadataIP(ipLiteral)) {
    return {
      valid: false,
      reason: `Access to cloud metadata IP "${ipLiteral}" is strictly blocked.`,
    };
  }

  // Resolve DNS to verify no IP resolves to cloud metadata
  if (!net.isIP(ipLiteral)) {
    try {
      const addresses = await dns.promises.lookup(hostname, { all: true });
      for (const addr of addresses) {
        if (isCloudMetadataIP(addr.address)) {
          return {
            valid: false,
            reason: `Hostname "${hostname}" resolves to cloud metadata IP "${addr.address}".`,
          };
        }
      }
    } catch (dnsErr: any) {
      // In local container environments (like custom docker network names), DNS resolution might fail on host,
      // but if hostname is not a metadata hostname/IP, allow it.
    }
  }

  return { valid: true, url: parsed };
}

/**
 * Validate a model provider's baseURL against SSRF and unauthorized network destinations.
 *
 * For local providers (e.g. Ollama, LMStudio): permits localhost, loopback, and local network IPs,
 * but strictly blocks cloud metadata (169.254.169.254, metadata.google.internal) and non-HTTP protocols.
 *
 * For cloud/public providers (e.g. OpenAI, Anthropic, Gemini, Groq, Lemonade): enforces full SSRF
 * validation ensuring the target is publicly routable and not targeting private/reserved networks.
 */
export async function validateProviderBaseURL(
  urlString: string,
  providerType?: string,
): Promise<SSRFValidationResult> {
  if (!urlString || typeof urlString !== 'string') {
    return { valid: false, reason: 'Base URL must be a non-empty string.' };
  }

  let parsed: URL;
  try {
    parsed = new URL(urlString.trim());
  } catch {
    return { valid: false, reason: 'Invalid Base URL format.' };
  }

  // Enforce HTTP / HTTPS protocol only
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return {
      valid: false,
      reason: `Blocked protocol: "${parsed.protocol}". Only "http:" and "https:" are allowed.`,
    };
  }

  // Reject credentials in URL
  if (parsed.username || parsed.password) {
    return {
      valid: false,
      reason: 'URLs with embedded user credentials are not permitted.',
    };
  }

  const hostname = parsed.hostname.toLowerCase().trim();
  if (!hostname) {
    return { valid: false, reason: 'Base URL must contain a valid hostname.' };
  }

  // Always block cloud metadata hostnames
  if (
    CLOUD_METADATA_HOSTNAMES.has(hostname) ||
    CLOUD_METADATA_SUFFIXES.some((suffix) => hostname.endsWith(suffix))
  ) {
    return {
      valid: false,
      reason: `Access to internal metadata hostname "${hostname}" is strictly blocked.`,
    };
  }

  const ipLiteral =
    hostname.startsWith('[') && hostname.endsWith(']')
      ? hostname.slice(1, -1)
      : hostname;

  // Always block link-local cloud metadata IPs
  if (isCloudMetadataIP(ipLiteral)) {
    return {
      valid: false,
      reason: `Access to cloud metadata IP address "${ipLiteral}" is strictly blocked.`,
    };
  }

  const isLocalProvider =
    providerType === 'ollama' ||
    providerType === 'lmstudio' ||
    providerType === 'local';

  if (isLocalProvider) {
    // For local providers, resolve DNS to verify it doesn't point to cloud metadata IP
    if (!net.isIP(ipLiteral)) {
      try {
        const addresses = await dns.promises.lookup(hostname, { all: true });
        for (const addr of addresses) {
          if (isCloudMetadataIP(addr.address)) {
            return {
              valid: false,
              reason: `Hostname "${hostname}" resolves to cloud metadata IP "${addr.address}".`,
            };
          }
        }
      } catch (dnsErr: any) {
        // In local environments (like host.docker.internal), DNS resolution may fail outside docker,
        // but if it is not cloud metadata it can be allowed
      }
    }
    return { valid: true, url: parsed };
  }

  // For cloud / external providers, perform full SSRF validation
  return validateUrlForSSRF(urlString);
}

