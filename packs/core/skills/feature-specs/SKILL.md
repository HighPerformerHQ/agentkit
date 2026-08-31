---
name: feature-specs
description: Read and maintain the feature specifications in docs/specs/, the repo's record of what the application does and why. Use before changing any application behaviour, when the reason behind existing behaviour is unclear, and again after shipping a change that alters what the app does.
---
# Feature specs

`docs/specs/` is where this application's behaviour and its reasons are written
down. The code says what happens; a spec says why it happens that way and what
was rejected. Nothing else in the repo carries that.

## Before changing behaviour

1. Read `docs/specs/README.md`. It is the index - one row per feature - and it
   is the fastest answer to "what does this application do".
2. Open only the specs the task touches. Do not read the whole directory; the
   index exists so you do not have to.
3. If the feature has a spec, treat its **Decided against** section as binding.
   Re-proposing something that was already rejected is the failure this
   directory exists to prevent. If you think a rejected option is now right, say
   so explicitly and give the reason the old one no longer holds.
4. If the feature has no spec and the change is more than a fix, write the spec
   first. Writing it is where you discover the questions worth asking.

## After shipping

Update the spec in the same change as the code, not afterwards. A spec that
lags the code is worse than none, because it is trusted and wrong.

- Behaviour changed -> edit the existing spec. Never add a second file for the
  same feature.
- Feature is new -> `cp .agents/skills/feature-specs/TEMPLATE.md docs/specs/<slug>.md`,
  fill it in, and add its row to `docs/specs/README.md`.
- Feature is gone -> set `Status: removed` and say what replaced it. Deleting
  the file loses the reasoning, which is the part worth keeping.
- Move the `Status:` line on when a spec goes from `planned` to `built`. An
  index nobody trusts is an index nobody reads.

## What belongs in a spec

Behaviour, decisions, and constraints. Not implementation.

- **Write:** the rule that an event cannot be deleted once a lead is attached
  to it, and why.
- **Do not write:** which function implements that rule, its signature, or the
  shape of the SQL. Code changes under you; a spec that names line-level detail
  is stale within a week.

Keep it under about 60 lines. Cut *Data* and *Entry points* to a couple of
lines each if the code is easy to find - the sections that earn their space are
**Why**, **Behaviour** and **Decided against**. A long spec is a spec nobody
loads.

If you find yourself writing something that applies to every feature - the
stack, the test commands, the git rules - it belongs in `AGENTS.md`, not here.
