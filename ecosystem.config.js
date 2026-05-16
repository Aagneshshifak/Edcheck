// =============================================================================
// ecosystem.config.js — PM2 process manager config for Edcheck backend
//
// Usage:
//   Start:   pm2 start ecosystem.config.js --env production
//   Reload:  pm2 reload edcheck-backend --update-env
//   Stop:    pm2 stop edcheck-backend
//   Delete:  pm2 delete edcheck-backend
//   Logs:    pm2 logs edcheck-backend
//   Monitor: pm2 monit
// =============================================================================

module.exports = {
    apps: [
        {
            // ── Identity ──────────────────────────────────────────────────────
            name:   "edcheck-backend",
            script: "index.js",
            cwd:    "./backend",          // run from the backend directory

            // ── Instances & clustering ────────────────────────────────────────
            instances: 1,                 // single instance (scale up if needed)
            exec_mode: "fork",            // use "cluster" if instances > 1

            // ── Restart policy ────────────────────────────────────────────────
            autorestart:        true,     // restart on crash
            watch:              false,    // do NOT watch files in production
            max_memory_restart: "512M",   // restart if memory exceeds 512 MB

            // ── Logging ───────────────────────────────────────────────────────
            out_file:    "./logs/pm2-out.log",
            error_file:  "./logs/pm2-error.log",
            merge_logs:  true,
            log_date_format: "YYYY-MM-DD HH:mm:ss Z",

            // ── Environment: development ──────────────────────────────────────
            env: {
                NODE_ENV: "development",
                PORT:     5001,
            },

            // ── Environment: production ───────────────────────────────────────
            // Activated with: pm2 start ecosystem.config.js --env production
            env_production: {
                NODE_ENV: "production",
                PORT:     5001,
            },
        },
    ],
};
