#!/usr/bin/env node
import process from "node:process";
import { sync } from "./commands/sync.js";
import { check } from "./commands/check.js";
import { doctor } from "./commands/doctor.js";
import { add } from "./commands/add.js";
import { listPacks } from "./lib/canonical.js";
import { ALL_VENDORS } from "./lib/types.js";
const USAGE = `agentkit - vendor-agnostic agent configuration

Usage
  agentkit sync [--vendors <list>] [--root <dir>]   Write .agents/ and all vendor adapters
  agentkit sync --reseed                            Restore pack files you deleted earlier
  agentkit check [--root <dir>]                     Fail if generated files are stale (CI)
  agentkit doctor [--root <dir>]                    Report installed agent CLIs and wiring
  agentkit add <pack> [--root <dir>]                Enable a pack, then sync

Options
  --vendors   Comma-separated subset of: ${ALL_VENDORS.join(", ")}
  --reseed    Re-add pack files previously deleted on purpose
  --root      Target repository (default: cwd)
  --help      Show this message
`;
function parseArgs(argv) {
    const flags = new Map();
    const positional = [];
    for (let i = 0; i < argv.length; i++) {
        const token = argv[i];
        if (token === undefined)
            continue;
        if (token.startsWith("--")) {
            const [key, inline] = token.slice(2).split("=", 2);
            if (key === undefined)
                continue;
            if (inline !== undefined) {
                flags.set(key, inline);
            }
            else if (key === "help" || key === "reseed") {
                flags.set(key, "true");
            }
            else {
                // Consume the next token as this flag's value.
                flags.set(key, argv[++i] ?? "");
            }
        }
        else {
            positional.push(token);
        }
    }
    return { command: positional[0], positional: positional.slice(1), flags };
}
function parseVendors(raw) {
    if (!raw)
        return undefined;
    const requested = raw.split(",").map((v) => v.trim()).filter(Boolean);
    const invalid = requested.filter((v) => !ALL_VENDORS.includes(v));
    if (invalid.length > 0) {
        throw new Error(`Unknown vendor(s): ${invalid.join(", ")}. Valid: ${ALL_VENDORS.join(", ")}`);
    }
    return requested;
}
async function main() {
    const args = parseArgs(process.argv.slice(2));
    const root = args.flags.get("root") ?? process.cwd();
    if (args.flags.has("help") || args.command === undefined) {
        console.log(USAGE);
        return args.command === undefined ? 1 : 0;
    }
    switch (args.command) {
        case "sync":
            return sync({
                root,
                vendors: parseVendors(args.flags.get("vendors")),
                reseed: args.flags.has("reseed"),
            });
        case "check":
            return check(root);
        case "doctor":
            return doctor(root);
        case "add": {
            const pack = args.positional[0];
            if (pack === undefined) {
                console.error(`Usage: agentkit add <pack>\nAvailable: ${(await listPacks()).join(", ")}`);
                return 1;
            }
            return add(root, pack);
        }
        default:
            console.error(`Unknown command "${args.command}"\n`);
            console.log(USAGE);
            return 1;
    }
}
main()
    .then((code) => process.exit(code))
    .catch((error) => {
    console.error(`agentkit: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
});
