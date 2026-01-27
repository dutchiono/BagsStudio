/** @type {import('next').NextConfig} */
const nextConfig = {
    transpilePackages: ["@bagsscan/shared"],
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: '**',
            },
        ],
    },
};

export default nextConfig;
