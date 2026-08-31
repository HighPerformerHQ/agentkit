import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { sync } from "./sync.js";
import { check } from "./check.js";
import { exists, readTextOrNull } from "../lib/fsx.js";
import { readManifest } from "../lib/manifest.js";
async function scratch(vendors = ["claude", "codex", "opencode"]) {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "agentkit-sync-"));
    await fs.mkdir(path.join(root, ".agents"), { recursive: true });
    await fs.writeFile(path.join(root, ".agents", "agentkit.config.json"), JSON.stringify({ packs: ["core"], vendors }, null, 2));
    await sync({ root, quiet: true });
    return root;
}
async function setVendors(root, vendors) {
    await fs.writeFile(path.join(root, ".agents", "agentkit.config.json"), JSON.stringify({ packs: ["core"], vendors }, null, 2));
}
/** Silence a command's own output while a test drives it. */
async function quietly(run) {
    const { log, error } = console;
    console.log = () => { };
    console.error = () => { };
    try {
        return await run();
    }
    finally {
        console.log = log;
        console.error = error;
    }
}
// A command that leaves the canonical tree has to leave every vendor at once.
// While only OpenCode noticed, Claude Code and Codex kept offering it.
test("deleting a command removes it from every vendor", async () => {
    const root = await scratch();
    assert.ok(await exists(path.join(root, ".claude/commands/db-reset.md")));
    assert.ok(await exists(path.join(root, ".codex/prompts/db-reset.md")));
    await fs.rm(path.join(root, ".agents/commands/db-reset.md"));
    await sync({ root, quiet: true });
    assert.equal(await exists(path.join(root, ".claude/commands/db-reset.md")), false);
    assert.equal(await exists(path.join(root, ".codex/prompts/db-reset.md")), false);
    const opencode = await readTextOrNull(path.join(root, "opencode.json"));
    assert.ok(!opencode?.includes("db-reset"));
});
test("check fails on a generated command the canonical tree has dropped", async () => {
    const root = await scratch();
    await fs.rm(path.join(root, ".agents/commands/db-reset.md"));
    await sync({ root, quiet: true });
    // Put the leftover back by hand: this is the state a pre-pruning sync left.
    await fs.writeFile(path.join(root, ".claude/commands/db-reset.md"), "stale\n");
    assert.equal(await quietly(() => check(root)), 1);
});
test("disabling a vendor takes its generated files with it", async () => {
    const root = await scratch();
    await setVendors(root, ["claude"]);
    await sync({ root, quiet: true });
    assert.equal(await exists(path.join(root, ".codex")), false);
    assert.equal(await exists(path.join(root, "opencode.json")), false);
    assert.ok(await exists(path.join(root, "CLAUDE.md")));
});
test("check fails while a disabled vendor's config is still on disk", async () => {
    const root = await scratch();
    await setVendors(root, ["claude"]);
    assert.equal(await quietly(() => check(root)), 1);
});
// `--vendors` narrows one run's output. Treating it as the enabled set would
// make `sync --vendors claude` delete the Codex config it simply skipped.
test("--vendors narrows what is written without deleting the rest", async () => {
    const root = await scratch();
    await sync({ root, vendors: ["claude"], quiet: true });
    assert.ok(await exists(path.join(root, ".codex/config.toml")));
    assert.ok(await exists(path.join(root, "opencode.json")));
});
// The mirror used to empty its destination before copying, which took a
// developer's own work with it and said nothing.
test("the skills mirror leaves a file agentkit never wrote", async () => {
    const root = await scratch();
    const mine = path.join(root, ".claude/skills/my-own-skill/SKILL.md");
    await fs.mkdir(path.dirname(mine), { recursive: true });
    await fs.writeFile(mine, "mine\n");
    await sync({ root, quiet: true });
    assert.equal(await readTextOrNull(mine), "mine\n");
});
test("the skills mirror clears out a skill the canonical tree dropped", async () => {
    const root = await scratch();
    const mirrored = path.join(root, ".claude/skills/review-changes/SKILL.md");
    assert.ok(await exists(mirrored));
    await fs.rm(path.join(root, ".agents/skills/review-changes"), { recursive: true });
    await sync({ root, quiet: true });
    assert.equal(await exists(mirrored), false);
    assert.equal(await exists(path.dirname(mirrored)), false, "no empty husk left behind");
});
test("the mirror records what it wrote, so a later sync knows what is its own", async () => {
    const root = await scratch();
    const manifest = await readManifest(path.join(root, ".agents"));
    const written = manifest.mirrored?.[".claude/skills"] ?? [];
    assert.ok(written.includes("review-changes/SKILL.md"));
    assert.ok(!written.includes("my-own-skill/SKILL.md"));
});
// The version guard. Two developers on different agentkits used to overwrite
// each other's pack files indefinitely, one commit at a time.
test("sync refuses, and exits non-zero, when the repo was written by a newer agentkit", async () => {
    const root = await scratch();
    const manifestPath = path.join(root, ".agents/agentkit-manifest.json");
    const raw = JSON.parse(await fs.readFile(manifestPath, "utf8"));
    // A teammate on a later agentkit synced this repo and committed the result.
    raw.seeded["skills/review-changes/SKILL.md"].agentkit = "999.0.0";
    raw.seeded["skills/review-changes/SKILL.md"].hash = "sha256-something-newer";
    await fs.writeFile(manifestPath, JSON.stringify(raw, null, 2));
    const code = await quietly(() => sync({ root, quiet: true }));
    assert.equal(code, 1);
    // And the file it refused to touch is exactly as it was.
    const after = JSON.parse(await fs.readFile(manifestPath, "utf8"));
    assert.equal(after.seeded["skills/review-changes/SKILL.md"].agentkit, "999.0.0");
    assert.equal(after.seeded["skills/review-changes/SKILL.md"].hash, "sha256-something-newer");
});
test("check fails rather than judging files a newer agentkit wrote", async () => {
    const root = await scratch();
    const manifestPath = path.join(root, ".agents/agentkit-manifest.json");
    const raw = JSON.parse(await fs.readFile(manifestPath, "utf8"));
    raw.seeded["skills/review-changes/SKILL.md"].agentkit = "999.0.0";
    raw.seeded["skills/review-changes/SKILL.md"].hash = "sha256-something-newer";
    await fs.writeFile(manifestPath, JSON.stringify(raw, null, 2));
    assert.equal(await quietly(() => check(root)), 1);
});
test("a sync that changes nothing still leaves check happy", async () => {
    const root = await scratch();
    assert.equal(await quietly(() => sync({ root, quiet: true })), 0);
    assert.equal(await quietly(() => check(root)), 0);
});
// Switching a vendor off must not become a second way to lose work: the
// mirror it owns is cleared through the same record-aware reconcile.
test("disabling claude clears its mirror but keeps a file agentkit never wrote", async () => {
    const root = await scratch();
    const mine = path.join(root, ".claude/skills/my-own-skill/SKILL.md");
    await fs.mkdir(path.dirname(mine), { recursive: true });
    await fs.writeFile(mine, "mine\n");
    await sync({ root, quiet: true });
    await setVendors(root, ["codex"]);
    await sync({ root, quiet: true });
    assert.equal(await exists(path.join(root, ".claude/skills/review-changes")), false);
    assert.equal(await exists(path.join(root, "CLAUDE.md")), false);
    assert.equal(await readTextOrNull(mine), "mine\n", "a developer's own file survives");
});
test("check does not fault a disabled vendor for a file agentkit never wrote", async () => {
    const root = await scratch();
    await sync({ root, quiet: true });
    const mine = path.join(root, ".claude/skills/my-own-skill/SKILL.md");
    await fs.mkdir(path.dirname(mine), { recursive: true });
    await fs.writeFile(mine, "mine\n");
    await setVendors(root, ["codex"]);
    await sync({ root, quiet: true });
    assert.equal(await quietly(() => check(root)), 0);
});
// The same protection has to cover generated files. An older build that
// regenerated CLAUDE.md in an older shape would start the identical loop.
test("an older agentkit will not regenerate a vendor file, and writes nothing", async () => {
    const root = await scratch();
    const manifestPath = path.join(root, ".agents/agentkit-manifest.json");
    const raw = JSON.parse(await fs.readFile(manifestPath, "utf8"));
    raw.agentkit = "999.0.0";
    await fs.writeFile(manifestPath, JSON.stringify(raw, null, 2));
    // A newer agentkit would have written this differently.
    await fs.writeFile(path.join(root, "CLAUDE.md"), "a newer shape\n");
    assert.equal(await quietly(() => sync({ root, quiet: true })), 1);
    assert.equal(await readTextOrNull(path.join(root, "CLAUDE.md")), "a newer shape\n");
    assert.equal(await quietly(() => check(root)), 1);
});
test("an older agentkit that would change nothing is left to work", async () => {
    const root = await scratch();
    const manifestPath = path.join(root, ".agents/agentkit-manifest.json");
    const raw = JSON.parse(await fs.readFile(manifestPath, "utf8"));
    raw.agentkit = "999.0.0";
    await fs.writeFile(manifestPath, JSON.stringify(raw, null, 2));
    assert.equal(await quietly(() => sync({ root, quiet: true })), 0);
    assert.equal(await quietly(() => check(root)), 0);
});
test("a sync records the version that did it, and never lowers it", async () => {
    const root = await scratch();
    const manifestPath = path.join(root, ".agents/agentkit-manifest.json");
    assert.ok((await readManifest(path.join(root, ".agents"))).agentkit);
    const raw = JSON.parse(await fs.readFile(manifestPath, "utf8"));
    raw.agentkit = "999.0.0";
    await fs.writeFile(manifestPath, JSON.stringify(raw, null, 2));
    await quietly(() => sync({ root, quiet: true }));
    assert.equal((await readManifest(path.join(root, ".agents"))).agentkit, "999.0.0");
});
