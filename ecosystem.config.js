module.exports = {
  apps: [{
    name: "lumenbro-node",
    script: "app.js",
    node_args: "--openssl-legacy-provider",
    env: {
      NODE_ENV: "production",
      DOTENV_CONFIG_PATH: "/var/www/lumenbro-new/.env" // Explicit path
    }
  }]
};
