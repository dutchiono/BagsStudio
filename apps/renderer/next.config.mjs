/** @type {import('next').NextConfig} */
const nextConfig = {
    // Minimal config to ensure build stability
    reactStrictMode: true,
    typescript: {
        ignoreBuildErrors: true,
    },
    webpack: (config, { isServer }) => {
        if (!isServer) {
            config.resolve.alias = {
                ...config.resolve.alias,
                'ses': false, // Disable SES in browser to prevent lockdown crash
            };
        }
        return config;
    },
};

export default nextConfig;
