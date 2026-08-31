import path from "node:path";
import type { AdapterOutput, Canonical } from "../lib/types.js";
import { notice } from "../lib/fsx.js";

/**
 * Claude Code reads CLAUDE.md (which supports `@path` imports), `.claude/`
 * for skills/commands/agents, and `.mcp.json` for MCP servers.
 */
export function claudeAdapter(canonical: Canonical): AdapterOutput {
  const { mcp, agentsDir, commands } = canonical;

  // Claude Code has no AGENTS.md support, but CLAUDE.md `@` imports pull it in
  // verbatim - so the instruction set stays single-sourced.
  const claudeMd = [
    notice("html").trimEnd(),
    "",
    "@AGENTS.md",
    "",
  ].join("\n");

  const mcpServers: Record<string, unknown> = {};
  for (const [name, server] of Object.entries(mcp.servers)) {
    if (server.enabled === false) continue;
    mcpServers[name] = {
      command: server.command,
      ...(server.args ? { args: server.args } : {}),
      ...(server.env ? { env: server.env } : {}),
    };
  }

  const files = [
    { path: "CLAUDE.md", contents: claudeMd },
    {
      path: ".mcp.json",
      contents: `${JSON.stringify({ mcpServers }, null, 2)}\n`,
    },
  ];

  // Claude commands take frontmatter too, but only `description` is shared
  // vocabulary across vendors - anything else is dropped rather than guessed at.
  for (const command of commands) {
    files.push({
      path: path.join(".claude", "commands", `${command.name}.md`),
      contents: renderClaudeCommand(command.description, command.body),
    });
  }

  return {
    files,
    mirrors: [{ from: path.join(agentsDir, "skills"), to: ".claude/skills" }],
    // `.claude/` itself is not listed: settings, subagents and anything else a
    // developer keeps there are not agentkit's to remove.
    generatedDirs: [".claude/commands"],
  };
}

function renderClaudeCommand(description: string, body: string): string {
  return ["---", `description: ${description}`, "---", "", body, ""].join("\n");
}
