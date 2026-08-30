import type { AdapterOutput, Canonical, Vendor } from "../lib/types.js";
import { claudeAdapter } from "./claude.js";
import { codexAdapter } from "./codex.js";
import { opencodeAdapter } from "./opencode.js";
import { renderAgentsMd } from "../lib/agentsmd.js";

const ADAPTERS: Record<Vendor, (c: Canonical) => AdapterOutput> = {
  claude: claudeAdapter,
  codex: codexAdapter,
  opencode: opencodeAdapter,
};

/**
 * Everything sync should put on disk: the shared AGENTS.md plus each enabled
 * vendor's adapter output. Pure - it touches no files, which is what lets
 * `check` reuse it to diff against the working tree.
 */
export function planOutput(canonical: Canonical): AdapterOutput {
  const files = [{ path: "AGENTS.md", contents: renderAgentsMd(canonical) }];
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
