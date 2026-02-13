import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  // Optimize for Vercel serverless
  swcMinify: true,
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
  // Ensure API routes are properly bundled
  webpack: (config) => {
    config.optimization.minimize = true;
    return config;
  },
};

export default nextConfig;
