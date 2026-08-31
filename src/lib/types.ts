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

/** Everything sync needs, read from the canonical `.agents/` tree. */
export interface Canonical {
  root: string;
  agentsDir: string;
  config: AgentkitConfig;
  /** Version of the agentkit doing the work, for reporting and ordering. */
  version: string;
  skills: Skill[];
  commands: Command[];
  mcp: McpFile;
  /** What reconciling the enabled packs against the manifest decided. */
  packPlan: PackResolution[];
  /** Files agentkit last wrote into each mirror, keyed by destination. */
  mirrored: Record<string, string[]>;
  /** Highest agentkit version that has synced this repo, if it recorded one. */
  syncedWith: string | undefined;
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

/** What reconciling one mirror directory did. */
export interface MirrorResult {
  /** Paths, relative to the mirror, agentkit wrote this time. */
  written: string[];
  /** Paths it wrote before and has now removed, because the source dropped them. */
  removed: string[];
  /** Paths it found but never wrote. Reported, never deleted. */
  foreign: string[];
}

/** What one adapter wants on disk. */
export interface AdapterOutput {
  files: Emission[];
  mirrors: Mirror[];
  /**
   * Directories this vendor fills entirely from `files`, relative to the repo
   * root. Anything else found in one is a leftover from an earlier sync, so
   * `sync` deletes it and `check` reports it. A directory the vendor only
   * partly owns (`.claude/`, which also holds files agentkit never writes)
   * must never be listed here.
   */
  generatedDirs: string[];
}

export const EMPTY_OUTPUT: AdapterOutput = { files: [], mirrors: [], generatedDirs: [] };

/** One pack-seeded file, as last written by agentkit. */
export interface SeedEntry {
  /** Pack that shipped it. */
  pack: string;
  /** Hash of the bytes agentkit wrote, i.e. the unmodified baseline. */
  hash: string;
  /**
   * Version of the agentkit that wrote this entry. Absent on entries written
   * before versions were recorded, which are treated as having no version
   * rather than as version zero.
   */
  agentkit?: string;
  /** Deleted on purpose; `sync` must not re-seed it. */
  removed?: true;
}

/** `.agents/agentkit-manifest.json` - generated, committed, never hand-edited. */
export interface SeedManifest {
  $comment?: string;
  /**
   * Highest agentkit version that has synced this repo. Pack files carry their
   * own version; this covers the other half of what a sync writes, so an older
   * build cannot regenerate a vendor file in an older shape either.
   */
  agentkit?: string;
  /** Keyed by path relative to `.agents/`. */
  seeded: Record<string, SeedEntry>;
  /**
   * Files agentkit last copied into each mirror directory, keyed by the
   * destination relative to the repo root. It is what lets `sync` clear out a
   * skill that was renamed without touching a file it never put there.
   */
  mirrored?: Record<string, string[]>;
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
 * - `stale`     - this agentkit is older than the one that wrote the file:
 *                 the difference means we are behind, not that the pack moved
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
  | "drop"
  | "stale";

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
  /** Version of the running agentkit, for ordering against `entry.agentkit`. */
  version: string;
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
