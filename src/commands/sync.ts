import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadCanonical } from "../lib/canonical.js";
import { disabledVendors, planOutput, vendorFootprint } from "../adapters/index.js";
import {
  exists,
  listFiles,
  readTextOrNull,
  reconcileMirror,
  removeEmptyParents,
  writeText,
} from "../lib/fsx.js";
import { isNoteworthy, isStale, readManifest, writeManifest } from "../lib/manifest.js";
import { compareVersions, isOlderThan } from "../lib/version.js";
import type { Canonical, PackAction, SeedManifest, Vendor } from "../lib/types.js";

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
  stale: "written by a newer agentkit than this one - left untouched",
};

export async function sync(options: SyncOptions): Promise<number> {
  const canonical = await loadCanonical(options.root, {
    reseed: options.reseed === true,
  });

  // The flag narrows this run's output. `config.vendors` still says which
  // vendors the repo uses, and only that decides whose files are stale - so
  // `sync --vendors claude` never deletes the Codex config it did not write.
  const emitFor = options.vendors?.length ? options.vendors : canonical.config.vendors;
  const { files, mirrors, generatedDirs } = planOutput(canonical, emitFor);

  const manifest = await readManifest(canonical.agentsDir);
  manifest.mirrored ??= {};

  const pending: string[] = [];
  for (const file of files) {
    const absolute = path.join(options.root, file.path);
    if ((await readTextOrNull(absolute)) !== file.contents) pending.push(file.path);
  }

  // Refuse before writing anything. Pack files carry their own version and
  // were already skipped by the loader; this is the other half - an older
  // build regenerating a vendor file in an older shape, which a teammate's
  // newer build then rewrites, and back again.
  const behind = isOlderThan(canonical.version, manifest.agentkit);
  const staleFiles = canonical.packPlan.filter((entry) => isStale(entry.action));
  if (staleFiles.length > 0 || (behind && pending.length > 0)) {
    refuse(canonical.version, manifest.agentkit, staleFiles.map((e) => `.agents/${e.path}`), behind ? pending : []);
    return 1;
  }

  const changed: string[] = [];
  for (const file of files) {
    if (!pending.includes(file.path)) continue;
    await writeText(path.join(options.root, file.path), file.contents);
    changed.push(file.path);
  }
  const foreign: string[] = [];
  const removed: string[] = [];

  for (const mirror of mirrors) {
    const result = await reconcileMirror(
      mirror.from,
      path.join(options.root, mirror.to),
      manifest.mirrored[mirror.to] ?? [],
    );
    manifest.mirrored[mirror.to] = result.written;
    removed.push(...result.removed.map((r) => `${mirror.to}/${r}`));
    foreign.push(...result.foreign.map((f) => `${mirror.to}/${f}`));
  }

  removed.push(...(await pruneGeneratedDirs(options.root, generatedDirs, files)));

  const off = await pruneDisabledVendors(canonical, manifest);
  removed.push(...off.removed);
  foreign.push(...off.foreign);

  // Only ever raises: an older build that got this far wrote nothing a newer
  // one had not already written, so it must not lower the bar for the next.
  if ((compareVersions(canonical.version, manifest.agentkit ?? "0.0.0") ?? 1) > 0) {
    manifest.agentkit = canonical.version;
  }
  await writeManifest(canonical.agentsDir, manifest);

  if (!options.quiet) {
    report(canonical, emitFor, changed, removed, foreign, mirrors.map((m) => m.to));
  }

  return 0;
}

/**
 * Stop rather than undo a teammate's work. Reached when this build is older
 * than the one that last wrote the repo and would write something different.
 */
function refuse(
  version: string,
  wrote: string | undefined,
  packFiles: string[],
  generated: string[],
): void {
  console.error(
    `agentkit ${version} is older than the agentkit that last wrote this repo's ` +
      `agent config${wrote === undefined ? "" : ` (${wrote})`}, so nothing was written.`,
  );
  for (const file of [...packFiles, ...generated]) console.error(`  ${file}`);
  console.error(
    "\nUpdate agentkit and sync again. Writing these from this build would undo\n" +
      "work a teammate already committed, and their next sync would undo yours.\n" +
      "  npx --yes github:HighPerformerHQ/agentkit sync",
  );
}

/**
 * Remove files left in a directory the vendor fills entirely. Renaming a
 * command used to leave the old one behind in `.claude/commands` and
 * `.codex/prompts` for good, so the agents that read those directories kept
 * offering a command the canonical tree had dropped.
 */
async function pruneGeneratedDirs(
  root: string,
  dirs: string[],
  files: { path: string }[],
): Promise<string[]> {
  const wanted = new Set(files.map((file) => file.path));
  const removed: string[] = [];

  for (const dir of new Set(dirs)) {
    for (const relative of await listFiles(path.join(root, dir))) {
      const owned = path.join(dir, relative);
      if (wanted.has(owned)) continue;
      await fs.rm(path.join(root, owned), { force: true });
      await removeEmptyParents(root, owned);
      removed.push(owned);
    }
  }
  return removed;
}

/**
 * Clear out a vendor the repo has switched off, so nothing still configures an
 * agent the team believes is disabled. Its mirrors go through the same
 * reconcile as a live sync, so turning a vendor off is not a way to lose a
 * file agentkit never wrote.
 */
async function pruneDisabledVendors(
  canonical: Canonical,
  manifest: SeedManifest,
): Promise<{ removed: string[]; foreign: string[] }> {
  const removed: string[] = [];
  const foreign: string[] = [];

  for (const vendor of disabledVendors(canonical)) {
    const { files, dirs, mirrors } = vendorFootprint(vendor, canonical);

    for (const relative of [...files, ...dirs]) {
      const absolute = path.join(canonical.root, relative);
      if (!(await exists(absolute))) continue;
      await fs.rm(absolute, { recursive: true, force: true });
      await removeEmptyParents(canonical.root, relative);
      removed.push(relative);
    }

    for (const dest of mirrors) {
      const absolute = path.join(canonical.root, dest);
      if (!(await exists(absolute))) continue;
      // Reconciling against nothing: every file agentkit put here goes.
      const result = await emptyMirror(absolute, manifest.mirrored?.[dest] ?? []);
      delete manifest.mirrored?.[dest];
      removed.push(...result.removed.map((r) => `${dest}/${r}`));
      foreign.push(...result.foreign.map((f) => `${dest}/${f}`));
      await removeEmptyParents(canonical.root, `${dest}/.`);
    }
  }
  return { removed, foreign };
}

/** Reconcile a mirror against an empty source, keeping what is not agentkit's. */
async function emptyMirror(dest: string, previous: string[]) {
  const empty = await fs.mkdtemp(path.join(os.tmpdir(), "agentkit-empty-"));
  try {
    return await reconcileMirror(empty, dest, previous);
  } finally {
    await fs.rm(empty, { recursive: true, force: true });
  }
}

function report(
  canonical: Canonical,
  emitFor: Vendor[],
  changed: string[],
  removed: string[],
  foreign: string[],
  mirrorDirs: string[],
): void {
  console.log(`agentkit ${canonical.version} sync`);
  console.log(`  vendors : ${emitFor.join(", ")}`);
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

  if (removed.length > 0) {
    console.log(`  removed : ${removed.length} no longer generated`);
    for (const file of removed) console.log(`            ${file}`);
  }

  for (const dir of mirrorDirs) console.log(`  mirror  : ${dir}`);

  // Never deleted, always mentioned: a file agentkit did not write is someone's.
  if (foreign.length > 0) {
    console.log(`  kept    : ${foreign.length} file(s) agentkit did not write`);
    for (const file of foreign) console.log(`            ${file}`);
    console.log(
      "            These sit in a generated directory but are yours, so they\n" +
        "            were left in place. A skill belongs in .agents/skills/,\n" +
        "            where every vendor gets it; `agentkit check` will fail\n" +
        "            until it is moved or deleted.",
    );
  }
}
