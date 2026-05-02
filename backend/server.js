require('dotenv').config();

// Validate required env vars before anything else boots
const { PORT } = require('./src/config/env');

const connectDB = require('./src/config/db');
const app = require('./src/app');

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`[${new Date().toISOString()}] Server running on port ${PORT}`);
  });
});
