import { $ } from "bun";

if (process.platform === "win32") {
    throw new Error("Kiro CLI does not support Windows yet. Please visit https://kiro.dev for updates.");
}

await $`curl -fsSL https://cli.kiro.dev/install | bash`;
