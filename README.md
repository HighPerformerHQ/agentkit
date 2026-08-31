# agentkit

Vendor-agnostic agent configuration for the team. One canonical `.agents/` tree,
generated adapters for **Claude Code**, **OpenAI Codex**, and **OpenCode**.

Write a skill or a command once. Every developer gets it, whichever agent they
use.

**`AGENTS.md` is not agentkit's.** It is the project's own hand-written file —
stack, business context, and what an agent needs on every run. agentkit manages
the vendor plumbing around it: skills, commands, and MCP servers.

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

Note the first row: **`AGENTS.md` is listed as an input, not an output.** You
write it; agentkit only points each vendor at it.

## Quick start

In any repository:

```bash
npx github:HighPerformerHQ/agentkit sync
```

That writes the canonical `.agents/` tree (seeded from the `core` pack) and
every enabled vendor's adapter files. Commit all of it — a teammate who never
runs `agentkit` still gets a working setup.

It does **not** create or touch `AGENTS.md`. Write that yourself.

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
  skills/<name>/SKILL.md     Agent Skills format; read natively by Codex + OpenCode
  commands/<name>.md         slash commands / prompts
  mcp.json                   MCP servers, in a neutral shape
  agentkit-manifest.json     generated; tracks which files came from a pack
        |
        |  agentkit sync
        v
CLAUDE.md  .mcp.json  .claude/  .codex/  opencode.json          generated

AGENTS.md                                                       yours, untouched
```

**Two directions, one rule.** `.agents/` is yours, and so is `AGENTS.md`.
Everything else in that second block is generated and gets overwritten on every
sync; each such file carries a `DO NOT EDIT` header.

Generated means generated in both directions: delete a command from `.agents/`
and `sync` removes it from `.claude/commands/` and `.codex/prompts/` too, and
switching a vendor off in `agentkit.config.json` takes its files with it. The one
thing `sync` will not delete is a file it never wrote. Leave your own skill in
`.claude/skills/` and it stays there, named in the sync output - though `check`
will fail until you move it to `.agents/skills/`, where all three vendors get
it, or delete it.

To change what an agent knows on every run, edit `AGENTS.md` — no sync needed,
all three vendors read it directly. To change what skills or MCP servers it has,
edit `.agents/` and re-run `sync`.

## Packs

| Pack | Contents |
|---|---|
| `core` | Skills: `review-changes`, `debug-failing-test`, `feature-specs`. Commands: `/verify`, `/db-reset`, `/spec`. |
| `nextjs` | Skills: `add-ui-component` (shadcn + Magic UI registries), `write-migration` (Drizzle). |

Packs ship **skills, commands and MCP servers** — the things a vendor needs
wiring for. They do not ship prose instructions: those belong in your
`AGENTS.md`, which no tool should be rewriting.

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
| Written by a newer agentkit than yours | Left alone, reported as `stale`. Update agentkit |

So a pack file is yours the moment you touch it — and it stops receiving
updates at that moment too. **Put project-specific guidance in `AGENTS.md`, or
in a skill of your own**, rather than editing a pack skill, or you trade away
every future improvement to it for one local edit.

Commit the manifest. It is what every teammate's sync reads.

## Feature specs

`AGENTS.md` says what a project *is*. It cannot say why each feature behaves the
way it does, or which alternatives were rejected — that grows with the product
and would swamp a file read on every run.

So the `core` pack ships a convention: one spec per feature in **`docs/specs/`**,
indexed by `docs/specs/README.md`. The `feature-specs` skill tells an agent to
read the relevant spec before changing behaviour and to update it afterwards;
`/spec <feature>` scaffolds one from the template that ships beside the skill.

**agentkit never writes a spec, an index, or the directory.** Same rule as
`AGENTS.md`: the mechanism is shared, the content is the project's. CI asserts
that `sync` creates no `docs/`.

Repos created from `nextjs-starter` already point at this. In any other repo,
add three lines to `AGENTS.md` — nothing loads `docs/specs/` automatically:

```markdown
## Feature specs

`docs/specs/` holds one spec per feature: what it does, why it works that way,
and what was decided against. `docs/specs/README.md` is the index — read the row
you need before changing a feature, and update the spec in the same change.
```

Keep the index short and the specs shorter. The index is read on every run; an
individual spec is read on demand, and one that runs past ~60 lines is one
nobody loads.

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

Two things do fail: a generated file that no longer matches its source (which
now includes one left behind by a deleted command or a disabled vendor), and an
agentkit older than the one that last wrote the repo. The second is worth
pinning for - `npx github:HighPerformerHQ/agentkit#v0.2.0` in a repo's
`agentkit:sync` and `agentkit:check` scripts turns a pack update into a bump PR
somebody reviews, instead of an ambient change that lands on whoever syncs
next. Tracking `main` still works; it just means every repo picks up pack
changes in whatever order people happen to run `sync`.

This repo is public, so that one-liner needs no token and no secret — it works
the same on a developer's machine and in any repository's CI.

Use `npx`, not `pnpm dlx`: pnpm refuses to run a git-hosted package's build
script unless it is allowlisted by commit SHA, which would need updating on
every commit here.

## Adding your own content

Drop a file into the canonical tree and re-run `sync`:

- **An instruction for every run** — write it in `AGENTS.md` directly. No sync,
  no frontmatter: all three vendors read that file.
- **A skill** — `.agents/skills/my-skill/SKILL.md` with `name:` and
  `description:` frontmatter. The description is what an agent uses to decide
  whether to load it, so make it say *when to use this*, not just what it is.
  Skills need no pack and no registration: every skill in `.agents/skills/` is
  mirrored to `.claude/skills/` and read natively by Codex and OpenCode. A skill
  that matters to one project belongs in that project's repo. Files sitting
  beside a `SKILL.md` travel with it, so a skill can ship its own template or
  checklist.
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
