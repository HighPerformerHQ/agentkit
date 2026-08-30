import { promises as fs } from "node:fs";
import path from "node:path";
import { loadCanonical } from "../lib/canonical.js";
import { planOutput } from "../adapters/index.js";
import { listFiles, readTextOrNull } from "../lib/fsx.js";
/**
 * Re-derive every generated file and compare it to the working tree. Exits
 * non-zero on drift so CI catches a hand-edited adapter file or a stale commit.
 *
 * Loads read-only: check must never change the tree it is judging.
 */
export async function check(root) {
    const canonical = await loadCanonical(root, { write: false });
    const { files, mirrors } = planOutput(canonical);
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
    reportPendingPackWork(canonical.packPlan);
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
