const config = require('./config/env');
const app = require('./app');
const prisma = require('./utils/prisma');

const server = app.listen(config.port, () => {
  console.log(`API listening on http://localhost:${config.port}`);
});

const shutdown = () =>
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
