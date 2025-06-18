import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  basePath: '/fastl-nnskalkulatoren',
  assetPrefix: '/fastl-nnskalkulatoren',
  images: {
    unoptimized: true
  }
};

export default nextConfig;
