import type { NextConfig } from "next";

/**
 * Backend origin only (no trailing /api/v1). Many .env files set
 * NEXT_PUBLIC_API_URL=http://host:8000/api/v1 — we strip that so rewrites
 * don't become .../api/v1/api/v1/...
 */
function normalizeBackendBaseUrl(url: string): string {
  let u = url.trim().replace(/\/$/, "");
  u = u.replace(/\/api\/v1$/i, "").replace(/\/$/, "");
  if (!u.includes("localhost") && !u.includes("127.0.0.1") && u.startsWith("http:")) {
    u = u.replace("http:", "https:");
  }
  return u;
}

/**
 * Next dev proxy + Node on Windows: connecting to "localhost" can hit ::1 while uvicorn
 * listens on IPv4 only → ECONNREFUSED. Force 127.0.0.1 for local dev hosts only.
 */
function preferLoopbackIpv4(origin: string): string {
  if (process.env.NEXT_PUBLIC_API_PROXY_IPV4 === "0") return origin.replace(/\/$/, "");
  try {
    const parsed = new URL(origin);
    if (parsed.hostname === "localhost") {
      parsed.hostname = "127.0.0.1";
      return parsed.origin;
    }
  } catch {
    /* ignore */
  }
  return origin.replace(/\/$/, "");
}

// NEXT_PUBLIC_IVEP_SAFE_API_URL is set by next.config.ts with https:// guaranteed (non-local).
// Falls back to NEXT_PUBLIC_API_URL if the build config is skipped.
const rawUrl = process.env.NEXT_PUBLIC_IVEP_SAFE_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
const safeApiUrl = preferLoopbackIpv4(normalizeBackendBaseUrl(rawUrl));

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  productionBrowserSourceMaps: false,
  env: {
    // Use a NON-conflicting valid prefix.
    // config.ts reads NEXT_PUBLIC_IVEP_SAFE_API_URL first, then falls back to NEXT_PUBLIC_API_URL.
    NEXT_PUBLIC_IVEP_SAFE_API_URL: safeApiUrl,
    NEXT_PUBLIC_STRIPE_PUBLIC_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLIC_KEY,
    NEXT_PUBLIC_DAILY_DOMAIN: process.env.NEXT_PUBLIC_DAILY_DOMAIN,
  },
  /**
   * Proxy /api/v1 to the FastAPI backend so the browser uses same-origin URLs.
   * Avoids intermittent "Failed to fetch" on PDF/large responses and strict CORS edge cases.
   */
  async rewrites() {
    const dest = safeApiUrl.replace(/\/$/, "");
    return [{ source: "/api/v1/:path*", destination: `${dest}/api/v1/:path*` }];
  },
};

export default nextConfig;