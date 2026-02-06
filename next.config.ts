import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // output: 'export', // Removed: Post Core requires a database for Server Actions
  experimental: {
    webpackBuildWorker: false,
    workerThreads: false,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
