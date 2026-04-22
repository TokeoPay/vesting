import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  productionBrowserSourceMaps: true,
  transpilePackages: ["@evolution-sdk/lucid", "@evolution-sdk/provider", "@evolution-sdk/uplc"],
  webpack: function (config, { isServer }) {
    // Merge with existing experiments rather than replace them
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      syncWebAssembly: true,
      layers: true,
    };

    // Handle WASM files from @evolution-sdk/uplc
    // Push rule to the beginning for priority
    config.module.rules.unshift({
      test: /\.wasm$/,
      type: "webassembly/async",
    });

    // The ESM build of libsodium-wrappers-sumo imports ./libsodium-sumo.mjs
    // which doesn't exist in the package. Force the CJS build instead.
    config.resolve.alias["libsodium-wrappers-sumo"] = path.resolve(
      __dirname,
      "node_modules/libsodium-wrappers-sumo/dist/modules-sumo/libsodium-wrappers.js"
    );

    // Ensure WASM files are loaded from the correct location
    config.output.webassemblyModuleFilename = "static/wasm/[modulehash].wasm";

    return config;
  },
  // Note: Kupmios/Ogmios rewrites removed - now using BlockFrost via /api/bf proxy
  // async rewrites() {
  //   return [];
  // },
};

export default nextConfig;