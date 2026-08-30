---
title: Git and pull requests
order: 50
---
- Branch from `main` as `<type>/<short-slug>`, where type is one of
  `feat`, `fix`, `chore`, `docs`, `refactor`, `test`.
- Commit subjects use Conventional Commits: `feat(scope): summary`, imperative
  mood, no trailing period, under 72 characters.
- Never commit directly to `main`, never force-push a shared branch, and never
  amend a commit that is already pushed.
- Do not commit or push unless you were asked to.
- A PR description states what changed, why, and how it was verified.
