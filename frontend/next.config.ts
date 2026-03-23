import type { NextConfig } from "next";

// Build a guaranteed-https API URL under a new internal name (__IVEP_SAFE_API_URL)
// so it is never overridden by the platform's NEXT_PUBLIC_API_URL env var.
const rawApiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const safeApiUrl = (!rawApiUrl.includes('localhost') && !rawApiUrl.includes('127.0.0.1') && rawApiUrl.startsWith('http:'))
  ? rawApiUrl.replace('http:', 'https:')
  : rawApiUrl;

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  productionBrowserSourceMaps: false,
  env: {
    // Use a NON-NEXT_PUBLIC_ prefix so Vercel does not conflict with this.
    // config.ts reads __IVEP_SAFE_API_URL first, then falls back to NEXT_PUBLIC_API_URL.
    __IVEP_SAFE_API_URL: safeApiUrl,
    NEXT_PUBLIC_STRIPE_PUBLIC_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLIC_KEY,
    NEXT_PUBLIC_DAILY_DOMAIN: process.env.NEXT_PUBLIC_DAILY_DOMAIN,
  },
};

export default nextConfig;