# Feature Specification: Mobile Scroll Responsiveness & Browser-Chrome Safe Area

**Feature Branch**: `010-mobile-scroll-performance`
**Created**: 2026-09-04
**Status**: iOS safe-area fix **required and outstanding**. Android symptom **not reproducible** — see Field Result (2026-09-05)
**Input**: "there is one issue with respect to scrolling sometime i have observed in the real device scrolling it looks like scroll is stuck and not able to scroll till last but after some times it start work means in starting time when we go to page and tries to scroll it is looks like laggy or stuck" · "sometime browser native search bar eg in iphone it is coming in UI and not disabled on that case we should have some extra padding so that below or bottom content should be visible" · follow-up: "scroll issue happened in android the first which i explained"

---

## Overview

Two symptoms were reported from real devices:

| # | Device | Symptom |
|---|---|---|
| **A** | Android | On entering a page, scrolling feels stuck or laggy and will not reach the last rows. After a few seconds it starts behaving normally. |
| **B** | iPhone | Safari's toolbar sits over the bottom of the page; the last content is not reachable. |

They were initially diagnosed as one bug. **They are not.** Symptom B is a viewport-height defect. Symptom A is *primarily* an animation-cost defect that the viewport fix alone does not explain. Both fixes shipped together; only B's mechanism is fully proven.

---

## The app shell

Every authenticated page renders inside `frontend/src/components/common/Layout.jsx`. The shell is pinned to the viewport and clipped, and the real scrolling happens in an inner pane:

```
<div class="app-shell ... overflow-hidden">   ← pinned to viewport height, clips
  <Navbar />
  <div class="flex flex-1 overflow-hidden">
    <Sidebar />
    <main class="... overflow-y-auto">        ← the actual scroller
```

This single structural choice is upstream of both symptoms, and of the caveat in Cause 2.

---

## Cause 1 — the shell was clipped at `100vh` (Symptom B, contributes to A)

`Layout.jsx:40` used Tailwind's `h-screen`, i.e. `height: 100vh`.

On **both** iOS Safari and Android Chrome (since Chrome 56), `100vh` resolves to the **large viewport** — the height the page *would* have if the browser chrome were hidden — deliberately, so `vh` units do not resize during scroll. On page load the chrome is visible, so the visible area is smaller than `100vh`.

The shell was therefore taller than the screen and `overflow-hidden`. Its bottom strip sat behind the browser toolbar, and because the scroller is an inner element clipped inside that box, its final rows could not be brought into view.

**Fix**: `.app-shell` uses `100dvh`, which tracks the chrome as it shows and hides (`frontend/src/index.css:28-38`).

> ⚠️ **The minifier deletes a naive fallback.** Written as two declarations in one rule —
> ```css
> .app-shell { height: 100vh; height: 100dvh; }
> ```
> — the build collapses them to `height:100dvh` alone, discarding the fallback. On iOS < 15.4 the shell then has *no* height and collapses entirely: a worse bug than the original. The fallback is kept in a separate `@supports (height: 100dvh)` block for this reason. **Verify both rules survive in `dist/assets/*.css` after any change here.**

---

## Cause 2 — mount animations competed with the first scroll (Symptom A — ❌ **retracted as the cause**, see Field Result)

`frontend/src/utils/animationVariants.js` staggered every list child by `staggerChildren: 0.1`, and each child animates `opacity` + `y` over `0.4s` (`fadeInUp`).

For a month of attendance (~30 rows) the last row **began** its entrance 3.0 seconds after mount. For that entire window the page was running transform and opacity animations on every row while the user was already trying to scroll.

**Why this — and not Cause 1 — is the primary explanation on Android:** the Android Chrome URL bar auto-hides only when the **root/document** scroller scrolls. Here the scroller is an inner `<main>`, so the URL bar never retracts and the viewport never grows. Cause 1 therefore predicts a *permanently* short viewport on Android — it cannot produce "after some time it starts working." A 3-second animation tail can, and matches the report exactly.

**Fix**: `staggerChildren: 0.1 → 0.04` (`animationVariants.js:21`), cutting a 30-row tail from 3.0s to 1.2s while keeping the cascade visible.

> ❌ **This reasoning did not survive contact with the device.** On 2026-09-05 the tester found Symptom A gone with **none of this deployed** — so the stagger was not the cause. The change is retained on its own merit (a row invisible for three seconds is bad regardless), *not* as a fix. See Field Result.

---

## Cause 3 — `backdrop-filter` on every row of every list (Symptom A, contributing)

Six student-facing components — eight card surfaces in total — styled cards as `backdrop-blur-sm bg-white/70 border-white/20`.

These cards sit on the shell's flat `bg-gray-50`. **Blurring a solid colour returns that same solid colour**, so the `backdrop-filter` was visually a no-op while still forcing a compositing layer and a blur pass per card per frame — the most expensive place to spend GPU time is precisely a long scrolling list, and it bought nothing. A before/after render of the timetable rows is pixel-indistinguishable.

**Fix**: solid `bg-white` + `border-gray-100` on list cards. `border-white/20` was also near-invisible on grey; `border-gray-100` matches the rest of the app.

**Deliberately kept** where content genuinely sits behind the blur: the three billing modals, `Home.jsx` / `SchoolLanding.jsx` (gradient orbs), and `SchoolSettingsPage.jsx:240` (a sticky bar with content scrolling under it).

---

## Cause 4 — no safe-area inset (Symptom B, secondary)

`env(safe-area-inset-*)` resolves to `0` unless the viewport opts in. Added `viewport-fit=cover` (`frontend/index.html:6`) plus a `.pb-safe` utility on the scroll pane (`index.css:43-52`) and on the two public-page footers, which scroll the document rather than the shell.

> ⚠️ **Do not put this padding on `body`.** It adds document scroll *underneath* a viewport-pinned shell, reintroducing the exact overlap being fixed. This was tried and reverted; a probe confirms `documentScrolls: false`.

---

## What changed

| File | Change |
|---|---|
| `frontend/src/index.css` | `.app-shell` (`100vh` + `@supports` `100dvh`), `.pb-safe` |
| `frontend/src/components/common/Layout.jsx` | `h-screen` → `.app-shell`; `overscroll-contain` + `pb-safe` on the scroller |
| `frontend/index.html` | `viewport-fit=cover` |
| `frontend/src/utils/animationVariants.js` | `staggerChildren` `0.1` → `0.04` |
| `AnnouncementCard`, `AttendanceSummary`, `CourseworkList`, `ProfileCard`, `TimetableCard`, `StudentDashboard` | blur removed, solid card surface |
| `Home.jsx`, `SchoolLanding.jsx` | safe-area footer padding |

---

## Field Result — 2026-09-05 (supersedes the diagnosis above)

The tester reports Symptom A (Android) **behaving normally with none of this branch deployed**.

**What that rules out.** Causes 2 and 3 cannot have fixed something that resolved without them. Any claim that the stagger or the `backdrop-filter` caused the Android lag is withdrawn.

**What it points to instead.** A symptom that appears on entry, resolves after a few seconds, and later stops reproducing altogether is characteristic of **data-loading latency, not rendering cost**: the list paints empty or short, there is nothing to scroll, and the page becomes scrollable only once the fetch resolves. That fits "stuck at first, works after some time" more economically than the animation theory, and unlike it, explains why a faster network or warm cache makes the symptom disappear entirely. It was reported from a real network; it was diagnosed from source. That asymmetry is the lesson here.

**If it returns**, instrument before theorising — `T-002` in `tasks.md`, plus the request waterfall, which the original diagnosis never examined.

**Symptom B (iOS) is unaffected by this and still occurs in production.** Cause 1 and Cause 4 remain the fix for it and are the reason this branch ships.

---

## Verification Gap — read before closing this feature

**What was proven** (headless Chrome, 390px, structural probe): shell height equals the viewport, `documentScrolls: false`, `<main>` is the scroller, the last row is fully visible with clearance. Build passes; frontend suite 20/20; before/after card render indistinguishable.

**What was NOT proven**: any of it on a real Android or iOS device. Desktop Chrome resolves `100vh === innerHeight`, so the browser-chrome discrepancy that causes both symptoms **cannot be reproduced locally at all**. The reasoning is sound and the mechanisms are documented, but no measurement here exercises the actual defect.

This feature is therefore **not done until a device confirms it** — see `tasks.md` Phase 1. Phase 1 has since returned a partial answer: Android is moot (Field Result), **iOS remains unverified and is now the whole point of the branch**.

---

## Deferred Scope

- **Viewport-gated row animation.** If Android is improved but not fixed, the remaining suspect is `fadeInUp` on every row regardless of visibility. The fix is to animate only rows near the viewport (`whileInView` + `viewport={{ once: true }}`) so a 200-row list animates the visible handful rather than all 200. Not done pre-emptively: it is a real refactor across list components, and it should be justified by a device measurement rather than a hunch. See `T-004`.
- **Root-scroller shell.** Moving scrolling from the inner `<main>` to the document would restore native browser-chrome auto-hide and native momentum on both platforms — the structurally correct fix. It is an app-shell rewrite touching every page, and is out of scope here. See `T-005`.
- **Lint debt in `StudentDashboard.jsx`** — unrelated to this feature; see `T-006`.
