/** @type {import('next').NextConfig} */
const path = require('path');

const nextConfig = {
    reactStrictMode: false,
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
};

module.exports = nextConfig;
