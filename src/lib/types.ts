/** A vendor whose config files agentkit can generate. */
export type Vendor = "claude" | "codex" | "opencode";

export const ALL_VENDORS: Vendor[] = ["claude", "codex", "opencode"];

/** `.agents/agentkit.config.json` — the only hand-maintained knob. */
export interface AgentkitConfig {
  $schema?: string;
  /** Packs whose content is seeded into `.agents/`. */
  packs: string[];
  /** Which vendors to emit adapter files for. */
  vendors: Vendor[];
  /** Shown at the top of the generated AGENTS.md. */
  project?: {
    name?: string;
    description?: string;
  };
}

export const DEFAULT_CONFIG: AgentkitConfig = {
  $schema: "https://raw.githubusercontent.com/HighPerformerHQ/agentkit/main/schema.json",
  packs: ["core"],
  vendors: ["claude", "codex", "opencode"],
};

/** One MCP server, in agentkit's neutral shape. */
export interface McpServer {
  /** Executable to run, e.g. "npx". */
  command: string;
  args?: string[];
  env?: Record<string, string>;
  /** Set false to keep the entry but not load it. */
  enabled?: boolean;
}

export interface McpFile {
  $schema?: string;
  servers: Record<string, McpServer>;
}

/** A skill directory (`SKILL.md` plus any bundled resources). */
export interface Skill {
  name: string;
  /** Absolute path to the skill directory. */
  dir: string;
  description: string;
}

/** A slash-command / prompt file. */
export interface Command {
  name: string;
  path: string;
  description: string;
  body: string;
  /** Raw frontmatter, passed through to vendors that understand it. */
  frontmatter: Record<string, string>;
}

export interface Rule {
  name: string;
  path: string;
  content: string;
  /** Controls assembly order in AGENTS.md; lower runs first. */
  order: number;
  title: string;
}

/** Everything sync needs, read from the canonical `.agents/` tree. */
export interface Canonical {
  root: string;
  agentsDir: string;
  config: AgentkitConfig;
  skills: Skill[];
  commands: Command[];
  rules: Rule[];
  mcp: McpFile;
  /**
   * `<!-- BEGIN:x -->...<!-- END:x -->` blocks found in an existing AGENTS.md
   * that agentkit did not write. Other tools inject these (Next.js re-adds one
   * on every `next dev`), so they are carried through rather than clobbered.
   */
  foreignBlocks: string[];
  /** What reconciling the enabled packs against the manifest decided. */
  packPlan: PackResolution[];
}

/** A file an adapter wants written. Compared by content in `check`. */
export interface Emission {
  /** Path relative to the repo root. */
  path: string;
  contents: string;
}

/** A directory copied verbatim into a vendor location (skills, commands). */
export interface Mirror {
  /** Absolute source directory. */
  from: string;
  /** Destination directory, relative to the repo root. */
  to: string;
}

/** What one adapter wants on disk. */
export interface AdapterOutput {
  files: Emission[];
  mirrors: Mirror[];
}

export const EMPTY_OUTPUT: AdapterOutput = { files: [], mirrors: [] };

/** One pack-seeded file, as last written by agentkit. */
export interface SeedEntry {
  /** Pack that shipped it. */
  pack: string;
  /** Hash of the bytes agentkit wrote, i.e. the unmodified baseline. */
  hash: string;
  /** Deleted on purpose; `sync` must not re-seed it. */
  removed?: true;
}

/** `.agents/agentkit-manifest.json` - generated, committed, never hand-edited. */
export interface SeedManifest {
  $comment?: string;
  /** Keyed by path relative to `.agents/`. */
  seeded: Record<string, SeedEntry>;
}

/**
 * What to do with one pack file.
 *
 * - `seed`      - not present locally and never was: write it
 * - `adopt`     - present and byte-identical to the pack: start tracking it
 * - `unmanaged` - present but already edited before tracking existed: hands off
 * - `tombstone` - was seeded, now deleted locally: record the deletion
 * - `removed`   - already tombstoned and still gone
 * - `current`   - tracked, unmodified, pack unchanged
 * - `update`    - tracked, unmodified, pack moved: safe to overwrite
 * - `modified`  - locally edited, pack unchanged
 * - `conflict`  - locally edited AND the pack moved: leave it, say so
 * - `orphaned`  - the pack no longer ships it (or was disabled)
 * - `drop`      - gone from both sides: forget the entry
 */
export type PackAction =
  | "seed"
  | "adopt"
  | "unmanaged"
  | "tombstone"
  | "removed"
  | "current"
  | "update"
  | "modified"
  | "conflict"
  | "orphaned"
  | "drop";

/** Inputs to the resolution decision for a single file. */
export interface PackFileState {
  /** Path relative to `.agents/`. */
  path: string;
  pack: string;
  /** Hash of the pack's copy, or null if no enabled pack ships it. */
  packHash: string | null;
  /** Hash of the file in the target repo, or null if absent. */
  localHash: string | null;
  entry: SeedEntry | undefined;
}

export interface PackResolution {
  path: string;
  pack: string;
  action: PackAction;
}

/** How `loadCanonical` should behave. */
export interface LoadOptions {
  /** False makes the load read-only, so `check` never mutates a working tree. */
  write?: boolean;
  /** Restore files previously tombstoned as `removed`. */
  reseed?: boolean;
}
