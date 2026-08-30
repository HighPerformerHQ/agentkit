---
description: Run the full local quality gate (lint, format, typecheck, unit tests) and fix what fails
---
Run the project's full verification gate:

```bash
pnpm verify
```

If it fails, work through the failures in this order - earlier stages produce
cascading noise in later ones:

1. Formatting and lint (`biome`)
2. Types (`tsc --noEmit`)
3. Unit tests (`vitest`)

Fix the underlying cause. Do not silence a rule, widen a type to `any`, or
delete an assertion to get to green. Re-run until clean, then report the final
output. If something cannot be fixed, stop and show the exact failing output.
