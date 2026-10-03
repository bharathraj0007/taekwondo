module.exports = {
  apps: [
    {
      name: 'combatflow-taekwondo',
      script: './node_modules/.bin/tsx',
      args: 'server.ts',
      instances: 1,
      autorestart: true,
      max_restarts: 5,               // Cap process to maximum 5 restarts per hour
      restart_delay: 5000,           // Delay restart by 5 seconds on initial failure
      exp_backoff_restart_delay: 100, // Increment restart delays gradually under consecutive crash loops
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      env_development: {
        NODE_ENV: 'development',
        PORT: 3000
      }
    }
  ]
};
