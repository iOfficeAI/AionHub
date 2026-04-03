import { $ } from "bun";

if (process.platform === "win32") {
    throw new Error("Goose does not support Windows. Please visit https://github.com/block/goose for manual installation.");
}

await $`curl -fsSL https://github.com/block/goose/releases/download/stable/download_cli.sh | CONFIGURE=false bash`;
