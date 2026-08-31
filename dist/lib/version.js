import path from "node:path";
import { readTextOrNull } from "./fsx.js";
/** Parsed `major.minor.patch`. Anything after a `-` or `+` is ignored. */
function parts(version) {
    const core = version.trim().split(/[-+]/, 1)[0] ?? "";
    const bits = core.split(".");
    if (bits.length !== 3)
        return null;
    const numbers = bits.map((bit) => (/^\d+$/.test(bit) ? Number(bit) : Number.NaN));
    if (numbers.some(Number.isNaN))
        return null;
    return [numbers[0], numbers[1], numbers[2]];
}
/**
 * Order two versions: -1 if `a` is older, 1 if newer, 0 if equal.
 * Returns null when either side is not a plain `x.y.z`, so callers can treat
 * an unrecognised version as "no opinion" rather than guessing at an order.
 */
export function compareVersions(a, b) {
    const left = parts(a);
    const right = parts(b);
    if (left === null || right === null)
        return null;
    for (let i = 0; i < 3; i++) {
        const l = left[i];
        const r = right[i];
        if (l < r)
            return -1;
        if (l > r)
            return 1;
    }
    return 0;
}
/**
 * Is the running agentkit older than the one that wrote a manifest entry?
 *
 * An entry written before versions were recorded, or carrying a version this
 * build cannot parse, answers false: without an order there is nothing to
 * refuse, and the pre-existing behaviour is the safer default.
 */
export function isOlderThan(running, recorded) {
    if (recorded === undefined)
        return false;
    return compareVersions(running, recorded) === -1;
}
let cached = null;
/**
 * The running agentkit's version, read from the package it was installed as.
 *
 * This is what makes a pack update directional. `packs/` and this number move
 * together - CI in this repo fails a change to one without the other - so an
 * older build can recognise a file written by a newer one and leave it alone.
 */
export async function agentkitVersion(packageRoot) {
    if (cached !== null)
        return cached;
    const raw = await readTextOrNull(path.join(packageRoot, "package.json"));
    const parsed = raw === null ? {} : JSON.parse(raw);
    cached = parsed.version ?? "0.0.0";
    return cached;
}
