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
  shape the response. Logic lives in `src/server/services/` as plain functions
  taking a `db` handle, so it is testable without HTTP.
- Server Components are the default. Add `"use client"` only for state, effects
  or browser APIs, and push it as far down the tree as it will go.
- Never read `process.env` outside `src/lib/env.ts` - import the validated `env`
  object, which fails fast at boot on a missing variable.
- Validate external input (request bodies, search params, form data) with zod at
  the boundary. A type assertion is not validation.
- Never hand-write or edit `src/components/ui/`. Add components with
  `pnpm dlx shadcn@latest add <name>` (`@magicui/<name>` for Magic UI) and wrap
  them if you need different behaviour.
