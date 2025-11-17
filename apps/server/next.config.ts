import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Ensure CommonJS deps like dukascopy-node are required at runtime on Node
  serverExternalPackages: ["dukascopy-node"],
};

export default nextConfig;
