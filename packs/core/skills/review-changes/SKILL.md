---
name: review-changes
description: Review uncommitted or branch changes for correctness bugs, missing tests, and accidental scope creep before opening a pull request. Use when asked to review, self-review, or sanity-check a diff.
---
# Review changes

## Gather the diff
Look at what actually changed, not what you remember changing:

```bash
git status --short
git diff --stat main...HEAD
git diff main...HEAD
```

## What to look for, in priority order

1. **Correctness.** For each changed function, find one concrete input that
   produces a wrong result. If you cannot construct one, say so rather than
   inventing a vague concern.
2. **Error paths.** What happens when the network call fails, the row is
   missing, or the array is empty? Unhandled rejection and silent `catch {}`
   are defects.
3. **Missing tests.** Every behaviour change needs a test that fails without it.
   Check the test actually asserts the new behaviour and is not just a smoke test.
4. **Scope creep.** Flag files in the diff that have nothing to do with the
   stated goal - reformatted imports, unrelated renames, stray console logs.
5. **Boundaries.** Business logic belongs in `src/server/services/`, not in a
   route handler or a React component.

## Report

Group findings by severity. For each: the file and line, one sentence on the
defect, and a concrete failure scenario. Do not pad the list - if the diff is
clean, say it is clean.
