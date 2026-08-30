---
title: Architecture
order: 20
---
A single Next.js App Router application - frontend and backend in one. There is
no separate API service.

| Concern | Location |
|---|---|
| Routes, pages, layouts | `src/app/` |
| HTTP endpoints | `src/app/api/*/route.ts` |
| Business logic | `src/server/services/` |
| Database schema, client, seed | `src/server/db/` |
| Generated UI components | `src/components/ui/` - do not hand-edit |
| Components you write | `src/components/` |
| Shared helpers, env parsing | `src/lib/` |
| Unit tests | `tests/unit/` |
| Integration tests (need Postgres running) | `tests/integration/` |
| End-to-end tests | `tests/e2e/` |

- Route handlers and server actions stay thin: parse input, call a service,
  shape the response. Business logic lives in `src/server/services/` as plain
  functions taking a `db` handle, so it is testable without going through HTTP.
- Server Components are the default. Reach for `"use client"` only when you need
  state, effects, or browser APIs, and push it as far down the tree as you can.
- Never read `process.env` outside `src/lib/env.ts`. Import the validated `env`
  object instead - it fails fast at boot on a missing variable.
- Validate every external input - request bodies, search params, form data -
  with zod at the boundary. A type assertion is not validation.
- Do not hand-write or edit anything in `src/components/ui/`. Add components
  with `pnpm dlx shadcn@latest add <name>`, or `@magicui/<name>` for Magic UI,
  and wrap them if you need different behaviour.
