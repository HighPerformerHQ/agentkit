import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_CONFIG,
  type AgentkitConfig,
  type Canonical,
  type Command,
  type McpFile,
  type Rule,
  type Skill,
  type Vendor,
  ALL_VENDORS,
} from "./types.js";
import {
  copyDirIfAbsent,
  exists,
  glob,
  isDir,
  parseFrontmatter,
  readText,
  readTextOrNull,
  writeText,
} from "./fsx.js";

/** Root of the installed agentkit package (where `packs/` lives). */
export function packageRoot(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
}

const DEFAULT_MCP: McpFile = {
  servers: {
    context7: {
      command: "npx",
      args: ["-y", "@upstash/context7-mcp@latest"],
    },
    playwright: {
      command: "npx",
      args: ["-y", "@playwright/mcp@latest"],
    },
  },
};

/**
 * Seed pack content into `.agents/` without overwriting anything already there,
 * then read the whole canonical tree back. Seeding is deliberately additive:
 * `.agents/` is hand-edited and reviewed, so sync must never clobber it.
 */
export async function loadCanonical(root: string): Promise<Canonical> {
  const agentsDir = path.join(root, ".agents");
  const config = await loadConfig(agentsDir);

  for (const pack of config.packs) {
    const packDir = path.join(packageRoot(), "packs", pack);
    if (!(await isDir(packDir))) {
      throw new Error(
        `Unknown pack "${pack}". Available: ${(await listPacks()).join(", ")}`,
      );
    }
    for (const kind of ["skills", "commands", "rules"]) {
      await copyDirIfAbsent(
        path.join(packDir, kind),
        path.join(agentsDir, kind),
        root,
      );
    }
  }

  const mcpPath = path.join(agentsDir, "mcp.json");
  if (!(await exists(mcpPath))) {
    await writeText(mcpPath, `${JSON.stringify(DEFAULT_MCP, null, 2)}\n`);
  }

  return {
    root,
    agentsDir,
    config,
    skills: await readSkills(agentsDir),
    commands: await readCommands(agentsDir),
    rules: await readRules(agentsDir),
    mcp: JSON.parse(await readText(mcpPath)) as McpFile,
    foreignBlocks: extractForeignBlocks(
      await readTextOrNull(path.join(root, "AGENTS.md")),
    ),
  };
}

export async function listPacks(): Promise<string[]> {
  const dir = path.join(packageRoot(), "packs");
  if (!(await isDir(dir))) return [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  return entries.filter((e) => e.isDirectory()).map((e) => e.name).sort();
}

export async function loadConfig(agentsDir: string): Promise<AgentkitConfig> {
  const configPath = path.join(agentsDir, "agentkit.config.json");
  const raw = await readTextOrNull(configPath);
  if (raw === null) {
    await writeText(configPath, `${JSON.stringify(DEFAULT_CONFIG, null, 2)}\n`);
    return structuredClone(DEFAULT_CONFIG);
  }

  const parsed = JSON.parse(raw) as Partial<AgentkitConfig>;
  const vendors = (parsed.vendors ?? DEFAULT_CONFIG.vendors).filter(
    (v): v is Vendor => ALL_VENDORS.includes(v as Vendor),
  );
  return {
    ...DEFAULT_CONFIG,
    ...parsed,
    packs: parsed.packs ?? DEFAULT_CONFIG.packs,
    vendors: vendors.length > 0 ? vendors : DEFAULT_CONFIG.vendors,
  };
}

export async function saveConfig(
  agentsDir: string,
  config: AgentkitConfig,
): Promise<void> {
  await writeText(
    path.join(agentsDir, "agentkit.config.json"),
    `${JSON.stringify(config, null, 2)}\n`,
  );
}

async function readSkills(agentsDir: string): Promise<Skill[]> {
  const dir = path.join(agentsDir, "skills");
  if (!(await isDir(dir))) return [];

  const skills: Skill[] = [];
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const skillMd = path.join(dir, entry.name, "SKILL.md");
    const raw = await readTextOrNull(skillMd);
    if (raw === null) continue;
    const { frontmatter } = parseFrontmatter(raw);
    skills.push({
      name: frontmatter.name ?? entry.name,
      dir: path.join(dir, entry.name),
      description: frontmatter.description ?? "",
    });
  }
  return skills.sort((a, b) => a.name.localeCompare(b.name));
}

async function readCommands(agentsDir: string): Promise<Command[]> {
  const files = await glob("*.md", path.join(agentsDir, "commands"));
  const commands: Command[] = [];
  for (const file of files) {
    const { frontmatter, body } = parseFrontmatter(await readText(file));
    commands.push({
      name: path.basename(file, ".md"),
      path: file,
      description: frontmatter.description ?? "",
      body: body.trim(),
      frontmatter,
    });
  }
  return commands;
}

async function readRules(agentsDir: string): Promise<Rule[]> {
  const files = await glob("*.md", path.join(agentsDir, "rules"));
  const rules: Rule[] = [];
  for (const file of files) {
    const { frontmatter, body } = parseFrontmatter(await readText(file));
    const name = path.basename(file, ".md");
    rules.push({
      name,
      path: file,
      content: body.trim(),
      order: Number.parseInt(frontmatter.order ?? "100", 10),
      title: frontmatter.title ?? name.replace(/[-_]/g, " "),
    });
  }
  return rules.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
}

/**
 * Pull `<!-- BEGIN:name -->...<!-- END:name -->` blocks out of an existing
 * AGENTS.md so a regenerated file keeps them. Next.js writes one of these and
 * re-adds it on every `next dev`; without this, sync and Next would overwrite
 * each other forever.
 */
export function extractForeignBlocks(existing: string | null): string[] {
  if (existing === null) return [];
  const pattern = /<!--\s*BEGIN:([\w-]+)\s*-->[\s\S]*?<!--\s*END:\1\s*-->/g;
  return [...existing.matchAll(pattern)].map((match) => match[0]);
}
