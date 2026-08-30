---
name: debug-failing-test
description: Systematically diagnose a failing or flaky test instead of guessing at fixes. Use when a test suite is red, a test passes locally but fails in CI, or a test fails intermittently.
---
# Debug a failing test

## Never do this first
Do not change the assertion to match the output. Do not add a retry, increase a
timeout, or mark it skipped. Those hide the bug rather than finding it.

## Loop

1. **Reproduce in isolation.** Narrow to the single test:
   ```bash
   pnpm vitest run -t "the test name"
   ```
   If it passes alone but fails in the suite, the cause is shared state -
   a leaked database row, a stubbed clock, or module-level mutation.

2. **Read the actual failure.** The first error is the real one; later failures
   are usually cascades. Quote the assertion's expected vs received exactly.

3. **State a hypothesis** in one sentence before touching any code:
   "The test fails because X, which I can confirm by Y."

4. **Confirm it cheaply.** Add a temporary log or assertion that proves the
   hypothesis true or false. Remove it afterwards.

5. **Fix the cause.** If the test was right, fix the code. If the test encoded
   the wrong expectation, fix the test *and say so explicitly* in your summary -
   this is the one case where changing an assertion is legitimate.

## Flaky tests
Run it repeatedly to establish the rate before claiming it is fixed:
```bash
pnpm vitest run -t "the test name" --repeat 20
```
Common causes: real timers, unawaited promises, shared DB state between tests,
and tests that depend on execution order.
