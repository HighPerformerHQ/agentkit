import type { AdapterOutput, Canonical, Vendor } from "../lib/types.js";
import { ALL_VENDORS } from "../lib/types.js";
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
 *
 * `vendors` overrides the enabled set for this run only (`sync --vendors`).
 * It narrows what is written; it never decides what is stale, because a vendor
 * left out of one command is not a vendor the repo has stopped using.
 */
export function planOutput(
  canonical: Canonical,
  vendors: Vendor[] = canonical.config.vendors,
): AdapterOutput {
  const files: AdapterOutput["files"] = [];
  const mirrors: AdapterOutput["mirrors"] = [];
  const generatedDirs: string[] = [];

  for (const vendor of vendors) {
    const output = ADAPTERS[vendor](canonical);
    files.push(...output.files);
    mirrors.push(...output.mirrors);
    generatedDirs.push(...output.generatedDirs);
  }

  return { files, mirrors, generatedDirs };
}

/**
 * Every path one vendor would own if it were enabled, whether it is or not.
 *
 * Asking the adapter rather than keeping a second hand-written list means a
 * vendor's cleanup can never fall behind what it emits: a new generated file
 * is in its footprint the moment the adapter learns to write it.
 */
export function vendorFootprint(
  vendor: Vendor,
  canonical: Canonical,
): { files: string[]; dirs: string[]; mirrors: string[] } {
  const output = ADAPTERS[vendor](canonical);
  return {
    files: output.files.map((file) => file.path),
    dirs: output.generatedDirs,
    // Kept apart from `dirs`: a mirror has a record of what agentkit put in
    // it, so switching a vendor off clears its own files and leaves the rest.
    mirrors: output.mirrors.map((mirror) => mirror.to),
  };
}

/** Vendors this repo has switched off, whose generated files should be gone. */
export function disabledVendors(canonical: Canonical): Vendor[] {
  return ALL_VENDORS.filter((v) => !canonical.config.vendors.includes(v));
}

export { ADAPTERS };
