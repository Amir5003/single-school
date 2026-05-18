require('dotenv').config();

// Validate required env vars before anything else boots
const { PORT } = require('./src/config/env');

const connectDB = require('./src/config/db');
const app = require('./src/app');
const jobs = require('./src/jobs/index');

connectDB().then(() => {
  jobs.startAll();
  app.listen(PORT, () => {
    console.log(`[${new Date().toISOString()}] Server running on port ${PORT}`);
  });
});
