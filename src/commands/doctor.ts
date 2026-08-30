import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { loadConfig } from "../lib/canonical.js";
import { exists } from "../lib/fsx.js";

const run = promisify(execFile);

interface VendorProbe {
  vendor: string;
  cli: string;
  /** Files that must exist for this vendor to pick the repo config up. */
  wiring: string[];
}

const PROBES: VendorProbe[] = [
  { vendor: "Claude Code", cli: "claude", wiring: ["CLAUDE.md", ".mcp.json", ".claude/skills"] },
  { vendor: "OpenAI Codex", cli: "codex", wiring: ["AGENTS.md", ".codex/config.toml", ".agents/skills"] },
  { vendor: "OpenCode", cli: "opencode", wiring: ["AGENTS.md", "opencode.json", ".agents/skills"] },
];

/** Report which agent CLIs are installed and whether their wiring is present. */
export async function doctor(root: string): Promise<number> {
  const config = await loadConfig(path.join(root, ".agents"));
  console.log(`agentkit doctor -> ${path.resolve(root)}`);
  console.log(`  enabled vendors: ${config.vendors.join(", ")}\n`);

  for (const probe of PROBES) {
    const version = await cliVersion(probe.cli);
    const installed = version !== null ? `installed (${version})` : "not installed";
    console.log(`${probe.vendor}`);
    console.log(`  cli    : ${probe.cli} - ${installed}`);
    for (const file of probe.wiring) {
      const present = await exists(path.join(root, file));
      console.log(`  ${present ? "ok  " : "MISS"}   ${file}`);
    }
    console.log("");
  }

  console.log("Note: a missing CLI is not an error - the generated files are");
  console.log("committed, so a teammate who installs it later is already set up.");
  return 0;
}

async function cliVersion(cli: string): Promise<string | null> {
  try {
    const { stdout } = await run(cli, ["--version"], { timeout: 10_000 });
    return stdout.trim().split("\n")[0] ?? "unknown";
  } catch {
    return null;
  }
}
