// Jobs registry — imported by server.js after DB connect.
// Each job module exports a { start } function.
// Jobs are skipped during testing to avoid timer interference.

const feeOverdueJob = require('./feeOverdueJob');
const subscriptionLifecycleJob = require('./subscriptionLifecycleJob');

const startAll = () => {
  if (process.env.NODE_ENV === 'test') return;
  feeOverdueJob.start();
  subscriptionLifecycleJob.start();
};

module.exports = { startAll };
