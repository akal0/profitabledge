import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Ensure CommonJS deps like dukascopy-node are required at runtime on Node
  serverExternalPackages: ["dukascopy-node"],
<<<<<<< Updated upstream
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
=======
  transpilePackages: ["@profitabledge/contracts"],
>>>>>>> Stashed changes
};

export default nextConfig;
