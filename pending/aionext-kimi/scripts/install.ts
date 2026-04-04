import { $ } from "bun";

if (process.platform === "win32") {
    throw new Error("Kimi Code CLI does not support Windows yet. Please visit https://www.kimi.com/code for updates.");
}

await $`curl -L code.kimi.com/install.sh | bash`;
