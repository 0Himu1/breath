# Build a Rhythmic Breathing Web App — Full Project Spec

## 1. Project Overview

Build a minimal, distraction-free web app for guided rhythmic breathing exercises. The app has **no forced sign-in** — a first-time visitor opens the page and can start breathing immediately. The core experience is a full-screen animated pacer that visually and audibly guides the user through timed breath phases (inhale / hold / exhale / hold).

**Tech stack:**
- Next.js 14 (App Router) + TypeScript
- Tailwind CSS for styling
- Framer Motion for the pacer animation
- Web Audio API for phase-transition tones (synthesized, no audio files)
- Prisma + PostgreSQL for the backend data layer (used only for anonymous background sync, not required for core functionality)
- IndexedDB (via `idb` library) as the local-first source of truth on the client

---

## 2. Core Principle: Local-First, No Forced Auth

- All session and preference data is written to **IndexedDB first**. This is the source of truth for the current device and works fully offline.
- On first load, generate a random anonymous ID client-side via `crypto.randomUUID()`, store it in `localStorage`, and use it to silently sync session data to the backend in the background. This sync is invisible to the user — no "signed in as," no sync status UI, no login prompt.
- There is no auth wall anywhere in the core flow. If sign-in is added in a future phase, the plan is to merge the anonymous ID's history into the new account — but **do not build sign-in in this version**.

---

## 3. Breathing Patterns (seed data)

Implement these six patterns exactly as specified. Each has a phase structure, a category, and an assigned color hue (see Section 5).

| slug | name | phases (label: seconds) | category | colorHue |
|---|---|---|---|---|
| `coherent` | Coherent Breathing | Inhale: 5.5, Exhale: 5.5 | calm | blue |
| `box` | Box Breathing | Inhale: 4, Hold: 4, Exhale: 4, Hold: 4 | focus | teal |
| `478` | 4-7-8 Breathing | Inhale: 4, Hold: 7, Exhale: 8 | sleep | indigo |
| `sigh` | Physiological Sigh | Inhale: 2, Inhale (top-up): 1, Exhale: 6 | calm | coral |
| `wimhof` | Wim Hof Style | Fast breathing round (30 cycles of Inhale:1.5/Exhale:1.5), then Hold (variable, user-extended), then Recovery Inhale: 2 | energy | amber |
| `buteyko` | Buteyko-Style | Inhale: 3, Exhale: 4, Hold: 5 | calm | sage |

Each pattern also needs a one-line, plain-language description (no medical jargon) shown on its Home card, e.g.:
- Coherent → "Smooth, even breaths for lasting calm"
- Box → "Steady counting to sharpen focus"
- 4-7-8 → "A long exhale to help you drift off"
- Sigh → "One quick reset for a sudden wave of stress"
- Wim Hof → "Energizing breath work to wake you up"
- Buteyko → "Gentle, reduced breathing to retrain your calm"

Include a short caution note in the Wim Hof pattern's detail view: not for use while driving, in water, or by those pregnant, epileptic, or with cardiovascular conditions.

### 3.1 Critical: Sessions loop, they do not run once

**A session is NOT a single pass through a pattern's phase list.** A single pass through, e.g., Box breathing (4-4-4-4) is only 16 seconds — far too short to produce any physiological benefit (vagal tone and HRV changes require several minutes of sustained practice, per the science covered earlier in this project's research).

Correct behavior:
- Each session loops the pattern's phase sequence **continuously** for a target session duration, not for one pass.
- Default session duration: **3 minutes**, user-adjustable (e.g. 1 / 3 / 5 / 10 minutes) from the Home screen before starting.
- The Session screen's timer and progress bar track **elapsed/remaining time against this total session duration**, not against a single phase-sequence pass. The pacer circle keeps cycling through Inhale → Hold → Exhale → Hold (etc.) repeatedly until the total duration elapses.
- **Wim Hof is the one structural exception**: its natural unit is a "round" (30 fast breathing cycles → breath hold → recovery inhale). A full Wim Hof session = **3-4 repeated rounds**, not a single round and not a fixed time duration — model this as `roundsPerSession` (default 3) rather than a duration in seconds.
- `LocalSession.durationSec` and the backend `Session.durationSec` field should reflect this actual total elapsed session time, not one phase-list pass.

Do not regress this if touched again — an implementation that runs the phase list once and ends is a bug, not a valid interpretation of "session."

---

## 4. Screens & UX Flow

### Flow
```
Home (pattern pre-loaded, swipeable) 
  → tap Start 
    → Session (full-screen pacer) 
      → tap ✕ or session completes 
        → End screen (duration + optional 1-tap mood rating) 
          → back to Home (streak updated)
```

### Home Screen
- Shows current streak (computed, not stored — see Section 6) in the top corner, understated, not gamified
- One large pattern card in the center: icon/circle, pattern name, one-line description
- Horizontal swipe (or arrow taps) to cycle between the 6 patterns; dot indicators show position
- One primary CTA: "Start"
- No settings icon cluttering this screen — tuck theme/sound toggles into a minimal top-corner icon that opens a lightweight sheet, not a full settings page

### Session Screen (full-screen, distraction-free)
- The only interactive element is an exit (✕) in a corner
- Center: the breathing pacer circle, animated with Framer Motion, using easing curves (not linear) so it feels organic
- Phase label inside or below the circle ("Inhale", "Hold", "Exhale")
- Circle color = the current pattern's assigned accent color
- Small time-remaining text below the circle
- Thin, minimal progress bar at the bottom of the screen
- Optional: phase-transition tone via Web Audio API, and haptic pulse on supported devices — both **off by default** on first use, toggleable

### End Screen
- Shows session duration and pattern used
- One optional, low-friction 1-5 tap mood rating ("How do you feel now?") — never required, never blocks returning to Home
- Return-to-Home CTA

### History Screen
- Simple calendar heatmap (GitHub-contributions style) built from local Session records
- Streak count and total sessions

---

## 5. Theming & Color System

- **Default theme = system preference**, detected via `prefers-color-scheme` in CSS. Only override if the user explicitly picks Light or Dark from the settings sheet; store that override in `localStorage` and `UserPreference`.
- Each pattern has its own hue that stays constant across light/dark mode — only the lightness/background values invert. This keeps a pattern visually recognizable in either theme.

Use these exact values as CSS variables per pattern (`--pattern-{slug}-bg`, `--pattern-{slug}-accent`) for light and dark:

| Pattern | Light bg | Light accent | Dark bg | Dark accent |
|---|---|---|---|---|
| coherent | #EAF2FB | #5B8DEF | #0E1A2B | #7EA8F5 |
| box | #E7F4EF | #3FA184 | #0E211C | #5FC2A2 |
| 478 | #EEEAF7 | #7B6FC9 | #171326 | #9C90E8 |
| sigh | #FBEDEA | #E08976 | #241512 | #F0A796 |
| wimhof | #FBF1E1 | #D99A3E | #251C0E | #E8B15E |
| buteyko | #EFF3E9 | #7FA35C | #181F13 | #9BC17C |

Design constraints:
- Keep all accent colors in the 20–45% saturation range — muted, never neon or pure/primary hues
- Neutral chrome (backgrounds outside the pattern circle, text, borders) stays grayscale in both themes; only the pattern's own circle/accent uses its assigned hue
- Session screen should be the lowest-chrome screen in the app — no borders needed since there's only one focal object

---

## 6. Data Model

### IndexedDB (client, source of truth)
Mirror this structure locally:
```ts
interface LocalSession {
  id: string; // uuid
  patternSlug: string;
  startedAt: string; // ISO
  durationSec: number;
  completed: boolean;
  moodBefore?: number; // 1-5
  moodAfter?: number; // 1-5
  synced: boolean; // whether it's been pushed to backend
}

interface LocalPreference {
  theme: 'system' | 'light' | 'dark';
  soundEnabled: boolean;
  hapticsEnabled: boolean;
  defaultPatternSlug: string;
}
```
- Streaks are **computed at render time** by grouping local sessions by calendar day and checking for consecutive days — never stored as a field, to avoid drift bugs from deletions or timezone shifts.

### Backend (Prisma + PostgreSQL) — background sync only

```prisma
model AnonymousUser {
  id          String    @id // client-generated crypto.randomUUID()
  createdAt   DateTime  @default(now())
  sessions    Session[]
}

model Pattern {
  id          String    @id @default(cuid())
  slug        String    @unique
  name        String
  description String
  category    String    // "calm" | "sleep" | "focus" | "energy"
  colorHue    String    // "blue" | "teal" | "indigo" | "coral" | "amber" | "sage"
  phases      Json
  sessions    Session[]
}

model Session {
  id              String    @id @default(cuid())
  anonymousUserId String
  patternId       String
  startedAt       DateTime
  durationSec     Int
  completed       Boolean   @default(false)
  moodBefore      Int?
  moodAfter       Int?

  anonymousUser   AnonymousUser @relation(fields: [anonymousUserId], references: [id])
  pattern         Pattern       @relation(fields: [patternId], references: [id])

  @@index([anonymousUserId, startedAt])
}
```

Sync behavior: on session completion, write to IndexedDB immediately (instant UX), then attempt a background POST to `/api/sessions` tagged with the anonymous ID from `localStorage`. If the request fails (offline), mark `synced: false` and retry on next app load. Never block UI on sync success/failure.

---

## 6.1 Database Provider: Supabase (Prisma-only, no Supabase JS client)

The Postgres database is hosted on Supabase. **Use Prisma exclusively to talk to it** — do NOT install or use `@supabase/supabase-js`, `@supabase/ssr`, or any Supabase UI/auth components. This app has no auth, no realtime features, and no file storage, so Supabase's client SDK is unnecessary and would just add a second, redundant way of touching the database. All reads/writes go through Next.js API routes using Prisma, exactly as specified in Sections 6 and 7.

**Environment variables (`.env`):**
```env
# Prisma — pooled connection (port 6543), used by the app at runtime
DATABASE_URL="postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true"

# Prisma — direct connection (port 5432), used only for running migrations
DIRECT_URL="postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres"
```

**Prisma schema datasource block:**
```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}
```

**Setup step:** run `npx skills add supabase/agent-skills` once at project init — this gives the agent Supabase-specific best practices (connection handling, RLS awareness, etc.) even though we're accessing the DB through Prisma rather than the Supabase SDK. This is the only Supabase-provided tool to install; skip all other Supabase quickstart packages.

**Do not run `prisma migrate` against the pooled (6543) URL** — it must target the direct (5432) URL, i.e. `directUrl`, or migrations will fail/behave unpredictably against the pgbouncer connection.

---

## 7. API Routes (Next.js route handlers)

- `POST /api/sessions` — accepts a session payload + anonymous ID, upserts into the backend DB
- `GET /api/patterns` — returns the seeded pattern list (or these can simply be static/hardcoded client-side data given they never change — prefer this simpler approach unless custom patterns are planned)

No other backend routes are needed for this version — no auth endpoints, no user CRUD.

---

## 8. Animation & Audio Details

- Pacer circle: scale transform driven by Framer Motion, duration matching each phase's second count exactly, `ease: "easeInOut"` — avoid linear or spring physics that would make timing feel imprecise
- Inhale → circle scales up (~1.4x), Exhale → scales down (~0.75x), Hold → stays static
- Phase-transition tone: use Web Audio API `OscillatorNode` with a soft sine wave, short fade-in/out envelope (avoid clicks), distinct but subtle pitch per phase type (e.g., slightly higher tone on inhale start, lower on exhale start)
- All audio and haptics default OFF on first-ever app load; toggle persists in `LocalPreference`

---

## 9. Acceptance Criteria

- [ ] User can open the app and start a breathing session in 3 taps or fewer, with zero sign-in prompts
- [ ] All 6 patterns are selectable, each with correct phase timing and correct assigned color in both light and dark themes
- [ ] Theme defaults to system preference on first load; manual override persists across reloads
- [ ] Session data persists in IndexedDB and survives a page reload without any network connection
- [ ] Streak and history are computed correctly from local session data, including handling multiple sessions per day and timezone edge cases
- [ ] Session screen contains no elements other than the pacer, phase label, time remaining, progress bar, and exit control
- [ ] Wim Hof pattern displays its caution note before starting
- [ ] Anonymous sync to backend happens silently and never blocks or delays the UI

---

## 10. Explicitly Out of Scope for This Version

- User accounts / sign-in / sign-up
- Custom user-built patterns
- Camera-based HRV or biometric tracking
- Push notifications / reminders
- Social or sharing features