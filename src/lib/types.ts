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
  $schema: "https://raw.githubusercontent.com/mparucha/agentkit/main/schema.json",
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
