# 跨平台 onInstall 方案

## 问题

当前 `onInstall.shell` 只有一组 `{ cliCommand, args }`，存在三个限制：

1. **无法区分平台**：macOS/Linux/Windows 的安装命令可能完全不同
2. **curl 管道命令需要手动套 shell**：extension 作者需要写 `{ cliCommand: "/bin/bash", args: ["-c", "curl ... | bash"] }`，不直观
3. **无法执行多步安装**：Claude Code 和 Codex 需要先装 CLI 再装 ACP 适配器，当前只支持单条命令

## 方案一：按 `process.platform` 分平台配置

Key 对齐 Node.js 的 `process.platform` 值：`darwin`、`linux`、`win32`。

```json
{
  "onInstall": {
    "darwin": {
      "shell": { "cliCommand": "curl", "args": ["-fsSL", "https://app.factory.ai/cli", "|", "sh"] }
    },
    "linux": {
      "shell": { "cliCommand": "curl", "args": ["-fsSL", "https://app.factory.ai/cli", "|", "sh"] }
    },
    "win32": {
      "shell": { "cliCommand": "irm", "args": ["https://app.factory.ai/cli/windows", "|", "iex"] }
    }
  }
}
```

如果某平台值为 `null` 或缺省，UI 提示"此 extension 不支持该平台"。

### 选择理由

- 对齐 `process.platform`（`darwin` / `linux` / `win32`），runtime 直接用 `process.platform` 做 key 查找，零转换逻辑
- 虽然大多数工具 macOS 和 Linux 命令一样，但确实存在差异场景（如 brew 仅 macOS/Linux、apt 仅 Linux）
- 比 `posix` / `win` 方案粒度更细，不需要额外的 fallback 优先级逻辑，更简单直接

## 方案二：lifecycle runner 自动检测 curl/irm 并套壳

`onInstall.shell` 结构保持不变（`{ cliCommand, args }`），extension 作者直接写 curl 命令，lifecycle runner 根据 `cliCommand` 自动决定是否需要包一层 shell：

```json
{
  "onInstall": {
    "shell": {
      "cliCommand": "curl",
      "args": ["-fsSL", "https://cli.kiro.dev/install", "|", "bash"]
    },
    "timeout": 120000
  }
}
```

### lifecycle runner 改动

```typescript
function executeLifecycleHook(cliCommand: string, args: string[]) {
  const needsShellWrap = ['curl', 'wget', 'irm'].includes(cliCommand);

  if (needsShellWrap) {
    const fullCommand = [cliCommand, ...args].join(' ');
    if (process.platform === 'win32') {
      return spawn('powershell', ['-Command', fullCommand], { ... });
    } else {
      return spawn('/bin/bash', ['-c', fullCommand], { ... });
    }
  }

  // 普通命令，直接 spawn
  return spawn(cliCommand, args, { ... });
}
```

### extension 作者体验

| 场景      | extension 作者写                                                                  | runner 实际执行 (macOS/Linux)                                             | runner 实际执行 (Windows)                                                 |
| --------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| bun 安装  | `{ cliCommand: "bun", args: ["add", "-g", "xxx"] }`                               | `spawn("bun", ["add", "-g", "xxx"])`                                      | `spawn("bun", ["add", "-g", "xxx"])`                                      |
| curl 安装 | `{ cliCommand: "curl", args: ["-fsSL", "https://xxx/install.sh", "\|", "bash"] }` | `spawn("/bin/bash", ["-c", "curl -fsSL https://xxx/install.sh \| bash"])` | 不支持（需配合方案一提供 win32 替代）                                     |
| irm 安装  | `{ cliCommand: "irm", args: ["https://xxx/install.ps1", "\|", "iex"] }`           | 不支持                                                                    | `spawn("powershell", ["-Command", "irm https://xxx/install.ps1 \| iex"])` |

## 方案三：用 `bun run` TypeScript 脚本处理复杂安装

AionUi 自带 bundled bun，且 `shell` 白名单允许 `bun`/`bunx`。因此可以直接用 `bun run scripts/install.ts` 执行 TypeScript 安装脚本，不需要走 `script` 字段（`script` 只支持 CJS `.js`，通过 `require()` 加载）。

### extension 目录结构

```
extensions/aionext-claude/
├── aion-extension.json
└── scripts/
    └── install.ts
```

### aion-extension.json

```json
{
  "lifecycle": {
    "onInstall": {
      "shell": {
        "cliCommand": "bun",
        "args": ["run", "scripts/install.ts"]
      },
      "timeout": 120000
    }
  }
}
```

### scripts/install.ts（多步 bun 安装示例）

```typescript
import { $ } from "bun";

await $`bun add -g @anthropic-ai/claude-code`;
await $`bun add -g @agentclientprotocol/claude-agent-acp`;
```

### scripts/install.ts（curl 安装 + 平台判断示例）

```typescript
import { $ } from "bun";

if (process.platform === "win32") {
    throw new Error("This tool does not support Windows.");
}

await $`curl -fsSL https://cli.kiro.dev/install | bash`;
```

### 优点

- **统一走 `shell` 通道**：所有 extension 都用 `shell` 字段，不再混用 `script` 和 `shell` 两种方式
- **不受白名单限制**：`cliCommand` 是 `bun`（在白名单中），脚本内通过 `Bun.$` 可以执行任意命令
- **TypeScript 原生支持**：bun 直接跑 `.ts`，无需编译，`Bun.$` 模板字符串比 `execSync` 更简洁
- **跨平台**：脚本内可根据 `process.platform` 分支处理
- **类型检查**：项目根目录添加 `tsconfig.json`（`"types": ["bun-types"]"`）+ `bun-types` dev dependency 即可获得完整类型提示
- **可审计**：脚本文件在 extension 目录里，用户和 reviewer 都能直接查看内容

---

## 安装方式与 onInstall 配置总表

排除 Cursor Agent（无独立 CLI）和 Nano Bot（无 ACP 确认）。全部走 `shell` 通道：简单场景直接 `bun add -g`，复杂场景（多步 / curl）用 `bun run scripts/install.ts`。

### bun add -g 直接安装（9 个）

| 工具               | 安装方式             | onInstall 写法                                                                           | ACP 启动命令                     |
| ------------------ | -------------------- | ---------------------------------------------------------------------------------------- | -------------------------------- |
| **Gemini CLI**     | `bun add -g`         | `{ shell: { cliCommand: "bun", args: ["add", "-g", "@google/gemini-cli"] } }`            | `gemini --acp`                   |
| **Augment Code**   | `bun add -g`         | `{ shell: { cliCommand: "bun", args: ["add", "-g", "@augmentcode/auggie"] } }`           | `auggie --acp`                   |
| **CodeBuddy**      | `bun add -g`         | `{ shell: { cliCommand: "bun", args: ["add", "-g", "@tencent-ai/codebuddy-code"] } }`    | `codebuddy --acp`                |
| **Qwen Code**      | `bun add -g`         | `{ shell: { cliCommand: "bun", args: ["add", "-g", "@qwen-code/qwen-code"] } }`          | `qwen --acp`                     |
| **OpenClaw**       | `bun add -g`         | `{ shell: { cliCommand: "bun", args: ["add", "-g", "openclaw"] } }`                      | `openclaw acp`                   |
| **GitHub Copilot** | `bun add -g`         | `{ shell: { cliCommand: "bun", args: ["add", "-g", "@github/copilot"] } }`               | `copilot --acp --stdio`          |
| **OpenCode**       | `bun add -g --trust` | `{ shell: { cliCommand: "bun", args: ["add", "-g", "--trust", "opencode-ai"] } }`        | `opencode acp`                   |
| **Droid**          | `bun add -g --trust` | `{ shell: { cliCommand: "bun", args: ["add", "-g", "--trust", "droid"] } }`              | `droid exec --output-format acp` |
| **Qoder CLI**      | `bun add -g --trust` | `{ shell: { cliCommand: "bun", args: ["add", "-g", "--trust", "@qoder-ai/qodercli"] } }` | `qodercli --acp`                 |

### bun run scripts/install.ts（6 个）

| 工具             | 安装方式 | onInstall 写法                                                              | 脚本核心内容                                                                                                         | ACP 启动命令       |
| ---------------- | -------- | --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------ |
| **Claude Code**  | bun 两步 | `{ shell: { cliCommand: "bun", args: ["run", "scripts/install.ts"] } }` | `await $\`bun add -g @anthropic-ai/claude-code\`` + `await $\`bun add -g @agentclientprotocol/claude-agent-acp\``    | `claude-agent-acp` |
| **Codex**        | bun 两步 | `{ shell: { cliCommand: "bun", args: ["run", "scripts/install.ts"] } }` | `await $\`bun add -g @openai/codex\`` + `await $\`bun add -g @zed-industries/codex-acp\``                            | `codex-acp`        |
| **Goose**        | curl     | `{ shell: { cliCommand: "bun", args: ["run", "scripts/install.ts"] } }` | 平台判断 + `await $\`curl -fsSL .../download_cli.sh \| CONFIGURE=false bash\``                                       | `goose acp`        |
| **Kimi Code**    | curl     | `{ shell: { cliCommand: "bun", args: ["run", "scripts/install.ts"] } }` | 平台判断 + `await $\`curl -L code.kimi.com/install.sh \| bash\``                                                     | `kimi acp`         |
| **Mistral Vibe** | curl     | `{ shell: { cliCommand: "bun", args: ["run", "scripts/install.ts"] } }` | 平台判断：win32 用 `irm \| iex` + `uv tool install`，其他用 `curl \| bash`                                            | `vibe-acp`         |
| **Kiro CLI**     | curl     | `{ shell: { cliCommand: "bun", args: ["run", "scripts/install.ts"] } }` | 平台判断 + `await $\`curl -fsSL https://cli.kiro.dev/install \| bash\``                                              | `kiro-cli acp`     |
