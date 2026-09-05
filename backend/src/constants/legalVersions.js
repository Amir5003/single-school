/**
 * Published legal document versions — AUTHORITATIVE.
 *
 * These values are what get written to `School.legal` when a school accepts
 * the terms at registration. The client never sends a version string and the
 * server never reads one from the request body: a client must not be able to
 * claim it accepted a version that was never published.
 *
 * The frontend has its own copy at `frontend/src/constants/legalConfig.js`,
 * used ONLY to render "Version 1.0" in the page header. If the two ever drift,
 * this file is correct by definition.
 *
 * ── When you publish an amendment ────────────────────────────────────────────
 * 1. Bump the version here AND in frontend/src/constants/legalConfig.js
 * 2. Copy the superseded page into frontend/src/pages/legal/versions/
 *    (a recorded acceptance is worthless if the accepted text is unreachable)
 *
 * See specs/011-legal-terms-privacy/data-model.md
 */

module.exports = {
  TERMS_VERSION: '1.0',
  PRIVACY_VERSION: '1.0',
  REFUND_VERSION: '1.0',
};
