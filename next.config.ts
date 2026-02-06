import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  images: {
    unoptimized: true,
  },
  experimental: {
    webpackBuildWorker: false,
    workerThreads: false,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
