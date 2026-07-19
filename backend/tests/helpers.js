const jwt = require('jsonwebtoken');
const User = require('../src/models/User.model');
const School = require('../src/models/School.model');
const Student = require('../src/models/Student.model');
const Teacher = require('../src/models/Teacher.model');

/**
 * Create a user directly in the database with approvalStatus:'approved' and isActive:true.
 * Password hashing is handled by the User model's pre('save') hook.
 *
 * @param {{ name, email, password, role, phone?, schoolId? }} data
 * @returns {Promise<User>}
 */
const createDirectUser = async (data) => {
  return User.create({
    ...data,
    approvalStatus: 'approved',
    isActive: true,
  });
};

/**
 * Create a School document with isActive:true.
 *
 * @param {object} overrides - Optional field overrides
 * @returns {Promise<School>}
 */
const createSchool = async (overrides = {}) => {
  const suffix = Math.random().toString(36).slice(2, 8);
  return School.create({
    name: overrides.name || `Test School ${suffix}`,
    slug: overrides.slug || `test-school-${suffix}`,
    isActive: overrides.isActive !== undefined ? overrides.isActive : true,
    plan: overrides.plan || 'free',
    slugLockedAt: new Date(),
    branding: {},
    ...overrides,
  });
};

/**
 * Create a school-admin User for a given school.
 *
 * @param {string} schoolId
 * @param {object} overrides
 * @returns {Promise<User>}
 */
const createSchoolAdmin = async (schoolId, overrides = {}) => {
  const suffix = Math.random().toString(36).slice(2, 8);
  return User.create({
    name: overrides.name || `School Admin ${suffix}`,
    email: overrides.email || `admin-${suffix}@school.test`,
    password: overrides.password || 'Password1',
    role: 'school-admin',
    schoolId,
    approvalStatus: 'approved',
    isActive: true,
    ...overrides,
  });
};

/**
 * Create a Teacher User for a given school.
 *
 * @param {string} schoolId
 * @param {object} overrides
 * @returns {Promise<User>}
 */
const createTeacher = async (schoolId, overrides = {}) => {
  const suffix = Math.random().toString(36).slice(2, 8);
  const user = await User.create({
    name: overrides.name || `Teacher ${suffix}`,
    email: overrides.email || `teacher-${suffix}@school.test`,
    password: overrides.password || 'Password1',
    role: 'teacher',
    schoolId,
    approvalStatus: 'approved',
    isActive: true,
  });

  const teacher = await Teacher.create({
    userId: user._id,
    schoolId,
    employeeId: overrides.employeeId || `EMP-${suffix}`,
    subject: overrides.subject || 'General',
    ...overrides.teacherFields,
  });

  return { user, teacher };
};

/**
 * Create a Student User for a given school.
 *
 * @param {string} schoolId
 * @param {string} classId
 * @param {object} overrides
 * @returns {Promise<{ user, student }>}
 */
const createStudent = async (schoolId, classId, overrides = {}) => {
  const suffix = Math.random().toString(36).slice(2, 8);
  const user = await User.create({
    name: overrides.name || `Student ${suffix}`,
    email: overrides.email || `student-${suffix}@school.test`,
    password: overrides.password || 'Password1',
    role: 'student',
    schoolId,
    approvalStatus: 'approved',
    isActive: true,
  });

  const student = await Student.create({
    userId: user._id,
    schoolId,
    classId,
    enrollmentId: overrides.enrollmentId || `STU-${suffix}`,
    dateOfBirth: overrides.dateOfBirth || '2012-01-15',
    ...overrides.studentFields,
  });

  return { user, student };
};

/**
 * Generate an auth cookie string embedding schoolId in the JWT.
 *
 * @param {{ _id, role, schoolId }} user
 * @returns {string} cookie header value for supertest
 */
const getAuthCookies = (user) => {
  const accessToken = jwt.sign(
    { id: user._id, role: user.role, schoolId: user.schoolId || null },
    process.env.JWT_SECRET || 'test-secret',
    { expiresIn: '15m' }
  );
  return `token=${accessToken}`;
};

/**
 * Overwrite a user's password with a known value and clear the forced
 * password change. The admin teacher-creation API ignores any provided
 * password and emails a random temp one (see teacher.service.js), so tests
 * that log in as API-created users must reset the password first.
 * `doc.save()` triggers the pre('save') bcrypt hash.
 *
 * @param {string} email
 * @param {string} password
 * @returns {Promise<User>}
 */
const setKnownPassword = async (email, password) => {
  const user = await User.findOne({ email });
  if (!user) throw new Error(`setKnownPassword: no user with email ${email}`);
  user.password = password;
  user.mustChangePassword = false;
  await user.save();
  return user;
};

module.exports = {
  createDirectUser,
  createSchool,
  createSchoolAdmin,
  createTeacher,
  createStudent,
  getAuthCookies,
  setKnownPassword,
};

