import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    viewTransition: true,
  },
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
