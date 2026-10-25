# TrueMark

Prepublication brand governance: TrueMark checks drafts against an organisation's
**approved** rules, facts and terms before publication. Every finding cites its
approved source and the exact quoted span that triggered it; findings that cannot
be verified are discarded. People accept, edit or dismiss — nothing is rewritten
or published automatically.

Built for the TrueMark hackathon (Team Harshitgurjar00007).

## Stack

| Layer | Choice |
| --- | --- |
| Frontend | Next.js 14 (App Router), React 18, strict TypeScript, Tailwind CSS |
| Backend | Next.js route handlers on Node.js |
| Database | Prisma 5 — SQLite locally, PostgreSQL on hosted deployment |
| Auth | bcryptjs + jose; JWT in httpOnly, sameSite=lax cookies; role checks on every state-changing route |
| Validation | zod on every API input and (later) every AI model output |
| AI model | Google Gemini (`@google/genai`), deterministic mock provider when `GEMINI_API_KEY` is absent |
| Deployment | Vercel + hosted PostgreSQL |

## Getting started

```bash
npm install
npm run db:push   # create/update the SQLite database
npm run db:seed   # seed demo users, rules, facts and terms
npm run dev       # http://localhost:3000
```

### Environment variables

Copy `.env.example` to `.env` and set:

- `DATABASE_URL` — `file:./dev.db` locally; a pooled PostgreSQL URL on Vercel.
- `AUTH_SECRET` — random string, at least 32 characters
  (`node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`).
- `GEMINI_API_KEY` (optional) — when absent the mock provider keeps the whole
  workflow available offline.

### Demo accounts (after seeding)

| Email | Role | Password |
| --- | --- | --- |
| admin@truemark.test | ADMIN | truemark123 |
| manager@truemark.test | MANAGER | truemark123 |
| creator@truemark.test | CREATOR | truemark123 |

The seed also loads 8 approved rules (R-001…), 5 approved facts (F-001…) and
6 approved terms (T-001…) so the review pipeline has an approved library to cite.

## Project structure

```
prisma/schema.prisma        # data model (User, Rule, Fact, Term, Submission, Version, Finding, Comment, AuditLog, AiCallLog)
prisma/seed.js              # idempotent demo seed
src/lib/session-token.ts    # edge-safe JWT sign/verify (used by middleware)
src/lib/auth.ts             # password hashing (bcryptjs)
src/lib/session.ts          # server-side session reader
src/lib/api.ts              # withAuth() wrapper: auth → role check → zod → error handling; audit log helper
src/lib/validation.ts       # zod schemas + role/status constants (SQLite has no Prisma enums)
src/middleware.ts           # page-level guard for /dashboard and /admin
src/app/api/auth/*          # register, login, logout, me
src/app/(pages)             # landing, login, register, dashboard, admin overview
```

## Security model

- JWT (HS256) signed with `AUTH_SECRET`, stored in an httpOnly `sameSite=lax`
  cookie (7 days). `secure` is enabled in production.
- Page tree: middleware redirects unauthenticated visitors to `/login` and
  non-admins away from `/admin`.
- API routes: every handler is wrapped in `withAuth(roles, handler)` which
  enforces authentication, role authorisation, zod-validated input and a typed
  error response — in that order, on the server.
- All state changes are written to the audit log. Failed logins are logged
  without revealing whether the email or the password was wrong.
- Registration always creates a CREATOR account; ADMIN/MANAGER are provisioned
  by an administrator.

## End-to-end smoke test

With the production server running (`npm run build && npm run start` in one
terminal):

```bash
node scripts/smoke-test.mjs
```

It exercises the complete Round 2 path — login, submission with automated
review, accept / edit / dismiss decisions, manager comment and approval, role
restrictions (creator cannot approve, manager cannot decide findings),
versioning with replacements, the audit trail and the AI-call disclosure log —
and leaves demo data in the database for presentations.

## Build roadmap

- **Done** — auth + roles, review engine (deterministic term checks + offline
  mock provider + verifier that drops findings without an approved source and
  verbatim span), submission flow with the findings interface (accept / edit /
  dismiss with reason), versioned revisions with word-level comparison,
  manager comments and approval, audit trail.
- **Next (Member 2)** — admin CRUD for rules, facts and terms; Gemini provider
  behind the existing review contract (`GEMINI_API_KEY` present → real model,
  absent → mock).
- **Phase 5** — Vitest unit tests on the pipeline core, labelled evaluation set
  (precision / recall / citation validity), deployment hardening.
- **Round 3** — guideline-gap insights dashboard, image checks, accessibility
  expansion, report export (stretch).

## AI-use disclosure

Automated reviews may use AI assistance (Google Gemini) when an API key is
configured. The model only receives the text segment under review and the few
retrieved approved excerpts — never the full library. Every AI call is logged
(`AiCallLog`), and reviewer decisions always take precedence over AI findings.
