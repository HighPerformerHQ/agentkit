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
```

## How it fits together

```
.agents/                     canonical, hand-edited, reviewed in PRs
  agentkit.config.json       which packs and vendors are enabled
  rules/*.md                 assembled in `order` into AGENTS.md
  skills/<name>/SKILL.md     Agent Skills format; read natively by Codex + OpenCode
  commands/<name>.md         slash commands / prompts
  mcp.json                   MCP servers, in a neutral shape
        |
        |  agentkit sync
        v
AGENTS.md  CLAUDE.md  .mcp.json  .claude/  .codex/  opencode.json    generated
```

**Two directions, one rule.** `.agents/` is yours — `sync` seeds pack content
into it but never overwrites a file that already exists, so hand edits and
team-specific rules are safe. Everything *outside* `.agents/` is generated and
gets overwritten on every sync; each such file carries a `DO NOT EDIT` header.

To change what an agent knows, edit `.agents/` and re-run `sync`.

## Packs

| Pack | Contents |
|---|---|
| `core` | Workflow, definition of done, git/PR conventions, secrets handling. Skills: `review-changes`, `debug-failing-test`. Commands: `/verify`, `/db-reset`. |
| `nextjs` | Next.js architecture rules. Skills: `add-ui-component` (shadcn + Magic UI registries), `write-migration` (Drizzle). |

Packs are seeded once, then owned by your repo. Deleting a rule file you don't
want is a normal, supported thing to do — `sync` will not put it back.

## Keeping it honest in CI

```yaml
- run: npx github:HighPerformerHQ/agentkit check
```

This fails the build if someone hand-edited a generated file or forgot to
commit the result of a sync.

## Adding your own content

Drop a file into the canonical tree and re-run `sync`:

- **A rule** — `.agents/rules/60-my-rule.md` with `title:` and `order:`
  frontmatter. It gets assembled into `AGENTS.md` in order.
- **A skill** — `.agents/skills/my-skill/SKILL.md` with `name:` and
  `description:` frontmatter. The description is what an agent uses to decide
  whether to load it, so make it say *when to use this*, not just what it is.
- **A command** — `.agents/commands/my-command.md` with `description:`
  frontmatter.
- **An MCP server** — add an entry to `.agents/mcp.json`.

To promote something to all repos, move it into `packs/core/` here instead.

## Development

```bash
pnpm install
pnpm build
pnpm typecheck
```
