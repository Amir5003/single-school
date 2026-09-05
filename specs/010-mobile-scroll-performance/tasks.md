# Tasks: Mobile Scroll Responsiveness & Browser-Chrome Safe Area

**Branch**: `010-mobile-scroll-performance` | **Date**: 2026-09-04
**Spec**: [spec.md](./spec.md)

No `plan.md`, `data-model.md` or `contracts/` for this feature: it changes no schema, no API surface and no backend code. The whole diff is CSS, one Tailwind class swap per card component, and one animation constant.

`[P]` = parallelisable with its siblings.

**The critical path is Phase 1.** Everything already implemented rests on reasoning that *cannot be tested on a desktop* — see the Verification Gap in the spec. Do not close this feature on a green local build.

---

## Phase 0 — Implemented (2026-09-04)

- [x] **T-000a**: Shell height — `h-screen` → `.app-shell` with `100vh` fallback and `@supports (height: 100dvh)`. `Layout.jsx:40`, `index.css:28-38`.
- [x] **T-000b**: `overscroll-contain` on the scroll pane so a flick reaching the end does not chain to the document and rubber-band the shell. `Layout.jsx:54`.
- [x] **T-000c**: `viewport-fit=cover` + `.pb-safe` on the scroller and the two public footers. `index.html:6`, `index.css:43-52`.
- [x] **T-000d**: `staggerChildren` `0.1` → `0.04`. `animationVariants.js:21`.
- [x] **T-000e**: Removed no-op `backdrop-filter` from eight student list-card surfaces; kept it on modals, gradient landing pages, and the sticky settings bar.

Regression check for any future edit here:
```bash
cd frontend && npx vite build
CSS=$(ls -t dist/assets/*.css | head -1)
grep -o "\.app-shell{[^}]*}" $CSS            # expect BOTH: height:100vh and height:100dvh
grep -o "@supports (height:100dvh){[^}]*}" $CSS
```
If only `height:100dvh` appears, the fallback was minified away and iOS < 15.4 will render a collapsed shell.

---

## Phase 1 — Device verification (blocking; nothing below is worth doing first)

- [x] **T-001** `[P]`: **Android — the reported symptom.** ✅ **Closed 2026-09-05: not reproducible.**

  The tester found scrolling normal **with none of this branch deployed**. The outcome table below anticipated three results; the actual one was a fourth — *the symptom went away on its own* — which invalidates the diagnosis rather than confirming or refuting the fix.

  | Outcome | Meaning | Next |
  |---|---|---|
  | Fixed | Causes 2+3 were it | Close feature; mark T-004/T-005 deferred |
  | Better, still laggy at first | Animation cost remains dominant | Do **T-004** |
  | Unchanged | Diagnosis is wrong — do not keep guessing | Do **T-002** before touching more code |
  | ✅ *Actual:* gone without the fix | Diagnosis unfalsifiable from source; symptom was environmental | Treat as **data-loading latency** until measured otherwise |

  Consequence: **T-004 and T-005 have no trigger** and must not be started on the strength of the original reasoning. If the symptom returns, start at T-002 — and add the network waterfall, which the first pass never looked at.

- [ ] **T-002** `[P]`: **Android — measure, do not infer.** Only if the symptom **returns**. Do not run speculatively. Chrome DevTools → `chrome://inspect` → Performance, record while entering the page and scrolling immediately.

  Read off: long tasks during the first second; whether frames are dropped in Scripting (JS/animation) or Rendering/Painting (compositing); and whether `<main>`'s scroll events fire on the first touch. **Also capture the Network waterfall** — if the list's fetch is still in flight during the "stuck" window, the page simply had nothing to scroll, which is the leading hypothesis after the Field Result and is invisible in a Performance trace alone. That last one distinguishes "the gesture never reached the scroller" from "the scroller was too busy to respond" — a distinction no amount of code reading can settle.

- [ ] **T-003** 🔴 **BLOCKING — the reason this branch exists.** **iPhone — Symptom B.** Still occurring in production as of 2026-09-05. With Safari's toolbar visible, confirm the last row of a long list is reachable and not covered, in portrait and landscape, and on a notched device that the home indicator does not sit over content. Also confirm the shell does not resize jarringly as the toolbar hides — `dvh` tracks the chrome, which is the intended trade for correctness.

---

## Phase 2 — Conditional follow-up (only if Phase 1 says so)

- [ ] **T-004**: **Animate only rows near the viewport.** ⛔ **No trigger — do not start.** T-001 closed as not-reproducible, so the premise (animation cost causes the lag) is unsupported. Revive only if T-002 measures Scripting-bound frames.

  Today every row animates on mount whether or not it is on screen, so cost scales with list length instead of screen size. Replace the container-stagger pattern in the list components with per-row `whileInView` + `viewport={{ once: true }}`, so a 200-row list animates the visible handful.

  Constraints: keep honouring `prefers-reduced-motion` (`animationVariants.js` already gates on it — do not bypass it); the initial screenful must animate immediately, not on scroll; re-measure with T-002 afterwards, since an IntersectionObserver per row is not free either.

  Affected: `AttendanceSummary`, `AnnouncementCard`, `TimetableCard`, `CourseworkList`.

- [ ] **T-005**: **Consider moving scrolling to the document.** ⛔ **No trigger — do not start.** Retained because it would remove this whole class of bug, but it is an app-shell rewrite and nothing currently justifies it.

  A root scroller restores native browser-chrome auto-hide and native momentum on both platforms, and removes the whole class of bug this feature works around. It is an app-shell rewrite — the sidebar becomes `position: fixed` on desktop, the navbar `sticky`, and every page's scroll assumptions need re-checking. **Do not start this without T-002 evidence**; it is a large diff to justify on a hunch.

---

## Phase 3 — Lint debt (independent; unrelated to this feature)

- [ ] **T-006** `[P]`: **Fix 3 lint errors in `frontend/src/pages/student/StudentDashboard.jsx`.**

  ```
  10:8   'calculatePercentage' is defined but never used   no-unused-vars
  11:10  'assessmentTypeLabel' is defined but never used    no-unused-vars
  18:10  'selectSchoolName' is defined but never used       no-unused-vars
  ```

  **Pre-existing, not caused by 010** — confirmed by linting the committed `HEAD` copy in isolation, which reports the identical three. They arrived with the coursework work in `5223ac3`, where the dashboard tile was rewritten and these imports were left behind.

  Before deleting them, check each is genuinely dead rather than a wiring step that was missed — `assessmentTypeLabel` in particular suggests the tile was meant to label coursework by type. If it was an oversight, finish the wiring instead of removing the import.

  Verify with `npx eslint src/pages/student/StudentDashboard.jsx` (expect clean) and `npx vitest run src/pages/student/StudentDashboard.test.jsx` (expect 3 passing).

- [ ] **T-007** `[P]`: **Add lint to CI, or this recurs.** These three errors reached `main` because nothing blocks on `npm run lint`. The frontend has the script; no workflow calls it. Until it gates merges, dead imports and the `react-hooks` errors this repo has already hit will keep landing silently.

  Note the sibling hazard already documented in `008/tasks.md` T-002: the backend `npm test` **exits 0 even when tests fail**, and `vitest` exits 0 when a worker dies (this is how three `ProtectedRoute` tests went unrun — see `c730e41`). A CI gate that trusts exit codes will be green while broken; assert on the reported pass/fail counts.
