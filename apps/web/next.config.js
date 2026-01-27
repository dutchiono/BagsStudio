/** @type {import('next').NextConfig} */
const path = require('path');

const nextConfig = {
    reactStrictMode: false,
    swcMinify: false, // Disable minification to debug 'N' error
    productionBrowserSourceMaps: true, // Enable maps for better logs
    output: process.env.NEXT_PUBLIC_MODE === 'coming_soon' ? 'export' : undefined,
    images: {
        unoptimized: process.env.NEXT_PUBLIC_MODE === 'coming_soon',
    },

    transpilePackages: [
        '@solana/wallet-adapter-base',
        '@solana/wallet-adapter-react',
        '@solana/wallet-adapter-react-ui',
        '@solana/wallet-adapter-wallets',
        '@solana/wallet-adapter-phantom',
        '@solana/wallet-adapter-solflare'
    ],

    typescript: {
        ignoreBuildErrors: true,
    },
    eslint: {
        ignoreDuringBuilds: true,
    },
    async rewrites() {
        return [
            {
                source: '/api/:path*',
                destination: process.env.NEXT_PUBLIC_API_URL
                    ? `${process.env.NEXT_PUBLIC_API_URL}/api/:path*`
                    : 'http://localhost:3042/api/:path*',
            },
            {
                source: '/preview/:path*',
                destination: 'http://localhost:3003/preview/:path*',
            },
            {
                source: '/:path*',
                destination: 'http://localhost:3003/:path*',
            },
        ];
    },
    webpack: (config, { isServer }) => {
        if (!isServer) {
            config.resolve.alias = {
                ...config.resolve.alias,
                'ses': false,
            };
        }
        return config;
    },
};

module.exports = nextConfig;
