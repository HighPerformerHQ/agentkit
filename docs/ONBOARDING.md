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

Skills and commands live in `.agents/` in each repo and are seeded from packs in
the `agentkit` repo. Instructions for every run live in `AGENTS.md`, which is
yours alone.

- **Something an agent should know on every run?** Edit `AGENTS.md`. No sync, no
  frontmatter — Codex and OpenCode read it natively and `CLAUDE.md` imports it.
- **A skill for just this project?** `.agents/skills/<name>/SKILL.md`, then
  `npx agentkit sync`. No pack and no registration needed.
- **A skill or command for every project?** Open a PR against `agentkit` adding
  it to `packs/core/`. Every repo receives it on its next `sync`.
- **Something specific to one feature?** That is a spec, not a rule — see below.

**Do not edit a pack-seeded file to add project content.** agentkit tracks what
it wrote in `.agents/agentkit-manifest.json` and updates only the pack files you
have not touched. Editing one keeps your change but forfeits every future
improvement to that file. If a pack file you edited changes upstream, `sync`
reports a `conflict` and leaves your version alone.

**If `sync` says your agentkit is older than the repo's, update it rather than
forcing past it.** The manifest records which version wrote each file, so an
older build can tell that a difference is its own staleness and not a pack
update. Overwriting anyway would undo whatever a teammate committed, and their
next sync would undo yours.

## Writing down what a feature does

`AGENTS.md` describes the project. `docs/specs/` describes its features — one
file each, covering what it does, why it works that way, and what was decided
against. That last part is the point: it is the only thing neither the code nor
the commit history can tell the next person, and it is what stops a rejected
design being proposed again six months later.

The loop, which the `feature-specs` skill will prompt you and your agent through:

1. Before changing a feature, read its spec. `docs/specs/README.md` is the index.
2. After shipping, update the spec in the same change — a spec that lags the
   code is worse than none, because it is trusted and wrong.
3. For a new feature, `/spec <name>` scaffolds one from the template.

Specs are yours: agentkit ships the skill and the template and never touches
`docs/`.

Never hand-edit `CLAUDE.md`, `opencode.json`, `.codex/`, `.mcp.json`, or
`.claude/` — they are generated, carry a `DO NOT EDIT` header, and CI will fail
via `agentkit check`. `AGENTS.md` is the exception: agentkit never writes it.
