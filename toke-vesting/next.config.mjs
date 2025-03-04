/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  productionBrowserSourceMaps: true,
  webpack: function (config, {}) {
    config.experiments = {
      asyncWebAssembly: true,
      layers: true,
    };
    return config;
  },
  async rewrites() {
    return [
      {
        source: "/kupo",
        destination:
          "https://kupo16gs522exsrd2kg5u2nh.preprod-v2.kupo-m1.demeter.run",
      },
      {
        source: "/ogmios",
        destination:
          "https://ogmios10y4c4fvjh7hwu8g68fy.preprod-v6.ogmios-m1.demeter.run",
      },
      {
        source: "/kupo-mn",
        destination:
          "https://kupo1fhxasl9retdeu8gdx76.mainnet-v2.kupo-m1.demeter.run",
      },
      {
        source: "/ogmios-mn",
        destination:
          "https://ogmios1djuec990uqhtuj9qkm0.mainnet-v6.ogmios-m1.demeter.run",
      },
    ];
  },
};

export default nextConfig;