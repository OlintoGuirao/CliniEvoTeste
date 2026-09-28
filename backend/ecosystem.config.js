module.exports = {
  apps: [
    {
      name: 'aura-secretaria-backend',
      script: 'server.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'production',
        PORT: process.env.PORT || 4000,
      },
      error_file: './data/logs/backend-error.log',
      out_file: './data/logs/backend-out.log',
      merge_logs: true,
      time: true,
    },
  ],
};
