const User = require('../src/models/User.model');

/**
 * Create a user directly in the database with approvalStatus:'approved' and isActive:true.
 * Password hashing is handled by the User model's pre('save') hook.
 * Use this in test beforeEach/beforeAll blocks instead of calling POST /auth/register
 * when you need the user to be immediately able to log in (bypassing the pending approval flow).
 *
 * @param {{ name, email, password, role, phone? }} data
 * @returns {Promise<User>}
 */
const createDirectUser = async (data) => {
  return User.create({
    ...data,
    approvalStatus: 'approved',
    isActive: true,
  });
};

module.exports = { createDirectUser };
