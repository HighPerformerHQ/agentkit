---
title: Next.js architecture
order: 50
---
This is a single Next.js App Router application. It is both the frontend and
the backend - there is no separate API service.

**Where code goes**

| Concern | Location |
|---|---|
| Routes, pages, layouts | `src/app/` |
| HTTP endpoints | `src/app/api/*/route.ts` |
| Business logic | `src/server/services/` |
| Database schema and client | `src/server/db/` |
| UI components | `src/components/ui/` (generated), `src/components/` (yours) |
| Shared helpers, env parsing | `src/lib/` |

**Rules**

- Route handlers and server actions stay thin: parse input, call a service,
  shape the response. Business logic lives in `src/server/services/` as plain
  functions that take a `db` handle, so it is unit-testable without HTTP.
- Server Components are the default. Add `"use client"` only when you need
  state, effects, or browser APIs, and push it as far down the tree as possible.
- Never read `process.env` outside `src/lib/env.ts`. Import the validated `env`
  object instead - it fails fast at boot on a missing variable.
- Validate every external input (request bodies, search params, form data) with
  zod at the boundary. Do not trust a type assertion for data that came over
  the wire.
