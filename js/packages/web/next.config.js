const withPlugins = require('next-compose-plugins');
const withLess = require('next-with-less');

const assetPrefix = process.env.ASSET_PREFIX || '';

const plugins = [
  [
    withLess,
    {
      lessLoaderOptions: {
        lessOptions: {
          modifyVars: {
            '@primary-color': '#768BF9',
            '@text-color': 'rgba(255, 255, 255)',
            '@assetPrefix': assetPrefix || "''",
          },
          javascriptEnabled: true,
        },
      },
    },
  ],
];

module.exports = withPlugins(plugins, {
  assetPrefix,
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  env: {
    NEXT_PUBLIC_ARWEAVE_CDN: process.env.ARWEAVE_CDN,
    NEXT_PUBLIC_STORE_OWNER_ADDRESS:
      process.env.STORE_OWNER_ADDRESS ||
      process.env.REACT_APP_STORE_OWNER_ADDRESS_ADDRESS,
    NEXT_PUBLIC_STORE_ADDRESS: process.env.STORE_ADDRESS,
    NEXT_PUBLIC_ARWEAVE_URL: process.env.NEXT_PUBLIC_ARWEAVE_URL,
    NEXT_PUBLIC_BIG_STORE: process.env.REACT_APP_BIG_STORE,
    NEXT_PUBLIC_CLIENT_ID: process.env.REACT_APP_CLIENT_ID,
    NEXT_PUBLIC_HOLAPLEX_HOLDER_PUBKEY: process.env.NEXT_PUBLIC_HOLAPLEX_HOLDER_PUBKEY,
    NEXT_PUBLIC_HOLAPLEX_HOLDER_SPLIT: process.env.NEXT_PUBLIC_HOLAPLEX_HOLDER_SPLIT,
    NEXT_PUBLIC_HOLAPLEX_HOLDER_SETUP: process.env.NEXT_PUBLIC_HOLAPLEX_HOLDER_SETUP,
    NEXT_PUBLIC_HOLAPLEX_HOLDER_SIGN_META_URL:
        process.env.NEXT_PUBLIC_HOLAPLEX_HOLDER_SIGN_META_URL,
  },
  async rewrites() {
    return [
      {
        source: '/:any*',
        destination: '/',
      },
    ];
  },
});
