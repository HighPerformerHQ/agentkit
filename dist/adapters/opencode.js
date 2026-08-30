/**
 * OpenCode reads AGENTS.md natively and, like Codex, discovers skills at
 * `.agents/skills/<name>/SKILL.md` - so no skill mirroring is needed here.
 * Only MCP servers and commands differ in shape.
 *
 * Note OpenCode's MCP schema folds command+args into a single array and calls
 * the environment block `environment`, not `env`.
 */
export function opencodeAdapter(canonical) {
    const { mcp, commands } = canonical;
    const mcpBlock = {};
    for (const [name, server] of Object.entries(mcp.servers)) {
        mcpBlock[name] = {
            type: "local",
            command: [server.command, ...(server.args ?? [])],
            enabled: server.enabled !== false,
            ...(server.env ? { environment: server.env } : {}),
        };
    }
    const commandBlock = {};
    for (const command of commands) {
        commandBlock[command.name] = {
            description: command.description,
            template: command.body,
            ...(command.frontmatter.agent ? { agent: command.frontmatter.agent } : {}),
        };
    }
    // AGENTS.md is the project's own hand-written file. Listed explicitly rather
    // than relying on native discovery, so the config says what it loads.
    const instructions = ["AGENTS.md"];
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
