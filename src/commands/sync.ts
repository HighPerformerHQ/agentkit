import path from "node:path";
import { loadCanonical } from "../lib/canonical.js";
import { planOutput } from "../adapters/index.js";
import { mirrorDir, readTextOrNull, writeText } from "../lib/fsx.js";
import type { Vendor } from "../lib/types.js";

export interface SyncOptions {
  root: string;
  vendors?: Vendor[];
  quiet?: boolean;
}

export async function sync(options: SyncOptions): Promise<number> {
  const canonical = await loadCanonical(options.root);
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
        `${canonical.commands.length} commands, ${canonical.rules.length} rules, ` +
        `${Object.keys(canonical.mcp.servers).length} MCP servers`,
    );
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
