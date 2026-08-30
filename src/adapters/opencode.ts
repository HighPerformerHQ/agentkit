import type { AdapterOutput, Canonical } from "../lib/types.js";

/**
 * OpenCode reads AGENTS.md natively and, like Codex, discovers skills at
 * `.agents/skills/<name>/SKILL.md` - so no skill mirroring is needed here.
 * Only MCP servers and commands differ in shape.
 *
 * Note OpenCode's MCP schema folds command+args into a single array and calls
 * the environment block `environment`, not `env`.
 */
export function opencodeAdapter(canonical: Canonical): AdapterOutput {
  const { mcp, commands, rules } = canonical;

  const mcpBlock: Record<string, unknown> = {};
  for (const [name, server] of Object.entries(mcp.servers)) {
    mcpBlock[name] = {
      type: "local",
      command: [server.command, ...(server.args ?? [])],
      enabled: server.enabled !== false,
      ...(server.env ? { environment: server.env } : {}),
    };
  }

  const commandBlock: Record<string, unknown> = {};
  for (const command of commands) {
    commandBlock[command.name] = {
      description: command.description,
      template: command.body,
      ...(command.frontmatter.agent ? { agent: command.frontmatter.agent } : {}),
    };
  }

  // AGENTS.md already inlines every rule; the rule files are listed too so that
  // editing one is picked up even before the next `agentkit sync`.
  const instructions = [
    "AGENTS.md",
    ...(rules.length > 0 ? [".agents/rules/*.md"] : []),
  ];

  const config = {
    $schema: "https://opencode.ai/config.json",
    instructions,
    ...(Object.keys(mcpBlock).length > 0 ? { mcp: mcpBlock } : {}),
    ...(Object.keys(commandBlock).length > 0 ? { command: commandBlock } : {}),
  };

  return {
    files: [
      {
        // opencode.json has no comment syntax, so the generated marker lives in
        // a key the schema tolerates rather than a comment.
        path: "opencode.json",
        contents: `${JSON.stringify(config, null, 2)}\n`,
      },
    ],
    mirrors: [],
  };
}
