# Backend modules — Member 2 scope

Backend business logic for the second-member contribution is kept under this folder so it can be reviewed and committed independently from the UI.

## Modules

- `accounts/provision.ts` — validates and creates role-limited accounts with bcrypt password hashes.
- `library/` — Zod schemas and Prisma operations for approved rules, facts and terms.
- `library/extract.ts` — extracts candidate guidance from uploaded guideline text; every candidate remains a draft until an Admin approves it.
- `review/gemini.ts` — Gemini text-review adapter, cached per-workspace BM25 retrieval context, strict JSON validation and source/span mapping.
- `review/visual.ts` — local Sharp image measurements plus Gemini visual comparison against the private approved logo and palette. Its output is Zod-validated and explicitly advisory.

The persistent async review queue and worker are in `src/lib/review/job-queue.ts` and `scripts/review-worker.ts`; `npm run dev` starts the worker with Next.js. Next.js transport adapters are in `src/app/api/`; the Super Admin, brand Admin, Creator and Manager screens are in `src/components/` and `src/app/`. `src/lib/review/` contains the shared deterministic verifier, accessibility checks, workspace-scoped guideline-insight aggregation and confidential-span masking. New optimized creative images are stored in private local or S3-compatible object storage through `src/lib/files/private-assets.ts`.

## APIs

- `GET|POST /api/admin/library/{rules|facts|terms}` — list or create an entry.
- `PATCH|DELETE /api/admin/library/{kind}/{id}` — update or delete an entry.
- `GET|PUT /api/admin/brand-profile` — read or update the Admin-only logo and palette profile.
- `POST /api/admin/library/import` and `/confirm` — extract draft entries and explicitly confirm them into the library as unapproved items.
- `POST /api/admin/users` — Admin provisions Managers or Creators only.
- `GET|POST /api/superadmin/workspaces` — Super Admin creates isolated brands and their Admin accounts.
- `GET /api/superadmin/feedback` — Super Admin-only cross-brand product feedback.
- `POST /api/submissions` — stores the submission, runs quick local checks, and queues AI/text/visual review for the persistent worker.
- `GET /api/submissions/{id}/review-status` — read the authenticated queued review status.
- `GET|POST /api/admin/insights` — repeated-dismissal signals and clarification drafts.
- `POST /api/admin/evaluation` — run the labelled review set and log provider calls.

Mutations enforce roles and workspace membership server-side, validate inputs, and write audit events. Brand users, submissions, profiles, insights and library entries are workspace-scoped. Only approved library entries in the current workspace can be used as text-review sources.

## Gemini and data handling

The server calls the Google Gemini `generateContent` REST endpoint using `GEMINI_MODEL` (default `gemini-3.6-flash`). Text requests receive only the content not marked confidential plus a small set of retrieved approved rules and facts. Visual requests include the creative and, when configured, the approved logo image; the form discloses the external call. Provider failures fall back to the local mock for text and to measured-only results for images. Calls are recorded in `AiCallLog`.

Image inputs are limited to 3 MB and PNG/JPEG/WebP. Sharp reads dimensions and samples colors locally. Sampled RGB coverage is an approximate signal, not a compliance score. Gemini findings are suggestions; the human review workflow remains authoritative.
