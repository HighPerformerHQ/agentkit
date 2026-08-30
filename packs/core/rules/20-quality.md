---
title: Definition of done
order: 20
---
A change is done when **all** of these hold:

1. `pnpm verify` passes (lint, format check, typecheck, unit tests).
2. New behaviour has a test that fails without the change.
3. No `any`, no `@ts-expect-error`, and no disabled lint rule was added to make
   the above pass. If a type is genuinely unknowable, use `unknown` and narrow.
4. No secrets, tokens, connection strings, or `.env` files are staged.

If you cannot get to green, stop and report the failing output verbatim rather
than weakening the check.
