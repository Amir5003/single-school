const request = require('supertest');
const app = require('../../src/app');
const { createDirectUser } = require('../helpers');

// ── Fixtures ──────────────────────────────────────────────────────────────────

const ADMIN = {
  name: 'Admin User',
  email: 'admin@school.test',
  password: 'Admin@1234',
  role: 'admin',
};

const TEACHER_DATA = {
  name: 'Mr Ahmed',
  email: 'ahmed@school.test',
  password: 'Teacher@1234',
  employeeId: 'TCH-001',
};

const CLASS_DATA = {
  name: 'Class 10A',
  grade: '10',
  section: 'A',
};

const ENTRY_BASE = {
  subject: 'Mathematics',
  day: 'Monday',
  startTime: '08:00',
  endTime: '09:00',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const registerUser = (data) =>
  request(app).post('/api/v1/auth/register').send(data);

const loginUser = async (email, password) => {
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email, password });
  return { res, cookie: res.headers['set-cookie'] };
};

const getAdminCookie = async () => {
  await createDirectUser(ADMIN);
  const { cookie } = await loginUser(ADMIN.email, ADMIN.password);
  return cookie;
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Timetable CRUD', () => {
  let cookie;
  let classId;
  let teacherId;

  beforeEach(async () => {
    cookie = await getAdminCookie();

    const tRes = await request(app)
      .post('/api/v1/admin/teachers')
      .set('Cookie', cookie)
      .send(TEACHER_DATA);
    teacherId = tRes.body.data.teacher._id;

    const cRes = await request(app)
      .post('/api/v1/admin/classes')
      .set('Cookie', cookie)
      .send(CLASS_DATA);
    classId = cRes.body.data.class._id;
  });

  /** Creates a timetable entry, merging overrides into ENTRY_BASE. */
  const createEntry = (overrides = {}) =>
    request(app)
      .post('/api/v1/admin/timetable')
      .set('Cookie', cookie)
      .send({ classId, teacherId, ...ENTRY_BASE, ...overrides });

  // ── POST /api/v1/admin/timetable ──────────────────────────────────────────

  describe('POST /api/v1/admin/timetable — create', () => {
    it('201 — creates a timetable entry', async () => {
      const res = await createEntry();
      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.entry.day).toBe('Monday');
      expect(res.body.data.entry.startTime).toBe('08:00');
      expect(res.body.data.entry.endTime).toBe('09:00');
      expect(res.body.data.entry.subject).toBe('Mathematics');
    });

    it('409 — overlapping period for same class on same day is rejected', async () => {
      await createEntry(); // Monday 08:00–09:00
      // Attempt 08:30–09:30 which overlaps
      const res = await createEntry({ startTime: '08:30', endTime: '09:30' });
      expect(res.statusCode).toBe(409);
      expect(res.body.success).toBe(false);
    });

    it('201 — adjacent (non-overlapping) period for same class on same day succeeds', async () => {
      await createEntry(); // Monday 08:00–09:00
      // 09:00–10:00 starts exactly when first ends — no overlap
      const res = await createEntry({ startTime: '09:00', endTime: '10:00' });
      expect(res.statusCode).toBe(201);
    });

    it('201 — same time slot on a different day succeeds', async () => {
      await createEntry(); // Monday 08:00–09:00
      const res = await createEntry({ day: 'Tuesday' }); // Tuesday 08:00–09:00
      expect(res.statusCode).toBe(201);
    });

    it('409 — double-booking same teacher on same time in different class is rejected', async () => {
      // Create a second class
      const c2Res = await request(app)
        .post('/api/v1/admin/classes')
        .set('Cookie', cookie)
        .send({ name: 'Class 10B', grade: '10', section: 'B' });
      const classId2 = c2Res.body.data.class._id;

      await createEntry(); // teacher in class 1, Monday 08:00–09:00

      // Same teacher, same time, different class → teacher conflict
      const res = await request(app)
        .post('/api/v1/admin/timetable')
        .set('Cookie', cookie)
        .send({ classId: classId2, teacherId, ...ENTRY_BASE });
      expect(res.statusCode).toBe(409);
    });

    it('422 — invalid day value fails validation', async () => {
      const res = await createEntry({ day: 'Sunday' });
      expect(res.statusCode).toBe(422);
    });

    it('422 — invalid time format (missing leading zero) fails validation', async () => {
      const res = await createEntry({ startTime: '8:00' });
      expect(res.statusCode).toBe(422);
    });

    it('422 — missing classId fails validation', async () => {
      const res = await request(app)
        .post('/api/v1/admin/timetable')
        .set('Cookie', cookie)
        .send({ teacherId, ...ENTRY_BASE });
      expect(res.statusCode).toBe(422);
    });
  });

  // ── GET /api/v1/admin/timetable?classId ──────────────────────────────────

  describe('GET /api/v1/admin/timetable?classId — list by class', () => {
    it('200 — returns entries sorted by day then startTime', async () => {
      await createEntry({ day: 'Wednesday', startTime: '10:00', endTime: '11:00' });
      await createEntry({ day: 'Monday', startTime: '08:00', endTime: '09:00' });

      const res = await request(app)
        .get(`/api/v1/admin/timetable?classId=${classId}`)
        .set('Cookie', cookie);
      expect(res.statusCode).toBe(200);
      expect(res.body.data.entries).toHaveLength(2);
      // Monday comes before Wednesday in DAY_ORDER
      expect(res.body.data.entries[0].day).toBe('Monday');
      expect(res.body.data.entries[1].day).toBe('Wednesday');
    });

    it('200 — returns empty array for class with no entries', async () => {
      const res = await request(app)
        .get(`/api/v1/admin/timetable?classId=${classId}`)
        .set('Cookie', cookie);
      expect(res.statusCode).toBe(200);
      expect(res.body.data.entries).toHaveLength(0);
    });
  });

  // ── PUT /api/v1/admin/timetable/:id ──────────────────────────────────────

  describe('PUT /api/v1/admin/timetable/:id — update', () => {
    it('200 — updates subject without conflict', async () => {
      const createRes = await createEntry();
      const entryId = createRes.body.data.entry._id;

      const res = await request(app)
        .put(`/api/v1/admin/timetable/${entryId}`)
        .set('Cookie', cookie)
        .send({ subject: 'Physics' });
      expect(res.statusCode).toBe(200);
      expect(res.body.data.entry.subject).toBe('Physics');
    });

    it('200 — updating only subject on same time slot excludes self from conflict check', async () => {
      const createRes = await createEntry();
      const entryId = createRes.body.data.entry._id;

      // Subject-only update keeps same time/day — must not conflict with itself
      const res = await request(app)
        .put(`/api/v1/admin/timetable/${entryId}`)
        .set('Cookie', cookie)
        .send({ subject: 'Chemistry' });
      expect(res.statusCode).toBe(200);
    });

    it('409 — moving entry introduces conflict with another entry', async () => {
      await createEntry({ startTime: '08:00', endTime: '09:00' }); // entry 1
      const e2Res = await createEntry({ startTime: '10:00', endTime: '11:00' }); // entry 2
      const entry2Id = e2Res.body.data.entry._id;

      // Move entry 2 to overlap with entry 1
      const res = await request(app)
        .put(`/api/v1/admin/timetable/${entry2Id}`)
        .set('Cookie', cookie)
        .send({ startTime: '08:30', endTime: '09:30' });
      expect(res.statusCode).toBe(409);
    });

    it('404 — updating non-existent entry returns 404', async () => {
      const res = await request(app)
        .put('/api/v1/admin/timetable/507f1f77bcf86cd799439011')
        .set('Cookie', cookie)
        .send({ subject: 'Biology' });
      expect(res.statusCode).toBe(404);
    });
  });

  // ── DELETE /api/v1/admin/timetable/:id ───────────────────────────────────

  describe('DELETE /api/v1/admin/timetable/:id — delete', () => {
    it('204 — deletes entry and returns no content', async () => {
      const createRes = await createEntry();
      const entryId = createRes.body.data.entry._id;

      const res = await request(app)
        .delete(`/api/v1/admin/timetable/${entryId}`)
        .set('Cookie', cookie);
      expect(res.statusCode).toBe(204);
    });

    it('404 — deleting non-existent entry returns 404', async () => {
      const res = await request(app)
        .delete('/api/v1/admin/timetable/507f1f77bcf86cd799439011')
        .set('Cookie', cookie);
      expect(res.statusCode).toBe(404);
    });

    it('201 — slot is available again after deletion', async () => {
      const createRes = await createEntry();
      const entryId = createRes.body.data.entry._id;

      await request(app)
        .delete(`/api/v1/admin/timetable/${entryId}`)
        .set('Cookie', cookie);

      // Re-creating the same slot should succeed
      const res = await createEntry();
      expect(res.statusCode).toBe(201);
    });
  });

  // ── Authentication & RBAC ────────────────────────────────────────────────

  describe('Authentication & RBAC guards', () => {
    it('401 — timetable requires authentication', async () => {
      const res = await request(app).get('/api/v1/admin/timetable');
      expect(res.statusCode).toBe(401);
    });
  });
});
