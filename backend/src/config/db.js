const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log(`[${new Date().toISOString()}] MongoDB connected`);
  } catch (err) {
    console.error(`[${new Date().toISOString()}] MongoDB connection error: ${err.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
