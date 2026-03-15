import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["dukascopy-node"],
  transpilePackages: ["@profitabledge/contracts", "@profitabledge/platform"],
};

export default nextConfig;
