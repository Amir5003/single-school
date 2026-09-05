const request = require('supertest');
const app = require('../../src/app');

// ── Helpers ───────────────────────────────────────────────────────────────────

const slugCheck = (slug) =>
  request(app).get(`/api/v1/onboarding/slug-check?slug=${slug}`);

// Registration now requires explicit acceptance of the Terms (011). These
// tests exercise slug/email/password logic, not the acceptance gate, so the
// helper supplies it by default — a caller can still override it to test the
// gate itself (see legal.acceptance.test.js).
const registerSchool = (data) =>
  request(app)
    .post('/api/v1/onboarding/register')
    .send({ acceptedTerms: true, ...data });

const loginUser = async (email, password) => {
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email, password });
  return { res, cookie: res.headers['set-cookie'] };
};

// ── Slug Check ────────────────────────────────────────────────────────────────

describe('GET /api/v1/onboarding/slug-check', () => {
  it('200 — available slug returns available: true', async () => {
    const uniqueSlug = `test-school-${Date.now()}`;
    const res = await slugCheck(uniqueSlug);
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.available).toBe(true);
    expect(res.body.data.suggestions).toHaveLength(0);
  });

  it('200 — taken slug returns available: false with suggestions', async () => {
    const slug = `taken-slug-${Date.now()}`;
    await registerSchool({
      name: 'Taken School',
      slug,
      adminEmail: `admin-taken-${Date.now()}@test.com`,
      adminPassword: 'Password1!',
    });

    const res = await slugCheck(slug);
    expect(res.statusCode).toBe(200);
    expect(res.body.data.available).toBe(false);
    expect(Array.isArray(res.body.data.suggestions)).toBe(true);
  });

  it('422 — invalid slug format is rejected', async () => {
    const res = await slugCheck('INVALID SLUG!!');
    expect(res.statusCode).toBe(422);
  });
});

// ── School Registration ───────────────────────────────────────────────────────

describe('POST /api/v1/onboarding/register', () => {
  it('201 — creates school + admin user with pending approval status', async () => {
    const uniqueId = Date.now();
    const res = await registerSchool({
      name: 'Sunrise Academy',
      slug: `sunrise-${uniqueId}`,
      adminEmail: `admin-${uniqueId}@sunrise.test`,
      adminPassword: 'Password1!',
    });

    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.school.slug).toBe(`sunrise-${uniqueId}`);
    expect(res.body.data.user.email).toBe(`admin-${uniqueId}@sunrise.test`);
    // Admin is pending approval — approvalStatus should be pending
    expect(res.body.data.user.approvalStatus).toBe('pending');
    // password must never leak
    expect(res.body.data.user.password).toBeUndefined();
  });

  it('409 — duplicate slug is rejected', async () => {
    const uniqueId = Date.now();
    const payload = {
      name: 'Dup School',
      slug: `dup-school-${uniqueId}`,
      adminEmail: `admin1-${uniqueId}@dup.test`,
      adminPassword: 'Password1!',
    };
    await registerSchool(payload);

    const res = await registerSchool({
      ...payload,
      adminEmail: `admin2-${uniqueId}@dup.test`, // different email
    });
    expect(res.statusCode).toBe(409);
  });

  it('409 — duplicate admin email is rejected', async () => {
    const uniqueId = Date.now();
    const payload = {
      name: 'Dup Email School',
      slug: `dup-email-${uniqueId}`,
      adminEmail: `shared-${uniqueId}@dup.test`,
      adminPassword: 'Password1!',
    };
    await registerSchool(payload);

    const res = await registerSchool({
      ...payload,
      slug: `dup-email-${uniqueId}-2`, // different slug
    });
    expect(res.statusCode).toBe(409);
  });

  it('422 — missing required fields are rejected', async () => {
    const res = await registerSchool({ name: 'Incomplete School' });
    expect(res.statusCode).toBe(422);
  });

  it('422 — weak password is rejected', async () => {
    const uniqueId = Date.now();
    const res = await registerSchool({
      name: 'Weak Pass School',
      slug: `weak-${uniqueId}`,
      adminEmail: `admin-${uniqueId}@weak.test`,
      adminPassword: 'password', // no uppercase, no digit
    });
    expect(res.statusCode).toBe(422);
  });
});

// ── Full Onboarding Flow ──────────────────────────────────────────────────────

describe('Full onboarding flow', () => {
  it('registers school → admin is pending approval → login returns 403 → public config endpoint works', async () => {
    const uniqueId = Date.now();
    const slug = `flow-school-${uniqueId}`;
    const email = `admin-${uniqueId}@flow.test`;
    const password = 'Password1!';

    // 1. Register — admin and school are created with pending approval
    const regRes = await registerSchool({
      name: 'Flow School',
      slug,
      adminEmail: email,
      adminPassword: password,
    });
    expect(regRes.statusCode).toBe(201);
    expect(regRes.body.data.user.approvalStatus).toBe('pending');
    expect(regRes.body.data.school._id).toBeDefined();

    // 2. Direct login must return 403 (pending super-admin approval)
    const { res: loginRes } = await loginUser(email, password);
    expect(loginRes.statusCode).toBe(403);
    expect(loginRes.body.message).toMatch(/pending/i);

    // 3. Public school config endpoint still resolves the slug (school exists, just inactive)
    const configRes = await request(app).get(`/api/v1/public/schools/${slug}/config`);
    expect(configRes.statusCode).toBe(200);
    expect(configRes.body.data.school.slug).toBe(slug);
    expect(configRes.body.data.school.branding).toBeDefined();
    // School is inactive until super-admin approves
    expect(configRes.body.data.school.isActive).toBe(false);
  });
});

// ── Public School Config ──────────────────────────────────────────────────────

describe('GET /api/v1/public/schools/:slug/config', () => {
  it('404 — unknown slug returns not found', async () => {
    const res = await request(app).get('/api/v1/public/schools/no-such-school-xyz/config');
    expect(res.statusCode).toBe(404);
  });

  it('200 — known slug returns school name + branding', async () => {
    const uniqueId = Date.now();
    const slug = `config-test-${uniqueId}`;
    await registerSchool({
      name: 'Config Test School',
      slug,
      adminEmail: `admin-${uniqueId}@config.test`,
      adminPassword: 'Password1!',
    });

    const res = await request(app).get(`/api/v1/public/schools/${slug}/config`);
    expect(res.statusCode).toBe(200);
    expect(res.body.data.school.name).toBe('Config Test School');
    expect(res.body.data.school.slug).toBe(slug);
  });
});
