---
description: Write or update the feature specification in docs/specs/ for a feature
---
Write or update a feature specification in `docs/specs/`.

The feature is: $ARGUMENTS

If that came through empty, ask which feature before doing anything else.

1. Read `docs/specs/README.md`. If it does not exist, create `docs/specs/` and
   start the index with these headings:

   ```markdown
   # Feature specs

   One spec per feature: what it does, why it works that way, and what was
   decided against. Read the row you need, not the whole directory.

   | Feature | Status | What it does | Spec |
   |---|---|---|---|
   ```

2. If the feature already has a spec, open it and update it in place. Do not
   create a second file for the same feature.

3. Otherwise scaffold a new one:

   ```bash
   cp .agents/skills/feature-specs/TEMPLATE.md docs/specs/<slug>.md
   ```

   `<slug>` is kebab-case and matches how the team names the feature.

4. Fill it in from what the code and the conversation actually establish. Where
   you do not know something, write the open question rather than a plausible
   guess - an invented reason is worse than an admitted gap.

5. Add or update the feature's row in `docs/specs/README.md` so the index and
   the `Status:` line agree.

Report which file you wrote and which sections you left open.
