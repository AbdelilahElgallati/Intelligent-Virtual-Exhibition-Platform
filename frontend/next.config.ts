import type { NextConfig } from "next";

// Build a guaranteed-https API URL under a new internal name.
// NEXT_PUBLIC_IVEP_SAFE_API_URL is set by next.config.ts with https:// guaranteed.
// Falls back to NEXT_PUBLIC_API_URL if somehow the build config is skipped.
const rawUrl = process.env.NEXT_PUBLIC_IVEP_SAFE_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const safeApiUrl = (!rawUrl.includes('localhost') && !rawUrl.includes('127.0.0.1') && rawUrl.startsWith('http:'))
  ? rawUrl.replace('http:', 'https:')
  : rawUrl;

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
};

export default nextConfig;