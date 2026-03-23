import type { NextConfig } from "next";

// Force https:// for any non-localhost API URL at build time
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
    NEXT_PUBLIC_API_URL: safeApiUrl,
    NEXT_PUBLIC_STRIPE_PUBLIC_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLIC_KEY,
    NEXT_PUBLIC_DAILY_DOMAIN: process.env.NEXT_PUBLIC_DAILY_DOMAIN,
  },
};

export default nextConfig;
