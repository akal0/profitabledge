import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@profitabledge/contracts", "@profitabledge/platform"],
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next",
  webpack(config) {
    const rules = config.module.rules as Array<{
      test?: unknown;
      exclude?: RegExp;
    }>;
    const fileLoaderRule = rules.find(
      (rule) => rule?.test instanceof RegExp && rule.test.test(".svg")
    );

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
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "pbs.twimg.com" },
      { protocol: "https", hostname: "utfs.io" },
      { protocol: "https", hostname: "ufs.sh" },
    ],
  },
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
