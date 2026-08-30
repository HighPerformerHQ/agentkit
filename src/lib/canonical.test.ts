import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { loadCanonical, packageRoot } from "./canonical.js";
import { sha256 } from "./fsx.js";
import { readManifest } from "./manifest.js";

/** A pack file that every scenario below leans on. */
const TRACKED = "skills/review-changes/SKILL.md";

async function scratch(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "agentkit-test-"));
  await fs.mkdir(path.join(root, ".agents"), { recursive: true });
  await fs.writeFile(
    path.join(root, ".agents", "agentkit.config.json"),
    JSON.stringify({ packs: ["core"], vendors: ["claude"] }, null, 2),
  );
  return root;
}

const agentsPath = (root: string, rel: string) => path.join(root, ".agents", rel);
const packPath = (rel: string) => path.join(packageRoot(), "packs", "core", rel);

async function actionFor(root: string, rel: string, reseed = false) {
  const canonical = await loadCanonical(root, { reseed });
  return canonical.packPlan.find((entry) => entry.path === rel)?.action;
}

test("a fresh repo is seeded from the pack and recorded", async () => {
  const root = await scratch();
  assert.equal(await actionFor(root, TRACKED), "seed");

  const [seeded, source] = await Promise.all([
    fs.readFile(agentsPath(root, TRACKED)),
    fs.readFile(packPath(TRACKED)),
  ]);
  assert.ok(seeded.equals(source), "seeded file should match the pack byte for byte");

  const manifest = await readManifest(path.join(root, ".agents"));
  assert.equal(manifest.seeded[TRACKED]?.hash, sha256(source));
});

test("syncing again changes nothing", async () => {
  const root = await scratch();
  await loadCanonical(root);
  assert.equal(await actionFor(root, TRACKED), "current");
});

test("an untracked but identical file is adopted without rewriting it", async () => {
  const root = await scratch();
  const source = await fs.readFile(packPath(TRACKED));
  await fs.mkdir(path.dirname(agentsPath(root, TRACKED)), { recursive: true });
  await fs.writeFile(agentsPath(root, TRACKED), source);

  assert.equal(await actionFor(root, TRACKED), "adopt");
  const manifest = await readManifest(path.join(root, ".agents"));
  assert.equal(manifest.seeded[TRACKED]?.hash, sha256(source));
});

test("a pack change reaches a file the user never touched", async () => {
  const root = await scratch();
  await loadCanonical(root);

  // Stand in for "the pack moved on": rewind both the manifest baseline and the
  // local file to an older state, leaving the file unmodified relative to it.
  const stale = "# an older version of this rule\n";
  await fs.writeFile(agentsPath(root, TRACKED), stale);
  const manifest = await readManifest(path.join(root, ".agents"));
  manifest.seeded[TRACKED] = { pack: "core", hash: sha256(stale) };
  await fs.writeFile(
    agentsPath(root, "agentkit-manifest.json"),
    JSON.stringify(manifest, null, 2),
  );

  assert.equal(await actionFor(root, TRACKED), "update");
  const [now, source] = await Promise.all([
    fs.readFile(agentsPath(root, TRACKED)),
    fs.readFile(packPath(TRACKED)),
  ]);
  assert.ok(now.equals(source), "an unmodified file should be brought up to date");
});

test("a pack change never overwrites a file the user edited", async () => {
  const root = await scratch();
  await loadCanonical(root);

  const mine = "# my own version of this rule\n";
  await fs.writeFile(agentsPath(root, TRACKED), mine);
  const manifest = await readManifest(path.join(root, ".agents"));
  manifest.seeded[TRACKED] = { pack: "core", hash: sha256("something else\n") };
  await fs.writeFile(
    agentsPath(root, "agentkit-manifest.json"),
    JSON.stringify(manifest, null, 2),
  );

  assert.equal(await actionFor(root, TRACKED), "conflict");
  assert.equal(await fs.readFile(agentsPath(root, TRACKED), "utf8"), mine);
});

test("deleting a pack file sticks, and --reseed brings it back", async () => {
  const root = await scratch();
  await loadCanonical(root);
  await fs.rm(agentsPath(root, TRACKED));

  assert.equal(await actionFor(root, TRACKED), "tombstone");
  const manifest = await readManifest(path.join(root, ".agents"));
  assert.equal(manifest.seeded[TRACKED]?.removed, true);

  // The point of the tombstone: a later sync must not quietly undo the deletion.
  assert.equal(await actionFor(root, TRACKED), "removed");
  assert.equal(await fs.stat(agentsPath(root, TRACKED)).catch(() => null), null);

  assert.equal(await actionFor(root, TRACKED, true), "seed");
  assert.ok(await fs.stat(agentsPath(root, TRACKED)));
});

test("a read-only load writes nothing at all", async () => {
  const root = await scratch();
  const before = await fs.readdir(path.join(root, ".agents"));

  const canonical = await loadCanonical(root, { write: false });
  assert.equal(
    canonical.packPlan.find((entry) => entry.path === TRACKED)?.action,
    "seed",
    "it should still report the pending work",
  );

  assert.deepEqual(await fs.readdir(path.join(root, ".agents")), before);
});
