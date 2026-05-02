/**
 * Calculate a percentage and return it as a fixed-2-decimal string.
 * Returns '0.00' when total is 0 to avoid division by zero.
 * @param {number} obtained
 * @param {number} total
 * @returns {string}
 */
export default function calculatePercentage(obtained, total) {
  if (!total || total === 0) return '0.00';
  return ((obtained / total) * 100).toFixed(2);
}
