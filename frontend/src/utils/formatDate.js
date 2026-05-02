const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/**
 * Format an ISO date string into a readable string.
 * @param {string|Date} dateStr
 * @param {'DD MMM YYYY'|'MMM YYYY'|'YYYY-MM-DD'} format
 * @returns {string}
 */
export default function formatDate(dateStr, format = 'DD MMM YYYY') {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';

  const day = String(d.getUTCDate()).padStart(2, '0');
  const month = MONTHS[d.getUTCMonth()];
  const monthNum = String(d.getUTCMonth() + 1).padStart(2, '0');
  const year = d.getUTCFullYear();

  switch (format) {
    case 'DD MMM YYYY':
      return `${day} ${month} ${year}`;
    case 'MMM YYYY':
      return `${month} ${year}`;
    case 'YYYY-MM-DD':
      return `${year}-${monthNum}-${day}`;
    default:
      return `${day} ${month} ${year}`;
  }
}
