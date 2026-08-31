import assert from "node:assert/strict";
import { test } from "node:test";
import { resolvePackFile } from "./manifest.js";
import type { PackFileState, SeedEntry } from "./types.js";

const PACK = "sha256-pack";
const OLD = "sha256-old";
const MINE = "sha256-mine";

// The running agentkit in these cases, unless a test says otherwise.
const HERE = "1.0.0";
const NEWER = "1.1.0";

function state(over: Partial<PackFileState>): PackFileState {
  return {
    path: "skills/review-changes/SKILL.md",
    pack: "core",
    packHash: PACK,
    localHash: null,
    entry: undefined,
    version: HERE,
    ...over,
  };
}

const tracked = (hash: string, agentkit = HERE): SeedEntry => ({
  pack: "core",
  hash,
  agentkit,
});
const tombstone = (): SeedEntry => ({ pack: "core", hash: OLD, removed: true });

// One case per row of the resolution table in the plan.

test("untracked and absent -> seed", () => {
  assert.equal(resolvePackFile(state({})), "seed");
});

test("untracked but byte-identical to the pack -> adopt", () => {
  assert.equal(resolvePackFile(state({ localHash: PACK })), "adopt");
});

test("untracked and already edited -> unmanaged, never auto-updated", () => {
  assert.equal(resolvePackFile(state({ localHash: MINE })), "unmanaged");
});

test("tracked but deleted locally -> tombstone", () => {
  assert.equal(
    resolvePackFile(state({ localHash: null, entry: tracked(PACK) })),
    "tombstone",
  );
});

test("already tombstoned and still gone -> removed", () => {
  assert.equal(
    resolvePackFile(state({ localHash: null, entry: tombstone() })),
    "removed",
  );
});

test("tracked, unmodified, pack unchanged -> current", () => {
  assert.equal(
    resolvePackFile(state({ localHash: PACK, entry: tracked(PACK) })),
    "current",
  );
});

test("tracked, unmodified, pack moved -> update", () => {
  assert.equal(
    resolvePackFile(state({ localHash: OLD, entry: tracked(OLD) })),
    "update",
  );
});

test("locally edited, pack unchanged -> modified, left alone", () => {
  assert.equal(
    resolvePackFile(state({ localHash: MINE, entry: tracked(PACK) })),
    "modified",
  );
});

test("locally edited AND pack moved -> conflict", () => {
  assert.equal(
    resolvePackFile(state({ localHash: MINE, entry: tracked(OLD) })),
    "conflict",
  );
});

test("pack stopped shipping it but the file is still here -> orphaned", () => {
  assert.equal(
    resolvePackFile(state({ packHash: null, localHash: PACK, entry: tracked(PACK) })),
    "orphaned",
  );
});

test("gone from both sides -> drop the entry", () => {
  assert.equal(
    resolvePackFile(state({ packHash: null, localHash: null, entry: tracked(PACK) })),
    "drop",
  );
});

// --reseed, and the hand-restore edge case.

test("--reseed undoes a tombstone", () => {
  assert.equal(
    resolvePackFile(state({ localHash: null, entry: tombstone() }), true),
    "seed",
  );
});

test("--reseed cannot resurrect a file no pack ships any more", () => {
  assert.equal(
    resolvePackFile(state({ packHash: null, localHash: null, entry: tombstone() }), true),
    "drop",
  );
});

test("tombstoned file restored by hand is adopted, not re-tombstoned", () => {
  assert.equal(
    resolvePackFile(state({ localHash: PACK, entry: tombstone() })),
    "adopt",
  );
});

test("tombstoned file restored by hand with edits stays the user's", () => {
  assert.equal(
    resolvePackFile(state({ localHash: MINE, entry: tombstone() })),
    "unmanaged",
  );
});

// The invariant the whole design rests on.

test("only seed and update ever write, and never over unseen bytes", () => {
  const localHashes = [null, PACK, OLD, MINE];
  const entries = [
    undefined,
    tracked(PACK),
    tracked(OLD),
    tracked(OLD, NEWER),
    { pack: "core", hash: OLD },
    tombstone(),
  ];

  for (const localHash of localHashes) {
    for (const entry of entries) {
      const action = resolvePackFile(state({ localHash, entry }));
      if (action !== "update") continue;
      // An update may only fire when the file on disk is byte-for-byte what
      // agentkit last wrote there.
      assert.equal(localHash, entry?.hash, `update over unseen bytes: ${localHash}`);
    }
  }
});

test("a tombstone for a file no pack ships is cleaned up, not kept forever", () => {
  assert.equal(
    resolvePackFile(state({ packHash: null, localHash: null, entry: tombstone() })),
    "drop",
  );
});

// Version ordering. Without it, "the pack differs from the baseline" cannot
// tell a pack that moved forward from an agentkit that is behind, and the two
// builds overwrite each other's work indefinitely.

test("an older agentkit will not write over a file a newer one wrote", () => {
  assert.equal(
    resolvePackFile(state({ localHash: OLD, entry: tracked(OLD, NEWER) })),
    "stale",
  );
});

test("staleness outranks a conflict - an older build judges neither side", () => {
  assert.equal(
    resolvePackFile(state({ localHash: MINE, entry: tracked(OLD, NEWER) })),
    "stale",
  );
});

test("a newer agentkit still applies its own pack updates", () => {
  assert.equal(
    resolvePackFile(state({ localHash: OLD, entry: tracked(OLD, "0.9.0") })),
    "update",
  );
});

test("the same version writes, so an unreleased local build still works", () => {
  assert.equal(
    resolvePackFile(state({ localHash: OLD, entry: tracked(OLD, HERE) })),
    "update",
  );
});

test("an entry from before versions were recorded is not treated as newer", () => {
  assert.equal(
    resolvePackFile(state({ localHash: OLD, entry: { pack: "core", hash: OLD } })),
    "update",
  );
});

test("an older agentkit still reports a file the pack matches as current", () => {
  assert.equal(
    resolvePackFile(state({ localHash: PACK, entry: tracked(PACK, NEWER) })),
    "current",
  );
});
