const ApiError = require('./ApiError');

/**
 * Build the 409 for an email address that already belongs to an account.
 *
 * A User's email is globally unique while `schoolId` pins them to exactly one
 * school, so "this email exists" and "this person is already in your school"
 * are different situations with different remedies. The old blanket message
 * ("An account with this email already exists") sent people who belong to
 * another school to the login page, where their password then failed.
 *
 * Callers that know the school in context get the precise message; public
 * callers deliberately get the vague one, so the signup form can't be used to
 * enumerate which school an address belongs to.
 *
 * @param {object|null} existingUser  The conflicting User doc (needs `schoolId`)
 * @param {object}      [opts]
 * @param {string|null} [opts.schoolId]  School in context, when the caller has one
 * @param {string}      [opts.label]     'teacher' | 'student' — for admin-facing copy
 * @param {boolean}     [opts.publicCaller]  true when the request is unauthenticated
 * @returns {ApiError}
 */
const emailConflictError = (
  existingUser,
  { schoolId = null, label = null, publicCaller = false } = {}
) => {
  const existingSchoolId = existingUser?.schoolId?._id ?? existingUser?.schoolId ?? null;
  const sameSchool =
    schoolId && existingSchoolId && String(existingSchoolId) === String(schoolId);

  let err;
  if (sameSchool) {
    err = new ApiError(
      409,
      label
        ? `A ${label} with this email already exists in your school.`
        : 'You already have an account at this school. Please sign in instead, or reset your password.'
    );
    err.code = label ? 'EMAIL_ALREADY_IN_SCHOOL' : 'EMAIL_ALREADY_REGISTERED';
    return err;
  }

  // Belongs to a different school — or we can't tell, which we treat the same
  // way so the answer doesn't reveal anything.
  err = new ApiError(
    409,
    publicCaller
      ? 'This email is already registered. An account can belong to only one school, so please use a different email address.'
      : `This email belongs to an account in another school. A person can currently have an account in only one school — please use a different email address for this ${label || 'person'}.`
  );
  err.code = 'EMAIL_REGISTERED_TO_ANOTHER_SCHOOL';
  return err;
};

module.exports = emailConflictError;
