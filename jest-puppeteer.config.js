module.exports = {
  launch: {
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    slowMo: 0,
  },
  server: {
    command: 'npm start',
    port: 3000,
    launchTimeout: 60000,
    debug: false,
  },
};
