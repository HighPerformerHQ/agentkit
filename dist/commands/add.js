import path from "node:path";
import { listPacks, loadConfig, saveConfig } from "../lib/canonical.js";
import { sync } from "./sync.js";
/** Enable a pack, then re-sync so its content lands immediately. */
export async function add(root, pack) {
    const available = await listPacks();
    if (!available.includes(pack)) {
        console.error(`Unknown pack "${pack}". Available: ${available.join(", ")}`);
        return 1;
    }
    const agentsDir = path.join(root, ".agents");
    const config = await loadConfig(agentsDir);
    if (config.packs.includes(pack)) {
        console.log(`Pack "${pack}" is already enabled.`);
        return 0;
    }
    config.packs.push(pack);
    await saveConfig(agentsDir, config);
    console.log(`Enabled pack "${pack}".\n`);
    return sync({ root });
}
