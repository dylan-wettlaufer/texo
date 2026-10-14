import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Turbopack handles .mts natively; webpack needs types stripped first.
  turbopack: {},
  webpack(config, { defaultLoaders }) {
    config.module.rules.push({
      test: /\.mts$/,
      use: [defaultLoaders.babel, path.join(process.cwd(), "scripts/webpack-mts-loader.cjs")],
    });
    return config;
  },
};

export default nextConfig;
