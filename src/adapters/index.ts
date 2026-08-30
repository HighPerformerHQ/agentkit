import type { AdapterOutput, Canonical, Vendor } from "../lib/types.js";
import { claudeAdapter } from "./claude.js";
import { codexAdapter } from "./codex.js";
import { opencodeAdapter } from "./opencode.js";

const ADAPTERS: Record<Vendor, (c: Canonical) => AdapterOutput> = {
  claude: claudeAdapter,
  codex: codexAdapter,
  opencode: opencodeAdapter,
};

/**
 * Everything sync should put on disk: each enabled vendor's adapter output.
 *
 * `AGENTS.md` is deliberately absent. It is the project's own file - stack,
 * business context, and what an agent needs on every run - and no part of it is
 * agentkit's to write. Agents discover skills and commands natively, so
 * indexing them into it bought nothing either.
 *
 * Pure - it touches no files, which is what lets `check` reuse it to diff
 * against the working tree.
 */
export function planOutput(canonical: Canonical): AdapterOutput {
  const files: AdapterOutput["files"] = [];
  const mirrors: AdapterOutput["mirrors"] = [];

  for (const vendor of canonical.config.vendors) {
    const adapter = ADAPTERS[vendor];
    const output = adapter(canonical);
    files.push(...output.files);
    mirrors.push(...output.mirrors);
  }

  return { files, mirrors };
}

export { ADAPTERS };
