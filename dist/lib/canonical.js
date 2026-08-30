import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_CONFIG, ALL_VENDORS, } from "./types.js";
import { glob, hashFile, isDir, parseFrontmatter, readText, readTextOrNull, writeText, } from "./fsx.js";
import { listPackFiles, readManifest, resolvePackFile, writeManifest } from "./manifest.js";
/** Root of the installed agentkit package (where `packs/` lives). */
export function packageRoot() {
    return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
}
const DEFAULT_MCP = {
    servers: {
        context7: {
            command: "npx",
            args: ["-y", "@upstash/context7-mcp@latest"],
        },
        playwright: {
            command: "npx",
            args: ["-y", "@playwright/mcp@latest"],
        },
    },
};
/**
 * Reconcile the enabled packs against `.agents/`, then read the whole canonical
 * tree back.
 *
 * With `write: false` nothing is touched, which is what lets `check` run in CI
 * without mutating the working tree it is about to diff.
 */
export async function loadCanonical(root, options = {}) {
    const write = options.write !== false;
    const agentsDir = path.join(root, ".agents");
    const config = await loadConfig(agentsDir, write);
    const packPlan = await reconcilePacks(agentsDir, config, options);
    const mcpPath = path.join(agentsDir, "mcp.json");
    const rawMcp = await readTextOrNull(mcpPath);
    let mcp;
    if (rawMcp === null) {
        mcp = structuredClone(DEFAULT_MCP);
        if (write) {
            await writeText(mcpPath, `${JSON.stringify(DEFAULT_MCP, null, 2)}\n`);
        }
    }
    else {
        mcp = JSON.parse(rawMcp);
    }
    return {
        root,
        agentsDir,
        config,
        packPlan,
        skills: await readSkills(agentsDir),
        commands: await readCommands(agentsDir),
        mcp,
    };
}
/**
 * Decide, and when writing apply, what happens to every pack-shipped file.
 * The policy itself lives in `resolvePackFile`; this only supplies the facts
 * (what the pack ships, what is on disk, what agentkit last wrote) and carries
 * out the verdict.
 */
async function reconcilePacks(agentsDir, config, options) {
    const write = options.write !== false;
    const manifest = await readManifest(agentsDir);
    // Later packs win a path collision, matching the order they are enabled in.
    const shipped = new Map();
    for (const pack of config.packs) {
        const packDir = path.join(packageRoot(), "packs", pack);
        if (!(await isDir(packDir))) {
            throw new Error(`Unknown pack "${pack}". Available: ${(await listPacks()).join(", ")}`);
        }
        for (const relative of await listPackFiles(packDir)) {
            shipped.set(relative, { pack, source: path.join(packDir, relative) });
        }
    }
    // Manifest paths are included so files a pack has dropped are still noticed.
    const paths = [
        ...new Set([...shipped.keys(), ...Object.keys(manifest.seeded)]),
    ].sort();
    const plan = [];
    for (const relative of paths) {
        const ship = shipped.get(relative);
        const entry = manifest.seeded[relative];
        const local = path.join(agentsDir, relative);
        const packHash = ship === undefined ? null : await hashFile(ship.source);
        const localHash = await hashFile(local);
        const pack = ship?.pack ?? entry?.pack ?? "unknown";
        const action = resolvePackFile({ path: relative, pack, packHash, localHash, entry }, options.reseed === true);
        plan.push({ path: relative, pack, action });
        if (!write)
            continue;
        if ((action === "seed" || action === "update") && ship && packHash) {
            await fs.mkdir(path.dirname(local), { recursive: true });
            await fs.copyFile(ship.source, local);
            manifest.seeded[relative] = { pack, hash: packHash };
        }
        else if (action === "adopt" && packHash) {
            manifest.seeded[relative] = { pack, hash: packHash };
        }
        else if (action === "tombstone" && entry) {
            manifest.seeded[relative] = { ...entry, removed: true };
        }
        else if (action === "drop") {
            delete manifest.seeded[relative];
        }
        // unmanaged / current / modified / conflict / orphaned / removed all leave
        // both the file and its manifest entry exactly as they are.
    }
    if (write)
        await writeManifest(agentsDir, manifest);
    return plan;
}
export async function listPacks() {
    const dir = path.join(packageRoot(), "packs");
    if (!(await isDir(dir)))
        return [];
    const entries = await fs.readdir(dir, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory()).map((e) => e.name).sort();
}
export async function loadConfig(agentsDir, write = true) {
    const configPath = path.join(agentsDir, "agentkit.config.json");
    const raw = await readTextOrNull(configPath);
    if (raw === null) {
        if (write) {
            await writeText(configPath, `${JSON.stringify(DEFAULT_CONFIG, null, 2)}\n`);
        }
        return structuredClone(DEFAULT_CONFIG);
    }
    const parsed = JSON.parse(raw);
    const vendors = (parsed.vendors ?? DEFAULT_CONFIG.vendors).filter((v) => ALL_VENDORS.includes(v));
    return {
        ...DEFAULT_CONFIG,
        ...parsed,
        packs: parsed.packs ?? DEFAULT_CONFIG.packs,
        vendors: vendors.length > 0 ? vendors : DEFAULT_CONFIG.vendors,
    };
}
export async function saveConfig(agentsDir, config) {
    await writeText(path.join(agentsDir, "agentkit.config.json"), `${JSON.stringify(config, null, 2)}\n`);
}
async function readSkills(agentsDir) {
    const dir = path.join(agentsDir, "skills");
    if (!(await isDir(dir)))
        return [];
    const skills = [];
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
        if (!entry.isDirectory())
            continue;
        const skillMd = path.join(dir, entry.name, "SKILL.md");
        const raw = await readTextOrNull(skillMd);
        if (raw === null)
            continue;
        const { frontmatter } = parseFrontmatter(raw);
        skills.push({
            name: frontmatter.name ?? entry.name,
            dir: path.join(dir, entry.name),
            description: frontmatter.description ?? "",
        });
    }
    return skills.sort((a, b) => a.name.localeCompare(b.name));
}
async function readCommands(agentsDir) {
    const files = await glob("*.md", path.join(agentsDir, "commands"));
    const commands = [];
    for (const file of files) {
        const { frontmatter, body } = parseFrontmatter(await readText(file));
        commands.push({
            name: path.basename(file, ".md"),
            path: file,
            description: frontmatter.description ?? "",
            body: body.trim(),
            frontmatter,
        });
    }
    return commands;
}
