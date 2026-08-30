# Onboarding: agentic development setup

Follow this once per machine. Budget ten minutes.

## 1. Base toolchain

```bash
# Node 22+ (this team is on 25.x)
node -v

# pnpm, pinned per-repo via corepack
npm install -g corepack && corepack enable

# Docker Desktop or OrbStack, for local Postgres
docker info
```

Homebrew's Node does not bundle corepack, which is why it is installed
explicitly above.

## 2. Pick your agent

Any of these work — the repo is configured for all three:

| Agent | Install |
|---|---|
| Claude Code | `npm i -g @anthropic-ai/claude-code` |
| OpenAI Codex | `npm i -g @openai/codex` |
| OpenCode | `curl -fsSL https://opencode.ai/install \| bash` |

You do not need to tell your agent about the repo's conventions. They are in
`AGENTS.md`, which every one of these reads (Claude Code via `CLAUDE.md`).

## 3. Start a project

```bash
gh repo create my-app --template HighPerformerHQ/nextjs-starter --private --clone
cd my-app
pnpm install
pnpm setup:init
```

`setup:init` names the project, writes `.env`, starts Postgres, applies
migrations, and seeds. Then:

```bash
pnpm dev
```

## 4. Check the wiring

```bash
npx github:HighPerformerHQ/agentkit doctor
```

This reports which agent CLIs you have and whether their config files are
present. A missing CLI is not a problem — the generated files are committed, so
installing an agent later needs no extra setup.

## Day-to-day

```bash
pnpm dev          # run the app
pnpm verify       # lint + typecheck + unit tests, the pre-PR gate
pnpm test:e2e     # Playwright
pnpm db:generate  # after editing src/server/db/schema.ts
pnpm db:migrate   # apply migrations
```

## Changing the shared setup

Rules, skills, and commands live in `.agents/` in each repo, and are seeded from
packs in the `agentkit` repo.

- **Just this project?** Add a *new* file under `.agents/` — a skill at
  `.agents/skills/<name>/SKILL.md`, a rule at `.agents/rules/70-<name>.md` —
  then run `npx agentkit sync` and commit both it and the regenerated output.
  Project-local skills need no pack and no registration; all three agents pick
  them up.
- **Every project?** Open a PR against `agentkit` adding it to `packs/core/`.
  Every repo receives it on its next `sync`.

**Do not edit a pack-seeded file to add project content.** agentkit tracks what
it wrote in `.agents/agentkit-manifest.json` and updates only the pack files you
have not touched. Editing one keeps your change but forfeits every future
improvement to that file; a separate file keeps both. If a pack file you edited
changes upstream, `sync` reports a `conflict` and leaves your version alone.

Never hand-edit `AGENTS.md`, `CLAUDE.md`, `opencode.json`, `.codex/`, `.mcp.json`,
or `.claude/` — they are generated, carry a `DO NOT EDIT` header, and CI will
fail via `agentkit check`.
