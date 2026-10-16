// SSRF guard for routes that fetch user-supplied URLs server-side
// (lib/link-preview). Before this, link-preview would fetch any http(s) URL,
// including loopback (127.0.0.1), link-local / cloud-metadata (169.254.0.0/16)
// and private-range hosts, letting an authenticated user probe internal
// services (SSRF-001). This blocks those targets up front AND re-validates
// every redirect hop, so a public URL can't 3xx the server onto an internal
// host.
import { isIP } from "node:net";

const BLOCKED_HOSTNAMES = new Set(["localhost", "ip6-localhost", "ip6-loopback"]);

// Hostname suffixes that never point at the public internet.
const BLOCKED_SUFFIXES = [".localhost", ".local", ".internal", ".intranet", ".lan"];

function ipv4ToParts(ip: string): number[] | null {
  const parts = ip.split(".").map((p) => Number(p));
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return null;
  }
  return parts;
}

// Covers loopback, RFC1918 private, link-local (incl. 169.254 metadata),
// CGNAT, "this host", and broadcast.
function isPrivateIpv4(ip: string): boolean {
  const p = ipv4ToParts(ip);
  if (!p) return false;
  const [a, b] = p;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64/10
  if (a === 255 && b === 255) return true;
  return false;
}

function isPrivateIpv6(ip: string): boolean {
  const lower = ip.toLowerCase().replace(/^\[|\]$/g, "");
  if (lower === "::1" || lower === "::") return true;
  if (lower.startsWith("fe80")) return true; // link-local
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // unique-local fc00::/7
  // IPv4-mapped (::ffff:127.0.0.1) — validate the embedded v4.
  const mapped = lower.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateIpv4(mapped[1]);
  return false;
}

function isPrivateIp(ip: string): boolean {
  const kind = isIP(ip);
  if (kind === 4) return isPrivateIpv4(ip);
  if (kind === 6) return isPrivateIpv6(ip);
  return false;
}

// Resolves a hostname and returns true only if it is safe to fetch: a public
// http(s) host whose every resolved address is outside private/loopback/
// link-local ranges. DNS resolution closes the rebinding hole where a public
// name is pointed at an internal IP.
export async function isPublicHttpUrl(target: URL): Promise<boolean> {
  if (target.protocol !== "http:" && target.protocol !== "https:") return false;

  const host = target.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!host) return false;
  if (BLOCKED_HOSTNAMES.has(host)) return false;
  if (BLOCKED_SUFFIXES.some((suffix) => host.endsWith(suffix))) return false;

  // A literal IP: check it directly, no DNS needed.
  if (isIP(host)) return !isPrivateIp(host);

  const dns = await import("node:dns/promises");
  try {
    const records = await dns.lookup(host, { all: true });
    if (records.length === 0) return false;
    return records.every((r) => !isPrivateIp(r.address));
  } catch {
    // Can't resolve → can't confirm it's public → don't fetch it.
    return false;
  }
}

const MAX_REDIRECTS = 4;

// fetch() that refuses internal targets and re-validates each redirect hop,
// so a public URL can't bounce the request onto a private host. Returns the
// final Response, or null if any hop is unsafe / the chain is too long.
export async function safeFetch(
  input: string | URL,
  init: RequestInit = {},
): Promise<Response | null> {
  let current = new URL(typeof input === "string" ? input : input.toString());

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (!(await isPublicHttpUrl(current))) return null;

    const response = await fetch(current, { ...init, redirect: "manual" });

    // Not a redirect — this is the final response.
    if (response.status < 300 || response.status >= 400) return response;

    const location = response.headers.get("location");
    if (!location) return response;
    current = new URL(location, current);
  }

  return null; // too many redirects
}
