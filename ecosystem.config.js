/**
 * PM2 Ecosystem Configuration
 * Production process management configuration
 */

module.exports = {
  apps: [
    {
      name: "confetti-api",
      script: "./src/node/server.js",
      instances: process.env.PM2_INSTANCES || "max",
      exec_mode: "cluster",
      watch: false,
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "development",
        PORT: 3000,
      },
      env_production: {
        NODE_ENV: "production",
        PORT: process.env.PORT || 3000,
      },
      error_file: "./logs/pm2-error.log",
      out_file: "./logs/pm2-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      merge_logs: true,
      autorestart: true,
      max_restarts: 10,
      min_uptime: "10s",
      listen_timeout: 10000,
      kill_timeout: 5000,
      wait_ready: true,
      shutdown_with_message: true,
    },
  ],

  deploy: {
    production: {
      user: process.env.DEPLOY_USER || "deploy",
      host: process.env.DEPLOY_HOST || "your-server.com",
      ref: "origin/main",
      repo:
        process.env.DEPLOY_REPO ||
        "git@github.com:your-org/confetti-server.git",
      path: process.env.DEPLOY_PATH || "/var/www/confetti-api",
      "post-deploy":
        "npm ci --production && pm2 reload ecosystem.config.js --env production && pm2 save",
      "pre-setup": "mkdir -p /var/www/confetti-api",
    },
    staging: {
      user: process.env.DEPLOY_USER || "deploy",
      host: process.env.STAGING_HOST || "staging-server.com",
      ref: "origin/develop",
      repo:
        process.env.DEPLOY_REPO ||
        "git@github.com:your-org/confetti-server.git",
      path: process.env.STAGING_PATH || "/var/www/confetti-api-staging",
      "post-deploy":
        "npm ci --production && pm2 reload ecosystem.config.js --env staging && pm2 save",
      "pre-setup": "mkdir -p /var/www/confetti-api-staging",
    },
  },
};
