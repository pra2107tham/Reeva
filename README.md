# Reeva

Live: https://reeva-henna.vercel.app

Reeva is a Next.js application that connects to Instagram Messaging webhooks, ingests incoming DMs/events, and saves/associates them with a user account in Supabase. It supports authentication (email/password + Google OAuth), profile creation, and an ingestion pipeline that can enqueue events to Upstash QStash for asynchronous processing.

> Tech highlights: Next.js App Router, Supabase Auth + DB, Upstash QStash, structured logging (Winston/Pino), Tailwind CSS, Framer/Three.js utilities.

---

## Table of Contents
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started (Local Dev)](#getting-started-local-dev)
- [Environment Variables](#environment-variables)
- [Core Flows](#core-flows)
  - [Authentication](#authentication)
  - [Instagram Ingestion](#instagram-ingestion)
- [API Routes (Backend)](#api-routes-backend)
- [Deployment](#deployment)
- [Docs](#docs)
- [Troubleshooting](#troubleshooting)
- [Notes / Limitations](#notes--limitations)

---

## Features
- **Auth & Accounts (Supabase)**
  - Email + password signup with **email confirmation**
  - Login with email/password
  - Google OAuth login
  - User profile management backed by a `profiles` table

- **Instagram messaging ingestion**
  - Parses Instagram webhook payloads into normalized events
  - Stores/updates Instagram profile + message records in Supabase
  - Sends automated DMs (verification / acknowledgement) via Instagram Graph API
  - Uses **Upstash QStash** to enqueue messages for async processing

- **App Router frontend**
  - Routes for login/signup/profile/verify and informational pages like About, Contact, Terms, Privacy, etc.

---

## Tech Stack
- **Frontend / Fullstack Framework:** Next.js (App Router)
- **Language:** TypeScript
- **Auth & Database:** Supabase (`@supabase/ssr`, `@supabase/supabase-js`)
- **Async jobs / queue:** Upstash QStash (`@upstash/qstash`)
- **Styling:** Tailwind CSS v4 (via PostCSS)
- **Logging:** Winston + Pino
- **Animation / UI utilities:** Motion One, Three.js, (Framer/unframer utilities present)

---

## Project Structure
Top-level (high level):
- `app/` – Next.js App Router pages + API routes
- `components/` – Shared UI components
- `lib/` – Core logic: Supabase clients, Instagram ingestion utilities, logging, URL helpers
- `docs/` – Setup guides and architecture notes
- `public/` – Static assets
- `proxy.ts` – Supabase SSR cookie/session refresh proxy (typically used in middleware-like flows)

Notable `app/` routes (partial):
- Pages:
  - `app/page.tsx` – landing/root
  - `app/login/`, `app/signup/`, `app/profile/`, `app/verify/`
  - `app/privacy-policy/`, `app/terms-conditions/`, etc.
- API:
  - `app/api/auth/*` – signup/login/logout/profile/callback
  - `app/api/internal/ingest-event` – internal ingestion endpoint that enqueues to QStash
  - `app/api/qstash/*` – QStash consumer endpoints (used by QStash to deliver queued events)

`components/` (partial):
- `components/Layout.tsx`
- `components/RadialVignette.tsx`

> Note: I may not have seen every file/route because code-search results can be truncated. You can browse the repo tree here: https://github.com/pra2107tham/Reeva

---

## Getting Started (Local Dev)

### 1) Install dependencies
```bash
npm install
```

### 2) Create `.env.local`
Create a `.env.local` file in the repo root and add the environment variables listed in [Environment Variables](#environment-variables).

### 3) Run the dev server
```bash
npm run dev
```

App should be available at:
- http://localhost:3000

### Other scripts
```bash
npm run build
npm run start
npm run lint
```

---

## Environment Variables

There is no `.env.example` currently in the repo, so use the list below to create your `.env.local`.

### Supabase (required)
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

Alternative names (also supported in code/docs):
```env
SUPABASE_PROJECT_URL=your_supabase_project_url
SUPABASE_ANON_PUBLIC_KEY=your_supabase_anon_key
```

### App base URL (important for callbacks + QStash + verify links)
Used by `lib/utils/url.ts`:
```env
# Development public URL (use ngrok if you need external callbacks/webhooks locally)
DEV_DOMAIN=http://localhost:3000
# or
NEXT_PUBLIC_DEV_DOMAIN=http://localhost:3000

# Production URL
PRODUCTION_DOMAIN=https://your-production-domain.com
# or
NEXT_PUBLIC_PRODUCTION_DOMAIN=https://your-production-domain.com
```

> If no dev domain is set, the code contains an ngrok fallback URL. You should replace this with your own.

### Upstash QStash (required for queueing)
```env
QSTASH_TOKEN=your_qstash_token
# Optional override:
QSTASH_URL=your_qstash_base_url
```

You may also need signing keys depending on how the consumer verification is implemented:
```env
QSTASH_CURRENT_SIGNING_KEY=...
QSTASH_NEXT_SIGNING_KEY=...
```

### Instagram API (required for sending DMs / webhook verification)
```env
INSTAGRAM_API_BASE_URL=https://graph.instagram.com/v24.0
INSTAGRAM_ACCESS_TOKEN=your_access_token
INSTAGRAM_SCOPED_ID=your_scoped_id
INSTAGRAM_WEBHOOK_VERIFICATION_TOKEN=your_webhook_token
```

### Internal services (required for internal ingestion endpoint)
```env
INTERNAL_SERVICE_TOKEN=some_strong_secret
INTERNAL_INGEST_URL=http://localhost:3000/api/internal/ingest-event
```

### Logging (optional)
```env
LOG_LEVEL=info
```

---

## Core Flows

### Authentication
Auth is implemented using Supabase and documented in `docs/AUTH_SETUP.md`.

High-level flow:
1. User signs up with email/password → Supabase sends a confirmation email.
2. Confirmation link lands on `/auth/callback`.
3. After confirmation, the app ensures a `profiles` row exists for the user (service role client may be used to bypass RLS for inserts).
4. User can login and access `/profile`.

See: `docs/AUTH_SETUP.md`

### Instagram Ingestion
The ingestion pipeline is documented in `docs/INSTAGRAM_INGESTION.md`.

Conceptually:
1. Instagram webhook receives a message event.
2. Payload is parsed into normalized `IncomingMessagingEvent` objects.
3. Event is stored/upserted in Supabase tables (instagram profile, messages, verification tokens, outbound messages, etc.).
4. For async work, events are published to **QStash**, which later calls your `/api/qstash/...` consumer endpoint.
5. Depending on whether the Instagram user is connected, the system sends either:
   - a **verification DM** (with a `/verify?token=...` link), or
   - an **acknowledgement DM**.

See: `docs/INSTAGRAM_INGESTION.md`

---

## API Routes (Backend)

Auth:
- `POST /api/auth/signup` – create account (email/password) or begin Google OAuth
- `POST /api/auth/login` – login (email/password) or OAuth handling
- `GET/PATCH /api/auth/profile` – get/update profile
- `POST /api/auth/logout` – logout
- `GET /api/auth/callback` – handles email confirmation magic links + OAuth callback

Ingestion:
- `POST /api/internal/ingest-event` – internal endpoint to validate a service token and enqueue events to QStash

---

## Deployment
- The repository homepage points to a Vercel deployment: https://reeva-henna.vercel.app
- For production, make sure you set:
  - `PRODUCTION_DOMAIN` (or `NEXT_PUBLIC_PRODUCTION_DOMAIN`)
  - all Supabase + Instagram + QStash env vars in your hosting provider
- Webhooks/callbacks require a publicly reachable URL.

---

## Docs
- `docs/AUTH_SETUP.md` – Supabase auth setup + database notes + auth endpoints
- `docs/INSTAGRAM_INGESTION.md` – ingestion pipeline, message flows, required env vars, DB tables
- `docs/WEBHOOK_HANGING_ANALYSIS.md` – investigation notes for webhook/QStash hangs in serverless environments

---

## Troubleshooting

### Supabase env vars missing
If you see errors like “Missing Supabase environment variables”, ensure:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- (server-side) `SUPABASE_SERVICE_ROLE_KEY`

### Webhooks/QStash not working locally
Instagram webhooks and QStash deliveries need a public URL. Use ngrok and set:
- `DEV_DOMAIN` / `NEXT_PUBLIC_DEV_DOMAIN` to your ngrok URL

### QStash publish appears to hang in production
See `docs/WEBHOOK_HANGING_ANALYSIS.md` for logging suggestions and alternatives (including direct API calls / timeouts / background processing patterns).

---

## Notes / Limitations
- There is currently **no `README` tailored to the app** (the existing README is the default Next.js template). This document is intended to replace it.
- There is no `.env.example`; consider adding one for contributors.