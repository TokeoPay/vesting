import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  productionBrowserSourceMaps: true,
  webpack: function (config, {}) {
    // Merge with existing experiments rather than replace them
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      layers: true,
    };

    // Explicit rule so webpack treats .wasm files as async WebAssembly modules
    config.module.rules.push({
      test: /\.wasm$/,
      type: "webassembly/async",
    });

    // The ESM build of libsodium-wrappers-sumo imports ./libsodium-sumo.mjs
    // which doesn't exist in the package. Force the CJS build instead.
    config.resolve.alias["libsodium-wrappers-sumo"] = path.resolve(
      __dirname,
      "node_modules/libsodium-wrappers-sumo/dist/modules-sumo/libsodium-wrappers.js"
    );

    return config;
  },
  async rewrites() {
    return [
      {
        source: "/kupo/:path*",
        destination: `${process.env.KUPO_PREPROD_URL}/:path*`,
      },
      {
        source: "/ogmios/:path*",
        destination: `${process.env.OGMIOS_PREPROD_URL}/:path*`,
      },
      {
        source: "/kupo-mn/:path*",
        destination: `${process.env.KUPO_MAINNET_URL}/:path*`,
      },
      {
        source: "/ogmios-mn/:path*",
        destination: `${process.env.OGMIOS_MAINNET_URL}/:path*`,
      },
    ];
  },
};

export default nextConfig;