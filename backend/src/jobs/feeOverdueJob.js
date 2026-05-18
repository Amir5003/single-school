const cron = require('node-cron');
const School = require('../models/School.model');
const feeService = require('../services/fee.service');
const logger = require('../utils/logger');

/**
 * feeOverdueJob
 *
 * Runs daily at 01:00 server time.
 * For every active school, bulk-transitions fee records from 'pending' to
 * 'overdue' where the dueDate is in the past.
 */
const start = () => {
  cron.schedule('0 1 * * *', async () => {
    logger.info('[feeOverdueJob] Starting overdue fee transition');
    try {
      const activeSchools = await School.find({ isActive: true }).select('_id').lean();
      let totalUpdated = 0;

      for (const school of activeSchools) {
        const count = await feeService.transitionOverdue(school._id);
        if (count > 0) {
          logger.info(`[feeOverdueJob] School ${school._id}: ${count} fee(s) transitioned to overdue`);
        }
        totalUpdated += count;
      }

      logger.info(`[feeOverdueJob] Done — ${totalUpdated} total record(s) updated`);
    } catch (err) {
      logger.error('[feeOverdueJob] Error during overdue transition', err);
    }
  });

  logger.info('[feeOverdueJob] Scheduled — runs daily at 01:00');
};

module.exports = { start };
