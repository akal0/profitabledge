import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["dukascopy-node"],
  transpilePackages: ["@profitabledge/contracts", "@profitabledge/platform"],
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next",
};

export default nextConfig;
