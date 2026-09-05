/**
 * Legal document configuration — the ONLY file you edit to publish these pages.
 *
 * ⚠️  Every value here is a business fact that appears verbatim in a published
 *     legal document. A document containing "TODO" is worse than no document at
 *     all, so `hasUnfilledPlaceholders()` below renders an in-page warning
 *     banner while any value still reads TODO, and Legal.test.jsx fails.
 *
 *     STATUS: filled in 2026-09-05. One thing still to do before onboarding a
 *     real school — CONTACTS and GRIEVANCE_OFFICER point at a personal Gmail
 *     account. See the note above CONTACTS.
 *
 * The version strings here are for DISPLAY ONLY. The authoritative copy — the
 * one written to School.legal when a school accepts — lives at
 * backend/src/constants/legalVersions.js. If the two drift, the backend is
 * correct by definition. When you publish an amendment, bump BOTH and copy the
 * superseded page into pages/legal/versions/.
 *
 * See specs/011-legal-terms-privacy/
 */

// ── Versions (keep in step with backend/src/constants/legalVersions.js) ───────
export const TERMS_VERSION = '1.0';
export const PRIVACY_VERSION = '1.0';
export const REFUND_VERSION = '1.0';

export const EFFECTIVE_DATE = '5 September 2026';

// ── The operating entity ─────────────────────────────────────────────────────
export const ENTITY = {
  // Sole proprietorship: in India you trade lawfully under your own legal name
  // with no incorporation. This must match the name you would sign a contract
  // under — check it against your PAN/Aadhaar spelling, not just habit.
  name: 'Amir Suhel',
  type: 'a sole proprietorship operated by an individual resident in India',
  // Renders after ENTITY.name in the documents, so it does not repeat the name.
  address: 'Village Budhma, Madhepura, Bihar 852114, India',
  productName: 'School Management System',
};

// ── Contact addresses ────────────────────────────────────────────────────────
// ⚠️ Personal Gmail, chosen deliberately for the pre-launch stage. Workable
//    while you have no real schools. Replace all five with addresses on your
//    own domain before onboarding one: a school being told to email a personal
//    gmail account for a data-protection request does not read as an operation
//    anyone is accountable for, and you cannot hand it to a successor.
export const CONTACTS = {
  support: 'amirsuhel5003@gmail.com',
  privacy: 'amirsuhel5003@gmail.com',
  billing: 'amirsuhel5003@gmail.com',
  security: 'amirsuhel5003@gmail.com',
};

// Indian intermediary rules expect a NAMED grievance contact published on the
// site; the DPDP Act requires a data-protection contact. As a sole proprietor
// you hold both roles yourself, which is fine — the requirement is that a real
// person is named, not that it is someone else.
export const GRIEVANCE_OFFICER = {
  name: 'Amir Suhel',
  email: 'amirsuhel5003@gmail.com',
};

// ── Jurisdiction ─────────────────────────────────────────────────────────────
export const JURISDICTION = {
  law: 'India',
  courts: 'Madhepura, Bihar',
};

// ── Infrastructure named in the Privacy Notice ───────────────────────────────
export const HOSTING = {
  dataRegion: 'Mumbai, India (AWS ap-south-1)',
  country: 'India',
  // From backend/.env.example — SMTP_HOST is smtp.gmail.com with a Gmail App
  // Password. If you move to a transactional provider (Resend, SES, Postmark),
  // update this and the sub-processor table renders the new name automatically.
  smtpProvider: 'Google (Gmail SMTP)',
};

// ── Commercial terms ─────────────────────────────────────────────────────────
// trialDays / trialStudentLimit / graceDays are NOT free choices — they are
// verified against backend/src/models/School.model.js (TRIAL_DURATION_DAYS,
// DEFAULT_MAX_TRIAL_STUDENTS, GRACE_DURATION_DAYS). Change the model and this
// together, or the published page contradicts the running system.
export const TERMS_VALUES = {
  trialDays: 30,
  trialStudentLimit: 50,
  graceDays: 7,
  refundWindowDays: 7,
  liabilityCapMonths: 12,
  breachNotificationHours: 72,
  subProcessorNoticeDays: 30,
  exportWindowDays: 30,
  priceChangeNoticeDays: 30,
  terminationNoticeDays: 90,
  curePeriodDays: 14,
  outageRefundHours: 72,
  refundProcessingDays: 7,
  supportResponseDays: 3,
};

/**
 * True when any TODO placeholder is still present. Used to render an in-page
 * banner in development so an unfinished document cannot be mistaken for a
 * finished one.
 */
export const hasUnfilledPlaceholders = () =>
  JSON.stringify({ ENTITY, CONTACTS, GRIEVANCE_OFFICER, JURISDICTION, HOSTING, EFFECTIVE_DATE })
    .includes('TODO');
