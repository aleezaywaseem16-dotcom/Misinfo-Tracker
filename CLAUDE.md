# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm install      # install deps
npm run dev      # start dev server (Turbopack) on http://localhost:3000
npm run build    # production build
npm run start    # run production build
npm run lint     # eslint
node scripts/e2e-smoke.mjs   # smoke-tests API routes against a running server (set E2E_BASE to override host)
```

There is no unit test runner configured. `scripts/e2e-smoke.mjs` is the only automated check beyond `lint`/`build`/`tsc` — it expects the dev/prod server already running and asserts unauthenticated requests to mutating API routes return 401.

Required env vars (`.env.local`, copy from `.env.local.example`): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `GROQ_API_KEY` (chat assistant). `.env.local` must be a file, not a directory — this has bitten people before.

## Architecture

Next.js 16 App Router + Supabase (Postgres, Auth, RLS) + Tailwind v4. No server-side ORM — all data access goes straight through the Supabase JS client, either as the user (anon key, RLS-enforced) or service role where used.

**Two Supabase client entry points** (`lib/supabase.ts` for Client Components, `lib/supabase-server.ts` for Server Components/Route Handlers via `next/headers` cookies) — pick based on where the code runs, not personal preference. `proxy.ts` is this project's Next.js 16 equivalent of `middleware.ts`: it refreshes the Supabase session cookie on every request and gates `/admin/*` behind a profile→role lookup (redirects to `/login` if unauthenticated, `/dashboard` if not an admin).

**Authorization model**: Postgres RLS policies in `scripts/supabase-schema.sql` are the actual source of truth for who can read/write what — `current_user_role()` (a `security definer` SQL function reading `profiles.role_id → roles.name`) backs most "admin/moderator can do X" policies. API routes (`app/api/**/route.ts`) layer a second checkpoint on top: they create a server Supabase client, call `auth.getUser()`, and reject unauthenticated requests with 401 before touching the DB. When adding a new mutating route, check both layers — adding code in the route alone is not sufficient if the table's RLS policy doesn't also permit it (and vice versa).

**Input handling**: route handlers manually validate/narrow `unknown` JSON bodies field-by-field (no schema library) and sanitize through `lib/sanitize.ts` (`sanitizeText` strips tags/`javascript:`/`data:`; `sanitizeUrl` allow-lists `http(s)` URLs; `isValidUUID` guards anything used in a `.eq()` filter). Follow this same manual-narrowing style for new routes rather than introducing a validation library.

**Schema vs. types drift**: `lib/types.ts` is hand-written and is not guaranteed to match `scripts/supabase-schema.sql` column-for-column (e.g. `Claim.created_by` in types vs. `claims.submitted_by` in the schema/some routes). When working with a table, check the actual SQL schema rather than trusting the TS interface.

**Soft deletes**: `claims`, `evidence`, `comments` use `deleted_at`; reads must filter `.is("deleted_at", null)` — there's no DB-level enforcement of this.

**Chat assistant** (`app/api/chat/route.ts`): calls Groq's OpenAI-compatible endpoint directly via `fetch` (no SDK), with a system prompt asking the model to append a trailing JSON line (`response`/`confidence`/`sourceUrl`) that the route then regex-extracts and parses — this is brittle by design (best-effort parse, falls back to raw text), keep that in mind if changing the prompt.

**Styling**: no component library — pages are largely inline `style={{...}}` objects plus a handful of shared utility classes (`card`, `btn-primary`, `status-pill`, `skeleton`, etc.) defined in `app/globals.css`. Match this convention rather than introducing CSS modules or a new approach for one page.

## Notes specific to this Next.js version

This repo uses Next.js 16, which has notable breaking changes/renames from earlier versions (e.g. `proxy.ts` replacing `middleware.ts`). Before relying on training-data knowledge of Next.js conventions or APIs, check `node_modules/next/dist/docs/` (bundled with the installed version) rather than assuming pre-16 behavior.
