# Quickstart: Examination & Result Management Module

End-to-end manual smoke test for the 005 feature. Assumes the local dev environment is set up per the root README.

## Prerequisites

- MongoDB running locally or via Atlas connection string in `backend/.env`.
- `cd backend && npm install` complete.
- `cd frontend && npm install` complete (will now include `jspdf` and `jspdf-autotable`).
- A school with: 1 admin, 2 teachers (Asha, Ravi), 1 class with at least 3 students, 2 ClassTeacher rows (Asha→Math, Ravi→English).

## Steps

1. **Login as admin** → visit `/schools/<slug>/admin/exams`.
2. **Create a new exam**: name "Mid-Term", year 2026, term "Term 1", class 8A, subjects: Math (100), English (100). Save. The new row shows state badge "Draft".
3. **Activate the exam**: open the exam dashboard via "Open Dashboard". Click "Activate". Expect 0% completion, two subject rows (Math → Asha, English → Ravi) both `pending`.
4. **Login as Asha (Math teacher)** → `/schools/<slug>/teacher/my-exams`. The "Mid-Term" exam is listed with one assigned subject (Math). Click "Open".
5. **Enter marks for Math**: type values for each student (within 0..100). Click "Save Draft". The subject state moves to "Draft" in the admin dashboard (verify by switching admin tab). Click "Submit". The subject state moves to "Submitted".
6. **Repeat for Ravi (English teacher)**: login as Ravi, enter English marks, save draft, submit.
7. **Back to admin dashboard**: completion shows 100 %. The "Publish Results" button is now enabled. Click it. Confirm. The exam state changes to "Published".
8. **Login as a student in 8A** → `/schools/<slug>/student/results`. Select year 2026 → Term 1 → result cards appear with per-subject marks, total, percentage, pass/fail.
9. **Download report card**: click "Download Report Card". A PDF downloads. Open it — verify it contains: school name + logo (if uploaded), student name + enrollment ID + class, exam name + term + year, subject table with marks + totals, overall percentage, overall pass/fail.

## Negative tests (quick)

- As Asha, try to access Ravi's English submission directly (manually visit `/schools/<slug>/teacher/submissions/<englishId>`). Expect 403.
- As a student, before publish, visit `/student/results?examId=<examId>` (e.g. via dev tools). Expect 404 / no result shown.
- As admin, try to publish before all subjects are submitted. Expect 409 with blocking list.

## Tear-down

No special teardown — the test exam can be deleted via the Exams page or left in place.
