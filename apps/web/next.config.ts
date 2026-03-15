import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@profitabledge/contracts", "@profitabledge/platform"],
  async redirects() {
    return [
      {
        source: "/dashboard/backtest",
        destination: "/backtest",
        permanent: false,
      },
      {
        source: "/dashboard/backtest/:path*",
        destination: "/backtest/:path*",
        permanent: false,
      },
    ];
  },
  webpack(config) {
    const fileLoaderRule = config.module.rules.find(
      (rule: { test?: RegExp | { test: (path: string) => boolean } }) =>
        rule?.test instanceof RegExp && rule.test.test(".svg")
    ) as { exclude?: RegExp; test?: RegExp } | undefined;

    if (fileLoaderRule) {
      fileLoaderRule.exclude = /\.svg$/i;
    }

    config.module.rules.push({
      test: /\.svg$/i,
      issuer: /\.[jt]sx?$/,
      use: ["@svgr/webpack"],
    });

    return config;
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "pbs.twimg.com",
      },
      {
        protocol: "https",
        hostname: "utfs.io",
      },
    ],
  },
<<<<<<< Updated upstream
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
=======
>>>>>>> Stashed changes
  turbopack: {
    rules: {
      "*.svg": {
        loaders: ["@svgr/webpack"],
        as: "*.js",
      },
    },
  },
};

export default nextConfig;
