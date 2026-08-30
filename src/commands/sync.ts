import path from "node:path";
import { loadCanonical } from "../lib/canonical.js";
import { planOutput } from "../adapters/index.js";
import { mirrorDir, readTextOrNull, writeText } from "../lib/fsx.js";
import { isNoteworthy } from "../lib/manifest.js";
import type { PackAction, Vendor } from "../lib/types.js";

export interface SyncOptions {
  root: string;
  vendors?: Vendor[];
  /** Restore pack files previously deleted on purpose. */
  reseed?: boolean;
  quiet?: boolean;
}

/** What each reported pack action means, in the imperative the user needs. */
const PACK_LABELS: Partial<Record<PackAction, string>> = {
  seed: "added from pack",
  update: "updated from pack",
  adopt: "now tracked",
  tombstone: "deleted locally - will not be re-added (use --reseed to restore)",
  unmanaged: "edited before tracking existed - will not auto-update",
  conflict: "pack changed upstream but you have local edits - review and merge by hand",
  orphaned: "no longer shipped by any enabled pack - delete it if you do not want it",
};

export async function sync(options: SyncOptions): Promise<number> {
  const canonical = await loadCanonical(options.root, {
    reseed: options.reseed === true,
  });
  if (options.vendors && options.vendors.length > 0) {
    canonical.config.vendors = options.vendors;
  }

  const { files, mirrors } = planOutput(canonical);
  const changed: string[] = [];

  for (const file of files) {
    const absolute = path.join(options.root, file.path);
    if ((await readTextOrNull(absolute)) === file.contents) continue;
    await writeText(absolute, file.contents);
    changed.push(file.path);
  }

  for (const mirror of mirrors) {
    await mirrorDir(mirror.from, path.join(options.root, mirror.to));
  }

  if (!options.quiet) {
    const vendorList = canonical.config.vendors.join(", ");
    console.log(`agentkit sync -> ${path.resolve(options.root)}`);
    console.log(`  vendors : ${vendorList}`);
    console.log(`  packs   : ${canonical.config.packs.join(", ")}`);
    console.log(
      `  content : ${canonical.skills.length} skills, ` +
        `${canonical.commands.length} commands, ` +
        `${Object.keys(canonical.mcp.servers).length} MCP servers`,
    );

    // Only the interesting rows: an unchanged pack file is not news.
    const notable = canonical.packPlan.filter((p) => isNoteworthy(p.action));
    if (notable.length > 0) {
      console.log("  packs   :");
      for (const entry of notable) {
        const label = PACK_LABELS[entry.action] ?? entry.action;
        console.log(`            .agents/${entry.path} - ${label}`);
      }
    }

    if (changed.length === 0) {
      console.log("  files   : already up to date");
    } else {
      console.log(`  files   : ${changed.length} written`);
      for (const file of changed) console.log(`            ${file}`);
    }
    for (const mirror of mirrors) console.log(`  mirror  : ${mirror.to}`);
  }

  return 0;
}
