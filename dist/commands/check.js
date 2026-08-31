import { promises as fs } from "node:fs";
import path from "node:path";
import { loadCanonical } from "../lib/canonical.js";
import { disabledVendors, planOutput, vendorFootprint } from "../adapters/index.js";
import { exists, listFiles, readTextOrNull } from "../lib/fsx.js";
import { isStale } from "../lib/manifest.js";
import { isOlderThan } from "../lib/version.js";
/**
 * Re-derive every generated file and compare it to the working tree. Exits
 * non-zero on drift so CI catches a hand-edited adapter file or a stale commit.
 *
 * Loads read-only: check must never change the tree it is judging.
 */
export async function check(root) {
    const canonical = await loadCanonical(root, { write: false });
    const { files, mirrors, generatedDirs } = planOutput(canonical);
    const stale = [];
    for (const file of files) {
        const actual = await readTextOrNull(path.join(root, file.path));
        if (actual === null)
            stale.push(`${file.path} (missing)`);
        else if (actual !== file.contents)
            stale.push(`${file.path} (out of date)`);
    }
    for (const mirror of mirrors) {
        stale.push(...(await diffTree(mirror.from, path.join(root, mirror.to), mirror.to)));
    }
    // A generated directory holds exactly what this run would write. Anything
    // else is a command that was renamed or deleted and never cleaned up, which
    // leaves Claude Code and Codex offering something OpenCode has dropped.
    const wanted = new Set(files.map((file) => file.path));
    for (const dir of new Set(generatedDirs)) {
        for (const relative of await listFiles(path.join(root, dir))) {
            const owned = path.join(dir, relative);
            if (!wanted.has(owned))
                stale.push(`${owned} (no longer generated)`);
        }
    }
    stale.push(...(await leftoverVendorFiles(canonical)));
    reportPendingPackWork(canonical.packPlan);
    // Being behind is reported ahead of any drift, because a build that cannot
    // see as far as the one that wrote these files cannot judge them either:
    // every "out of date" below would just be this agentkit's own age.
    const stalePacks = canonical.packPlan.filter((entry) => isStale(entry.action));
    const behind = isOlderThan(canonical.version, canonical.syncedWith);
    if (stalePacks.length > 0 || (behind && stale.length > 0)) {
        console.error(`agentkit check: this agentkit (${canonical.version}) is OLDER than the one ` +
            `that wrote this repo's agent config` +
            `${canonical.syncedWith === undefined ? "" : ` (${canonical.syncedWith})`}`);
        for (const entry of stalePacks)
            console.error(`  .agents/${entry.path}`);
        if (behind)
            for (const entry of stale)
                console.error(`  ${entry}`);
        console.error("\nThis build cannot judge files a newer agentkit wrote. Update agentkit,\n" +
            "or raise the pinned version this repo installs, and run the check again.");
        return 1;
    }
    if (stale.length === 0) {
        console.log("agentkit check: generated files are up to date");
        return 0;
    }
    console.error("agentkit check: generated files are STALE");
    for (const entry of stale)
        console.error(`  ${entry}`);
    console.error("\nRun `agentkit sync` and commit the result.");
    return 1;
}
/** Files still on disk for a vendor the repo no longer enables. */
async function leftoverVendorFiles(canonical) {
    const problems = [];
    for (const vendor of disabledVendors(canonical)) {
        const { files, dirs, mirrors } = vendorFootprint(vendor, canonical);
        for (const relative of [...files, ...dirs]) {
            if (await exists(path.join(canonical.root, relative))) {
                problems.push(`${relative} (${vendor} is not an enabled vendor)`);
            }
        }
        // A mirror may legitimately still hold files agentkit never wrote, so
        // only the ones it did are drift - and the manifest is the list of those.
        for (const dest of mirrors) {
            for (const relative of canonical.mirrored[dest] ?? []) {
                if (await exists(path.join(canonical.root, dest, relative))) {
                    problems.push(`${dest}/${relative} (${vendor} is not an enabled vendor)`);
                }
            }
        }
    }
    return problems;
}
/**
 * Pending pack work is reported but never fails the check. Packs are installed
 * from `main`, so failing here would break CI in every repo the moment agentkit
 * advances - a queue of work, not a broken build.
 */
function reportPendingPackWork(plan) {
    const pending = plan.filter((entry) => entry.action === "seed" || entry.action === "update");
    const conflicts = plan.filter((entry) => entry.action === "conflict");
    if (pending.length > 0) {
        console.log(`agentkit check: ${pending.length} pack file(s) have updates available - run \`agentkit sync\``);
        for (const entry of pending)
            console.log(`  .agents/${entry.path}`);
    }
    if (conflicts.length > 0) {
        console.log(`agentkit check: ${conflicts.length} pack file(s) changed upstream but are locally edited`);
        for (const entry of conflicts)
            console.log(`  .agents/${entry.path}`);
    }
}
/** Byte-compare two directory trees, reporting differences relative to `label`. */
async function diffTree(from, to, label) {
    const sourceFiles = await listFiles(from);
    const destFiles = await listFiles(to);
    const problems = [];
    for (const relative of sourceFiles) {
        if (!destFiles.includes(relative)) {
            problems.push(`${label}/${relative} (missing)`);
            continue;
        }
        const [a, b] = await Promise.all([
            fs.readFile(path.join(from, relative)),
            fs.readFile(path.join(to, relative)),
        ]);
        if (!a.equals(b))
            problems.push(`${label}/${relative} (out of date)`);
    }
    for (const relative of destFiles) {
        if (!sourceFiles.includes(relative)) {
            problems.push(`${label}/${relative} (unexpected)`);
        }
    }
    return problems;
}
