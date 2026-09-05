# Feature Specification: Legal Terms, Privacy Notice & Data-Subject Notice Delivery

**Feature Branch**: `011-legal-terms-privacy`
**Created**: 2026-09-05
**Status**: Specified — not started. **Phase 0 is blocking and is not an engineering task.**
**Input**: "in this project i do not have any legal terms and condition page so by the time admin signing up we should have some terms and conditions?" · "assuming admin directly creates student and teacher may be can ask for emails and we plan to use so that is a kind of personal thing but still we need and admin is the one who is using so if without info to user if admin does this is not a good thing" · "suggest me a place also where to add those only during admin sign up or where?"

---

## Overview

The platform holds the personal data of children — name, email, date of birth, home address, attendance, marks, fee records — and every one of those records is created by a **school administrator acting on behalf of someone who was never asked and is never told**. `createStudent` writes a `User` and a `Student`, then emails a temporary password to an address the admin typed in. The person receiving that email has, at present, no way to find out what is held about them, who holds it, or how to get it corrected.

There is no Terms of Service, no Privacy Notice, and no acceptance record anywhere in the codebase.

This feature closes that gap. It is **not** primarily a "add a checkbox at signup" feature — that is one of six placements and the least important of them.

---

## The core distinction: consent vs. notice

The instinct behind the request was that the admin should somehow obtain consent. **Consent is the wrong instrument and should not be built.**

- Consent must be freely given by the person the data is about. A student cannot meaningfully refuse to appear on their school's attendance register, so consent collected for that would be fictional.
- The person clicking any checkbox in the admin panel is the *admin*, not the student. One person consenting on another's behalf is theatre, and building a compliance story on it is worse than building nothing.
- Schools already have lawful grounds: the enrolment contract, statutory duties around attendance and assessment records, and legitimate educational interest. Those grounds are the school's, and they are solid.

What no lawful ground ever removes is the duty to **tell people**. That is what is missing, and that is what this feature delivers, in three parts:

| Part | Mechanism | Who it protects |
|---|---|---|
| A contractual warranty from the school that it has a lawful basis and has informed the family | Terms of Service clause 6, accepted at signup and recorded | The platform |
| Notice delivered to the End User directly, at first contact | Temp-password email + first-login panel | The student / teacher |
| A standing statement of responsibility inside the admin flow | Create-student form notice + one-time admin acknowledgement | Both |

---

## The role split — the structural decision everything hangs off

| | School | Platform |
|---|---|---|
| **Role** | Data Fiduciary (DPDP Act 2023) / Controller (GDPR) | Data Processor |
| **Decides** | Which students to enrol, which fields to fill, who gets a teacher login, how long to keep records | How data is stored, secured, isolated per tenant, backed up |
| **Owes** | Lawful basis, notice to families, parental consent where required, accuracy, removing leavers | Security, breach notification, sub-processor transparency, deletion on exit, assistance with rights requests |

Getting this wrong means silently assuming legal responsibility for the lawfulness of data the platform never chose to collect, entered by people it has never met, about children it has no relationship with. Processor status is not evasion — it is a narrower and more honest description of what the platform actually does, and it comes with real duties in return (FR-007 to FR-011).

> ⚠️ **`Student.model.js` makes `dateOfBirth` a required field.** The system therefore always knows a student is a minor. DPDP §9 requires verifiable parental consent before processing a child's data and bars tracking or behavioural advertising directed at children; the DPDP Rules carve out educational institutions acting for a child's welfare. **The scope of that carve-out is a question for a lawyer, not for this spec.** Obtaining parental consent is the school's obligation either way — the Terms must say so explicitly (FR-006d) and the product must not make it harder.

---

## Findings from the current codebase

| Finding | Where | Consequence for this feature |
|---|---|---|
| No third-party tracking of any kind — no Google Analytics, Sentry, Meta pixel, or ad SDK | verified across `frontend/src`, `frontend/index.html`, `backend/src` | The Privacy Notice can state truthfully, in one line, that a product used by children runs no tracking or advertising. **This is a strong position and must not be quietly given up** — adding an analytics SDK later invalidates published text. |
| Only cookies are the httpOnly `token` and `refreshToken` | `auth.controller.js:7`, `onboarding.controller.js:8` | Strictly-necessary only. No cookie banner is required and none should be added. |
| Passwords stored as bcrypt hashes, rounds = 12 | `User.model.js` pre-save hook | The security section of the Privacy Notice can be specific rather than vague. |
| `mustChangePassword: true` is set on every admin-created student and teacher | `student.service.js:74`, `teacher.service.js:60` | **Every** admin-created account is forced through `ChangePassword.jsx`. This is the single moment the platform can be certain the End User themselves is reading. Highest-leverage placement in the feature. |
| `sendTempPassword` is the End User's first contact and explains nothing about data | `email.service.js:10-36` | Two sentences and a link convert it into genuine first-contact notice. |
| Soft deletes (`isDeleted`) exist on Student, Teacher, Result, Homework, Exam, Assessment, Announcement — **nothing ever purges them** | all models; no purge job | A published retention promise would be false on day one. See "Two promises the code does not keep". |
| There is no data-export endpoint | no route in `admin.routes.js` | Same. |
| Both signup paths (`Onboarding.jsx`, `Register.jsx` school-admin branch) call the same `POST /api/v1/onboarding/register` | `onboarding.api.js` | One server-side gate covers both. Do not build two. |
| A daily `node-cron` job already exists (`feeOverdueJob`, 01:00) | per README | The retention purge follows an established pattern rather than introducing one. |

---

## Two promises the code does not keep

These are the only genuinely risky part of this feature, and they are risky in a direction that is easy to miss: **a published policy is a representation about the product.** Promising a 30-day purge and a data export while shipping neither is materially worse than promising less.

1. **Retention.** The drafted Terms clause 13.2 says a soft-deleted record is permanently removed after 30 days. Today `isDeleted: true` is terminal — the document lives forever.
2. **Export.** Clause 7.6 promises School Data is exportable for 30 days after termination. No export endpoint exists.

Each has exactly two acceptable resolutions, and "publish it and build it later" is not one of them:

- **Build it** — T-027 (purge job) and T-028 (export endpoint), or
- **Soften the published wording** to describe the system as it actually stands, and tighten it when the capability lands.

This decision is forced at **T-002** and blocks the documents going live.

---

## Scope

### In scope

- Three published documents: Terms of Service, Privacy Notice, Refund & Cancellation Policy.
- Public, unauthenticated routes for each, plus a stable archive URL per version.
- Server-enforced acceptance at school registration, with a durable acceptance record.
- Notice delivery at four End-User touchpoints (temp-password email, first login, create-student form, admin acknowledgement).
- A billing acknowledgement at checkout.
- Whichever of {purge job, export endpoint} the T-002 decision requires.

### Out of scope

- **A cookie consent banner.** Strictly-necessary cookies only; a banner would be noise implying a choice that does not exist.
- **Per-End-User consent capture.** See "consent vs. notice" — deliberately not built.
- **A DPA signable per school.** The processor obligations live in Terms clauses 6–7. A separate negotiated DPA is a sales artefact for large institutions, not a product feature.
- **Localisation of legal text.** English only.
- **Age-gating or parental-consent workflows inside the product.** Parental consent is the school's obligation, discharged outside this system. Revisit only if legal review says otherwise.
- **Re-consent flows for version 2.0 of the documents.** The schema records a version string so this is *possible* later (T-018); the flow itself is deferred.

---

## Functional Requirements

### Published documents

- **FR-001**: Terms of Service, Privacy Notice and Refund & Cancellation Policy MUST be reachable without authentication and without a school context.
- **FR-002**: Each document MUST carry a version string and an effective date rendered on the page.
- **FR-003**: Every published version MUST remain reachable at a stable URL after it is superseded, so a recorded acceptance always points at readable text.
- **FR-004**: The Privacy Notice MUST enumerate the actual data categories in the schema, the actual sub-processors, and the actual security measures. Aspirational text is a defect.
- **FR-005**: Both public footers (`Home.jsx`, `SchoolLanding.jsx`) MUST link to all three.

### School acceptance

- **FR-006**: `POST /api/v1/onboarding/register` MUST reject a registration that does not carry explicit acceptance, with `400`. A disabled submit button is not enforcement.
- **FR-006b**: The acceptance record MUST capture the version, timestamp, accepting user and source IP, and MUST be written in the same transaction as the School document, so a workspace cannot exist without one.
- **FR-006c**: The recorded version MUST be taken from a server-side constant, never from the request body — a client must not be able to claim it accepted a version that was never published.
- **FR-006d**: The Terms MUST place the lawful-basis, notice and parental-consent obligations on the school explicitly, with an indemnity.
- **FR-006e**: The acceptance checkbox MUST NOT be pre-ticked.

### Notice to End Users

- **FR-007**: The temporary-password email MUST name the school that created the account, state what is held and why, link to the Privacy Notice, and tell the recipient what to do if they were not expecting it.
- **FR-008**: The forced password-change screen MUST show a notice panel naming the school and the data categories held, and MUST link to the Privacy Notice.
- **FR-009**: Acknowledgement of FR-008 MUST be recorded on the User.
- **FR-010**: The create-student and create-teacher forms MUST carry a standing notice that an account will be created and credentials emailed.
- **FR-011**: An administrator MUST acknowledge, once, that their school has a lawful basis and has informed the people concerned. Once per administrator — **not** per record created.

### Billing

- **FR-012**: Checkout MUST require acknowledgement of auto-renewal and the Refund Policy, separately from the signup acceptance, which may be months old.

### Non-functional

- **NFR-001**: Public legal routes MUST NOT require a school context, MUST NOT hit `schoolScope`, and MUST render for a logged-out visitor with no network dependency on the API.
- **NFR-002**: No new third-party script, font host or analytics may be introduced. The "no tracking" claim in the Privacy Notice depends on it.
- **NFR-003**: Legal pages MUST be readable on mobile and MUST honour `prefers-reduced-motion` (Constitution VII).

---

## Deliberate deviations from the constitution

- **Multi-tenancy (VIII).** The legal routes are platform-level and sit at `/terms`, `/privacy`, `/refunds` — **not** under `/schools/:slug/`. This is correct: the documents describe the platform operator's obligations and are identical for every tenant. Serving them per-slug would imply each school has its own terms, which is false, and would make them unreachable to a visitor who does not know a slug. `slugToSchool` does not apply. Recorded in `plan.md` → Complexity Tracking.
- **Testing (II).** The legal documents themselves are static content and are not unit-testable in any meaningful sense. Test coverage targets the *mechanisms*: server-side acceptance enforcement, the acceptance record, notice acknowledgement, and route reachability without auth.

---

## Verification Gap — read before closing this feature

**What engineering can prove**: the routes render unauthenticated, registration is rejected without acceptance, the acceptance record is written transactionally and cannot be forged, the notice appears on first login and is recorded, the emails contain the notice text.

**What engineering cannot prove**: that the documents are legally sufficient in the jurisdiction the business operates in. That requires a qualified lawyer, and the drafts were not written by one.

This feature is **not done when the tests pass**. It is done when a lawyer has reviewed the text and every placeholder has a real value. Both are Phase 0, and Phase 0 is the critical path — see `tasks.md`.

---

## Deferred Scope

- **Re-acceptance on a new document version.** Schema supports detecting it (`termsVersion` mismatch); the prompt flow is not built. Needed before the first material amendment ships.
- **A negotiated DPA and security questionnaire pack.** Will be demanded by the first large institutional buyer. Not a blocker for launch.
- **Sub-processor change notification.** Clause 7.3 promises 30 days' notice before adding a sub-processor. Currently a manual, human process — acceptable at this scale, but there is no mailing mechanism for it.
- **Automated retention of technical logs.** The Privacy Notice describes request and error logs; their retention is whatever the hosting providers default to, which is neither chosen nor documented.
