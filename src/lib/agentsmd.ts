import type { Canonical } from "./types.js";
import { GENERATED_NOTICE } from "./fsx.js";

/**
 * Assemble `.agents/rules/*.md` into the single AGENTS.md that Codex and
 * OpenCode read natively, and that CLAUDE.md imports.
 */
export function renderAgentsMd(canonical: Canonical): string {
  const { config, rules, skills, commands } = canonical;
  const name = config.project?.name ?? "This repository";
  const out: string[] = [];

  out.push(`<!-- ${GENERATED_NOTICE} -->`);
  out.push("");
  out.push(`# ${name}`);
  out.push("");
  if (config.project?.description) {
    out.push(config.project.description);
    out.push("");
  }
  out.push(
    "This file is the shared instruction set for every coding agent working in this repo.",
    "It is read natively by OpenAI Codex and OpenCode, and imported by `CLAUDE.md` for Claude Code.",
  );
  out.push("");

  for (const rule of rules) {
    out.push(`## ${rule.title}`);
    out.push("");
    out.push(rule.content);
    out.push("");
  }

  if (skills.length > 0) {
    out.push("## Available skills");
    out.push("");
    out.push(
      "Skills live in `.agents/skills/`. Load one when its description matches the task.",
    );
    out.push("");
    for (const skill of skills) {
      out.push(`- **${skill.name}** - ${skill.description}`);
    }
    out.push("");
  }

  if (commands.length > 0) {
    out.push("## Available commands");
    out.push("");
    for (const command of commands) {
      out.push(`- **/${command.name}** - ${command.description}`);
    }
    out.push("");
  }

  return `${out.join("\n").trimEnd()}\n`;
}
