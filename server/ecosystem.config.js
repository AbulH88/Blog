module.exports = {
  apps: [
    {
      name: 'cristina-server',
      script: 'index.js',
      cwd: '/var/www/cristina/server',
      instances: 2,
      exec_mode: 'cluster',
      watch: false,
      max_memory_restart: '600M',
      kill_timeout: 12000,  // gives graceful shutdown 12s before SIGKILL (> server's 10s drain)
      env_production: {
        NODE_ENV: 'production',
        PORT: 5000,
      },
      error_file: '/var/log/cristina/error.log',
      out_file: '/var/log/cristina/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    },
  ],
};
