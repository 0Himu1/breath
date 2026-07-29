# Breath

A local-first breathing practice app built with Next.js, React, Tailwind CSS, Prisma, and Supabase Postgres.

Breath guides you through timed, visually-paced breathing sessions — no sign-up, no ads, no accounts. Open the app and start breathing in under 5 seconds. Your session history lives on your device first, with silent background sync so it's never lost.

---

## Why Rhythmic Breathing?

Most breathing happens on autopilot, reacting to blood CO₂ levels without any conscious input. Rhythmic (paced) breathing overrides that autopilot with a deliberate rhythm — and that single change triggers a cascade of measurable physiological effects.

### The vagus nerve is the switch

A long, slow exhale stimulates the vagus nerve, the main channel connecting your brain to your heart and lungs. This activates the parasympathetic ("rest and digest") nervous system — the direct counterbalance to fight-or-flight. Heart rate drops, blood pressure drops, cortisol drops. This is the mechanism behind nearly every calming breathing technique that exists.

### Resonance frequency and heart rate variability (HRV)

There is a specific breathing pace — roughly **5.5 breaths per minute** for most adults — where heart rate and breath rhythm fall into sync, oscillating together in a smooth wave. This is called **resonance frequency breathing**, and it produces the largest measurable increase in HRV, a well-established marker of stress resilience and cardiovascular health. Coherent Breathing in this app is built directly around this frequency.

### CO₂ tolerance and the "breathless alarm"

Most people chronically over-breathe without noticing, which keeps the body's CO₂-sensing chemoreceptors overly sensitive — like a smoke alarm set off by steam. This makes you feel short of breath more easily, not less. Slower breathing and breath-holds (as in Buteyko-style practice) gradually retrain this sensitivity, reducing that "breathless" feeling over weeks of consistent practice.

### Fast relief vs. long-term training

Not every technique works the same way or on the same timescale:

- **Immediate relief** (physiological sigh) works in one breath by rapidly reinflating collapsed lung sacs (alveoli) and offloading CO₂ fast — the quickest known way to calm an acute stress spike.
- **Long-term training** (coherent breathing, Buteyko) builds baseline vagal tone and CO₂ tolerance over weeks of regular practice — the benefit compounds, it isn't instant.
- **Energizing techniques** (Wim Hof style) deliberately do the opposite of calming — controlled hyperventilation followed by breath-holds triggers an adrenaline response, used for alertness and cold tolerance rather than relaxation.

---

## Breathing Patterns

| Pattern | Phase Sequence | Best For |
|---|---|---|
| **Coherent Breathing** | Inhale 5.5s → Exhale 5.5s | Long-term stress resilience, HRV |
| **Box Breathing** | Inhale 4s → Hold 4s → Exhale 4s → Hold 4s | Focus, calm under acute pressure |
| **4-7-8 Breathing** | Inhale 4s → Hold 7s → Exhale 8s | Falling asleep |
| **Physiological Sigh** | Inhale 2s → Top-up inhale 1s → Exhale 6s | Immediate stress relief |
| **Buteyko-Style** | Inhale 3s → Exhale 4s → Hold 5s | Retraining breathlessness sensitivity over time |
| **Wim Hof Style** | 30 fast breath cycles → Extended hold → Recovery inhale (repeated 3-4 rounds) | Energy, alertness, cold tolerance |

Standard patterns loop continuously until the selected target session duration is reached (a single pass through a pattern's phases is only 10-20 seconds — far too short to produce any physiological benefit, which is why sessions repeat the cycle for several minutes). Wim Hof sessions instead run a fixed number of repeated rounds, matching how the technique is actually practiced.

> **A note on Wim Hof style breathing:** this technique involves intentional hyperventilation and extended breath-holds, and can cause lightheadedness. It should not be practiced while driving, operating machinery, or in or near water, and is not recommended during pregnancy or for those with epilepsy or cardiovascular conditions.

---

## Features

- Full-screen breathing pattern player with no bordered pattern card
- Left and right pattern navigation buttons fixed to the screen edges
- Fixed start button placement so controls do not shift during browsing
- Looping timed sessions for standard breathing patterns
- Wim Hof style sessions with repeated rounds of fast breathing, hold, and recovery inhale
- User settings for session duration, Wim Hof rounds, sound, and haptics
- Light and dark themes, defaulting to system preference, with each pattern keeping its own recognizable accent color in both
- Local-first session storage with IndexedDB
- Supabase-backed persistence through Prisma
- Anonymous user tracking for session history and streaks — no sign-up required

---

## Tech Stack

- Next.js 16 canary
- React 19
- Tailwind CSS
- Framer Motion
- Prisma
- Supabase Postgres
- IndexedDB via `idb`

---

## Getting Started

Install dependencies:

```bash
npm install
```

Create a local `.env` file and set the required database variables:

```bash
DATABASE_URL="postgresql://..."
DIRECT_URL="postgresql://..."
```

`DATABASE_URL` should point to the pooled Supabase connection when available. `DIRECT_URL` should point to the direct Supabase Postgres connection and is used by Prisma migrations and as a runtime fallback.

Generate the Prisma client:

```bash
npm run prisma:generate
```

Apply database migrations:

```bash
npx prisma migrate dev
```

Seed the breathing patterns:

```bash
npm run db:seed
```

Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Useful Commands

```bash
npm run dev
npm run build
npm run start
npm run typecheck
npm run prisma:generate
npm run db:seed
```

---

## Database Model

The app stores:

- Anonymous users
- Breathing patterns
- Completed or attempted sessions
- Session duration, timestamps, completion status, and optional mood values

Sessions are saved locally first, then synced to the `/api/sessions` endpoint. If the pooled Supabase connection fails, the API retries with the direct database URL. No session data requires an account — persistence and cross-device sync are handled entirely through an anonymous, device-generated identifier.

---

## Verification

Before pushing changes, run:

```bash
npm run typecheck
npm run build
npm audit
```

---

## Disclaimer

This app is a wellness and focus tool, not a medical device. It is not intended to diagnose, treat, or cure any condition. If you have a cardiovascular, respiratory, or neurological condition, or are pregnant, consult a doctor before starting a new breathing practice — particularly before trying Wim Hof style sessions.