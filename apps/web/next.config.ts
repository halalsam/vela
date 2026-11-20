import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@vela/api', '@vela/brand', '@vela/tokens', '@vela/utils'],
};

export default nextConfig;
