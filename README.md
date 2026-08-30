# agentkit

Vendor-agnostic agent configuration for the team. One canonical `.agents/` tree,
generated adapters for **Claude Code**, **OpenAI Codex**, and **OpenCode**.

Write a rule or a skill once. Every developer gets it, whichever agent they use.

## Why this exists

Each agent CLI reads a different set of files. Maintaining three copies of the
same instructions by hand guarantees they drift apart. `agentkit` keeps one
source of truth and generates the rest.

The good news is that the vendors have largely converged, so there is less to
generate than you would expect:

| | Claude Code | Codex | OpenCode |
|---|---|---|---|
| Instructions | `CLAUDE.md` (imports `AGENTS.md`) | `AGENTS.md` — native | `AGENTS.md` — native |
| Skills | `.claude/skills/` — mirrored | `.agents/skills/` — **native** | `.agents/skills/` — **native** |
| MCP servers | `.mcp.json` | `.codex/config.toml` | `opencode.json` |
| Commands | `.claude/commands/` | `.codex/prompts/` | `opencode.json` |

`AGENTS.md` and `.agents/skills/` are read natively by two of the three vendors.
Only Claude Code needs a mirror, and MCP config is the one place where all three
formats genuinely differ — which is most of what the sync step is for.

## Quick start

In any repository:

```bash
npx github:HighPerformerHQ/agentkit sync
```

That writes the canonical `.agents/` tree (seeded from the `core` pack) and
every enabled vendor's adapter files. Commit all of it — a teammate who never
runs `agentkit` still gets a working setup.

## Commands

```bash
agentkit sync                      # write .agents/ and all vendor adapters
agentkit sync --vendors claude     # only emit for some vendors
agentkit check                     # exit 1 if generated files are stale (use in CI)
agentkit doctor                    # which agent CLIs are installed, and is the wiring present
agentkit add nextjs                # enable a pack, then sync
agentkit sync --reseed             # restore pack files you deleted earlier
```

## How it fits together

```
.agents/                     canonical, hand-edited, reviewed in PRs
  agentkit.config.json       which packs and vendors are enabled
  rules/*.md                 assembled in `order` into AGENTS.md
  skills/<name>/SKILL.md     Agent Skills format; read natively by Codex + OpenCode
  commands/<name>.md         slash commands / prompts
  mcp.json                   MCP servers, in a neutral shape
  agentkit-manifest.json     generated; tracks which files came from a pack
        |
        |  agentkit sync
        v
AGENTS.md  CLAUDE.md  .mcp.json  .claude/  .codex/  opencode.json    generated
```

**Two directions, one rule.** `.agents/` is yours. Everything *outside* it is
generated and gets overwritten on every sync; each such file carries a
`DO NOT EDIT` header.

To change what an agent knows, edit `.agents/` and re-run `sync`.

## Packs

| Pack | Contents |
|---|---|
| `core` | Workflow, definition of done, git/PR conventions, secrets handling. Skills: `review-changes`, `debug-failing-test`. Commands: `/verify`, `/db-reset`. |
| `nextjs` | Next.js architecture rules. Skills: `add-ui-component` (shadcn + Magic UI registries), `write-migration` (Drizzle). |

### How pack files are kept up to date

`sync` records what it wrote in `.agents/agentkit-manifest.json`. That baseline
is what lets a pack improvement reach your repo without ever trampling your own
work, because agentkit will only overwrite a file whose current bytes it wrote
itself:

| Your copy | What `sync` does |
|---|---|
| Untouched since it was seeded | Updated to the new pack version |
| Edited by you | Left alone. If the pack also moved, you get a `conflict` notice to merge by hand |
| Deleted by you | Stays deleted. `sync --reseed` brings it back |
| No longer shipped by any pack | Left alone, reported as `orphaned` |

So a pack file is yours the moment you touch it — and it stops receiving
updates at that moment too. **Put project-specific guidance in its own file**
(`.agents/rules/70-my-thing.md`) rather than editing a pack rule, or you trade
away every future improvement to it for one local edit.

Commit the manifest. It is what every teammate's sync reads.

## Keeping it honest in CI

```yaml
- run: npx github:HighPerformerHQ/agentkit check
```

This fails the build if someone hand-edited a generated file or forgot to
commit the result of a sync. It is read-only — it never writes to the tree it
is checking.

Pending pack updates are *reported* here, not failed on. Packs install from
`main`, so failing would break CI in every repo the moment this one advances;
an available update is a queue of work, not a broken build.

This repo is public, so that one-liner needs no token and no secret — it works
the same on a developer's machine and in any repository's CI.

Use `npx`, not `pnpm dlx`: pnpm refuses to run a git-hosted package's build
script unless it is allowlisted by commit SHA, which would need updating on
every commit here.

## Adding your own content

Drop a file into the canonical tree and re-run `sync`:

- **A rule** — `.agents/rules/60-my-rule.md` with `title:` and `order:`
  frontmatter. It gets assembled into `AGENTS.md` in order.
- **A skill** — `.agents/skills/my-skill/SKILL.md` with `name:` and
  `description:` frontmatter. The description is what an agent uses to decide
  whether to load it, so make it say *when to use this*, not just what it is.
  Skills need no pack and no registration: every skill in `.agents/skills/` is
  indexed into `AGENTS.md`, mirrored to `.claude/skills/`, and read natively by
  Codex and OpenCode. A skill that matters to one project belongs in that
  project's repo.
- **A command** — `.agents/commands/my-command.md` with `description:`
  frontmatter.
- **An MCP server** — add an entry to `.agents/mcp.json`.

To promote something to all repos, move it into `packs/core/` here instead —
every repo picks it up on its next `sync`.

Do **not** add project-specific content by editing a pack-seeded file. That
marks the file as yours and it stops receiving pack updates; a new file costs
nothing and keeps both.

## Development

```bash
pnpm install
pnpm build
pnpm typecheck
```
