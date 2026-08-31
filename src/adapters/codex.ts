import path from "node:path";
import * as TOML from "smol-toml";
import type { AdapterOutput, Canonical } from "../lib/types.js";
import { notice } from "../lib/fsx.js";

/**
 * Codex needs the least wiring: it discovers AGENTS.md by walking from the
 * project root down to cwd, and discovers skills at `<repo>/.agents/skills`
 * natively. Only MCP servers and prompts need generating.
 */
export function codexAdapter(canonical: Canonical): AdapterOutput {
  const { mcp, commands } = canonical;

  const mcpServers: Record<string, unknown> = {};
  for (const [name, server] of Object.entries(mcp.servers)) {
    if (server.enabled === false) continue;
    mcpServers[name] = {
      command: server.command,
      args: server.args ?? [],
      ...(server.env ? { env: server.env } : {}),
    };
  }

  const config = {
    // Lets Codex fall back to CLAUDE.md if AGENTS.md is ever missing.
    project_doc_fallback_filenames: ["CLAUDE.md"],
    mcp_servers: mcpServers,
  };

  const files = [
    {
      path: path.join(".codex", "config.toml"),
      contents: `${notice("hash")}\n${TOML.stringify(config)}\n`,
    },
  ];

  for (const command of commands) {
    files.push({
      path: path.join(".codex", "prompts", `${command.name}.md`),
      contents: `${command.body}\n`,
    });
  }

  return { files, mirrors: [], generatedDirs: [".codex/prompts"] };
}
