import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@vela/brand', '@vela/tokens'],
};

export default nextConfig;
