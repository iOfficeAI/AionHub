import { $ } from "bun";

if (process.platform === "win32") {
    await $`powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"`;
    await $`uv tool install mistral-vibe`;
} else {
    await $`curl -LsSf https://mistral.ai/vibe/install.sh | bash`;
}
