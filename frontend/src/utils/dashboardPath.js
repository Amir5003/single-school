/**
 * Build the post-login landing path for a role within a school.
 *
 * Single source of truth — this used to be copy-pasted into Login, LoginForm,
 * Home and ProtectedRoute, and the copies drifted apart.
 *
 * @param {string|null} role
 * @param {string|null} schoolSlug
 * @returns {string}
 */
export function getDashboardPath(role, schoolSlug) {
  if (role === 'super-admin') return '/platform/schools';
  if (!schoolSlug) return '/';
  const base = `/schools/${schoolSlug}`;
  if (role === 'school-admin') return `${base}/admin/dashboard`;
  if (role === 'teacher')      return `${base}/teacher/dashboard`;
  if (role === 'student')      return `${base}/student/dashboard`;
  if (role === 'parent')       return `${base}/parent/dashboard`;
  return '/';
}

/**
 * True when `path` is a school-scoped URL belonging to a school other than
 * `schoolSlug`. Used to reject a stale `from` / `redirectTo` that points at the
 * previously signed-in user's school.
 *
 * @param {string|null} path
 * @param {string|null} schoolSlug
 * @returns {boolean}
 */
export function isForeignSchoolPath(path, schoolSlug) {
  if (!path) return false;
  const match = /^\/schools\/([^/]+)/.exec(path);
  if (!match) return false;
  return match[1] !== schoolSlug;
}

export default getDashboardPath;
