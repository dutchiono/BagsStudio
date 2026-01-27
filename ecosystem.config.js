module.exports = {
    apps: [
        // Scanner removed
        {
            name: "bagsscan-agent",
            script: "npm",
            args: "start --workspace=@bagsscan/agent",
            env: {
                NODE_ENV: "production",
                ENV_PATH: "/var/www/bagsscan/.env"
            }
        },
        {
            name: "bagsscan-web",
            script: "npm",
            args: "start --workspace=@bagsscan/web",
            env_file: "/var/www/bagsscan/.env", // Absolute path
            env: {
                PORT: 3040,
                NODE_ENV: "production"
            }
        }
    ]
};
