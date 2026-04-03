# Extension 安装方式与 ACP 支持调研报告

## 一、lifecycle 代码分析：curl 是否可行

**关键代码**：`lifecycleRunner.ts:40-44`

```typescript
const child = spawn(cliCommand, args, {
  cwd: msg.context.extensionDir,
  env: process.env,
  stdio: 'inherit',
  shell: process.platform === 'win32',  // macOS/Linux 下 shell=false
});
```

macOS/Linux 下 `shell: false`，意味着 `|`（管道）不会被当作 shell 操作符，而是作为字面参数传给 cliCommand。因此 `curl ... | bash` **直接写不行**。

**但有 workaround**：把 `cliCommand` 设为 `/bin/bash`，把整条管道命令放进 `args: ["-c", "curl -fsSL https://xxx/install.sh | bash"]`。这在当前代码下**可行**，无需改 lifecycle 代码。

另外，AionUi **内置了 bundled bun**（`resources/bundled-bun/<platform>-<arch>/`），通过 `getEnhancedEnv()` 注入到 PATH 最前面。所以即使用户没装 bun，`bun add -g` 和 `bunx` 也能工作。

---

## 二、全量工具调研汇总表

### 表1：安装与 npm 兼容性

| #   | 工具                | 官方安装方式                                                              | npm 包名                     | npm 存在?   | 有 `bin`?   | bin 名      | 是正确的工具? | `bun add -g` 可用? | 需 `--trust`? | 问题                                                                                                                                                   |
| --- | ------------------- | ------------------------------------------------------------------------- | ---------------------------- | ----------- | ----------- | ----------- | ------------- | ------------------ | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | **Claude Code**     | `curl -fsSL https://claude.ai/install.sh \| bash` / brew                  | `@anthropic-ai/claude-code`  | v2.1.91     | `claude`    | `claude`    | 是            | 可用               | 否            | npm 方式已被**官方标记 deprecated**，推荐 curl/brew                                                                                                    |
| 2   | **Gemini CLI**      | `npm i -g @google/gemini-cli`                                             | `@google/gemini-cli`         | v0.36.0     | `gemini`    | `gemini`    | 是            | 可用               | 否            | optional native deps(`node-pty`, `keytar`)在 bun 下可能编译失败，不阻断                                                                                |
| 3   | **Augment Code**    | `npm i -g @augmentcode/auggie`                                            | `@augmentcode/auggie`        | v0.22.0     | `auggie`    | `auggie`    | 是            | 可用               | 否            | 无                                                                                                                                                     |
| 4   | **CodeBuddy**       | `npm i -g @tencent-ai/codebuddy-code`                                     | `@tencent-ai/codebuddy-code` | v2.73.0     | `codebuddy` | `codebuddy` | 是            | 可用               | 否            | optional native deps                                                                                                                                   |
| 5   | **Qwen Code**       | `npm i -g @qwen-code/qwen-code`                                           | `@qwen-code/qwen-code`       | v0.14.0     | `qwen`      | `qwen`      | 是            | 可用               | 否            | optional native deps                                                                                                                                   |
| 7   | **OpenClaw**        | `npm i -g openclaw`                                                       | `openclaw`                   | v2026.4.2   | `openclaw`  | `openclaw`  | 是            | 可用               | 否            | `engines: node>=22.14.0` 运行时兼容性风险                                                                                                              |
| 8   | **GitHub Copilot**  | `curl -fsSL https://gh.io/copilot-install \| bash` / brew / npm           | `@github/copilot`            | **v1.0.17** | `copilot`   | `copilot`   | 是            | 可用               | 否            | 旧 manifest 引用的 `@githubnext/github-copilot-cli` 已**废弃**。正确包是 `@github/copilot`，无 postinstall，使用 platform optional deps 分发原生二进制 |
| 11  | **Codex (OpenAI)**  | `npm i -g @openai/codex` / `brew install --cask codex`                    | `@openai/codex`              | v0.118.0    | `codex`     | `codex`     | 是            | 可用               | 否            | platform optional deps 分发原生 Rust 二进制，无 postinstall                                                                                            |
| 6   | **OpenCode**        | `npm i -g opencode-ai`                                                    | `opencode-ai`                | v1.3.13     | `opencode`  | `opencode`  | 是            | **部分**           | **是**        | `postinstall` 下载 Go 二进制。bun 默认**不执行** lifecycle scripts，需 `--trust`                                                                       |
| 12  | **Droid (Factory)** | `npm -g install droid` / `curl -fsSL https://app.factory.ai/cli \| sh`    | `droid`                      | v0.93.0     | `droid`     | `droid`     | 是            | **部分**           | **是**        | `postinstall: "node install.js"` 下载原生二进制，需 `--trust`                                                                                          |
| 14  | **Qoder CLI**       | `npm i -g @qoder-ai/qodercli` / curl / brew                               | `@qoder-ai/qodercli`         | v0.1.38     | `qodercli`  | `qodercli`  | 是            | **部分**           | **是**        | `postinstall: "node scripts/install.js"` 下载原生二进制，需 `--trust`                                                                                  |
| 9   | **Goose**           | `curl -fsSL .../download_cli.sh \| bash` / `brew install block-goose-cli` | `goose-cli`                  | v3.25.0-a   | `goose`     | `goose`     | **否**        | **错误的包**       | —             | npm `goose-cli` 是**数据库迁移工具**。真正的 Goose(Block) 是 Rust 二进制，不在 npm 上                                                                  |
| 10  | **Nano Bot**        | `brew install nanobot-ai/tap/nanobot`                                     | `nanobot`                    | v0.0.1      | **无**      | —           | **否**        | **不可用**         | —             | npm `nanobot` 是 12 年前的测试数据库，**无 bin**。真正的 Nanobot AI 是 Go 二进制                                                                       |
| 13  | **Kimi Code**       | `curl -L code.kimi.com/install.sh \| bash`                                | **不存在**                   | —           | —           | —           | —             | **不可用**         | —             | npm 上无 Kimi CLI 包。仅支持 curl 安装                                                                                                                 |
| 15  | **Mistral Vibe**    | `curl -LsSf https://mistral.ai/vibe/install.sh \| bash`                   | **不存在**                   | —           | —           | —           | —             | **不可用**         | —             | npm 上无 Mistral Vibe 包。仅支持 curl 安装                                                                                                             |
| 16  | **Kiro CLI (AWS)**  | `curl -fsSL https://cli.kiro.dev/install \| bash`                         | **不存在**                   | —           | —           | —           | —             | **不可用**         | —             | npm `kiro-cli` v0.0.1 是占位包。真正安装只能通过 curl                                                                                                  |
| 17  | **Cursor Agent**    | Cursor IDE 内置 / 独立 CLI(ACP)                                           | **不存在**                   | —           | —           | —           | —             | **不可用**         | —             | npm 无独立 CLI 包。Cursor Agent CLI 通过 Cursor IDE 安装后导出到 PATH(`cursor-agent` 命令)                                                             |

### 表2：ACP 支持情况

来源：[agentclientprotocol.com/get-started/agents](https://agentclientprotocol.com/get-started/agents.md) + 各工具官方文档

| #   | 工具                | 支持 ACP?              | ACP 启动命令                                        | ACP 模式  | 备注                                                                                                                                                                                                                                                                                                                                                                                                                           |
| --- | ------------------- | ---------------------- | --------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | **Claude Code**     | 是(需适配器)           | `claude-agent-acp`                                  | stdio     | 需安装 ACP 适配器 [`@agentclientprotocol/claude-agent-acp`](https://github.com/agentclientprotocol/claude-agent-acp) v0.24.2（旧包名 `@zed-industries/claude-agent-acp` 已 deprecated）。适配器依赖 `@anthropic-ai/claude-agent-sdk`，内部启动 Claude Code CLI 进程并翻译为 ACP。**前提：Claude Code CLI (`claude`) 必须已安装在 PATH 中**。安装：`bun add -g @agentclientprotocol/claude-agent-acp`，无 postinstall，纯 JS 包 |
| 2   | **Gemini CLI**      | **原生支持**           | `gemini --acp`                                      | stdio     | 原生 `--acp` flag                                                                                                                                                                                                                                                                                                                                                                                                              |
| 3   | **Augment Code**    | **原生支持**           | `auggie --acp`                                      | stdio     | 原生 `--acp` flag                                                                                                                                                                                                                                                                                                                                                                                                              |
| 4   | **CodeBuddy**       | **原生支持**           | `codebuddy --acp`                                   | stdio     | 原生 `--acp` flag                                                                                                                                                                                                                                                                                                                                                                                                              |
| 5   | **Qwen Code**       | **原生支持**           | `qwen --acp`                                        | stdio     | 原生 `--acp` flag                                                                                                                                                                                                                                                                                                                                                                                                              |
| 6   | **OpenCode**        | **原生支持**           | `opencode acp`                                      | stdio     | 子命令 `acp`（非 flag）                                                                                                                                                                                                                                                                                                                                                                                                        |
| 7   | **OpenClaw**        | **原生支持**           | `openclaw acp`                                      | stdio     | [官方文档](https://docs.openclaw.ai/cli/acp)：`openclaw acp`。注意：AionHub 现有 manifest 中 acpArgs 为 `["gateway"]` 需更正为 `["acp"]`                                                                                                                                                                                                                                                                                       |
| 8   | **GitHub Copilot**  | **原生支持** (preview) | `copilot --acp --stdio`                             | stdio/TCP | [官方文档](https://docs.github.com/en/copilot/reference/copilot-cli-reference/acp-server)明确标注"ACP support in GitHub Copilot CLI is in **public preview** and subject to change"；同时支持 `--port` TCP 模式                                                                                                                                                                                                                |
| 9   | **Goose**           | **原生支持**           | `goose acp`                                         | stdio     | 子命令 `acp`（非 flag）                                                                                                                                                                                                                                                                                                                                                                                                        |
| 10  | **Codex (OpenAI)**  | 是(需适配器)           | `codex-acp`                                         | stdio     | 需安装 ACP 适配器 [`@zed-industries/codex-acp`](https://github.com/zed-industries/codex-acp) v0.11.1。适配器是 **Rust** 写的原生二进制，通过 platform optional deps 分发（无 postinstall）。**前提：Codex CLI (`codex`) 必须已安装**。安装：`bun add -g @zed-industries/codex-acp`。认证方式：ChatGPT 订阅登录、`CODEX_API_KEY`、`OPENAI_API_KEY`                                                                              |
| 11  | **Droid (Factory)** | **原生支持**           | `droid exec --output-format acp`                    | stdio     | [Factory Zed 文档](https://docs.factory.ai/integrations/zed)：`args: ["exec", "--output-format", "acp"]`                                                                                                                                                                                                                                                                                                                       |
| 12  | **Kimi Code**       | **原生支持**           | `kimi acp`                                          | stdio     | [GitHub README](https://github.com/MoonshotAI/kimi-cli)："configure your ACP client to start Kimi Code CLI as an ACP agent server with command `kimi acp`"                                                                                                                                                                                                                                                                     |
| 13  | **Qoder CLI**       | **原生支持**           | `qodercli --acp`                                    | stdio     | [官方文档](https://docs.qoder.com/cli/acp)：`qodercli --acp`                                                                                                                                                                                                                                                                                                                                                                   |
| 14  | **Mistral Vibe**    | **原生支持**           | `vibe-acp`                                          | stdio     | [GitHub docs/acp-setup.md](https://github.com/mistralai/mistral-vibe/blob/main/docs/acp-setup.md)：独立命令 `vibe-acp`（非 flag），安装 `mistral-vibe` 后自动包含                                                                                                                                                                                                                                                              |
| 15  | **Cursor Agent**    | **原生支持**           | `cursor-agent --acp`（Cursor 文档限流未能直接访问） | stdio     | [ACP agents 列表](https://agentclientprotocol.com/get-started/agents.md)确认，链接到 cursor.com/docs/cli/acp；[Goose 文档](https://block.github.io/goose/docs/getting-started/providers)列为 CLI Provider `cursor-agent`                                                                                                                                                                                                       |
| 16  | **Kiro CLI**        | **原生支持**           | `kiro-cli acp`                                      | stdio     | [官方文档](https://kiro.dev/docs/cli/acp/)：子命令 `acp`，文档详尽                                                                                                                                                                                                                                                                                                                                                             |
| 17  | **Nano Bot**        | **未确认**             | 未知                                                | —         | 未在 ACP agents 列表中                                                                                                                                                                                                                                                                                                                                                                                                         |

---

## 三、问题分类与解决方案

### 问题 A：npm 包名错误（安装了完全不同的工具）

| 工具               | 当前错误包名                     | 实际情况                      | 解决方案                                                                                                                                                       |
| ------------------ | -------------------------------- | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Goose**          | `goose-cli`                      | 数据库迁移工具，不是 AI agent | 改为 `{ cliCommand: "/bin/bash", args: ["-c", "curl -fsSL https://github.com/block/goose/releases/download/stable/download_cli.sh \| CONFIGURE=false bash"] }` |
| **Nano Bot**       | `nanobot`                        | 12年前的测试库，无 bin        | 改为 `{ cliCommand: "/bin/bash", args: ["-c", "brew install nanobot-ai/tap/nanobot"] }` （需确认 brew 是否可用）                                               |
| **GitHub Copilot** | `@githubnext/github-copilot-cli` | 已废弃的旧版 CLI              | 改为 `@github/copilot`，bin 名 `copilot`，acpArgs 改为 `["--acp", "--stdio"]`                                                                                  |

### 问题 B：bun 默认不执行 postinstall（工具安装不完整）

| 工具          | npm 包               | postinstall 做什么                                                 | 解决方案                                                   |
| ------------- | -------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------- |
| **OpenCode**  | `opencode-ai`        | `bun ./postinstall.mjs \|\| node ./postinstall.mjs` 下载 Go 二进制 | args 改为 `["add", "-g", "--trust", "opencode-ai"]`        |
| **Droid**     | `droid`              | `node install.js` 下载原生二进制                                   | args 改为 `["add", "-g", "--trust", "droid"]`              |
| **Qoder CLI** | `@qoder-ai/qodercli` | `node scripts/install.js` 下载原生二进制                           | args 改为 `["add", "-g", "--trust", "@qoder-ai/qodercli"]` |

注：`@openai/codex` 和 `@github/copilot` 使用 platform optional deps 模式且**无 postinstall**，bun 可正常安装。

### 问题 C：工具不在 npm 上（需要 curl 安装）

| 工具             | 安装方式                                                | 当前 lifecycle 能否支持          | onInstall 写法                                                                                       |
| ---------------- | ------------------------------------------------------- | -------------------------------- | ---------------------------------------------------------------------------------------------------- |
| **Kimi Code**    | `curl -L code.kimi.com/install.sh \| bash`              | **可以**，用 `/bin/bash -c` 绕过 | `{ cliCommand: "/bin/bash", args: ["-c", "curl -L code.kimi.com/install.sh \| bash"] }`              |
| **Mistral Vibe** | `curl -LsSf https://mistral.ai/vibe/install.sh \| bash` | **可以**                         | `{ cliCommand: "/bin/bash", args: ["-c", "curl -LsSf https://mistral.ai/vibe/install.sh \| bash"] }` |
| **Kiro CLI**     | `curl -fsSL https://cli.kiro.dev/install \| bash`       | **可以**                         | `{ cliCommand: "/bin/bash", args: ["-c", "curl -fsSL https://cli.kiro.dev/install \| bash"] }`       |
| **Goose**        | `curl ... \| CONFIGURE=false bash`                      | **可以**                         | 同上                                                                                                 |

注意：这些都需要适当增大 `timeout`（curl 下载可能较慢），建议 `120000`（2分钟）。

### 问题 D：工具无独立 CLI（不适合做 extension）

| 工具             | 原因                                                             | 建议                                                                         |
| ---------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| **Cursor Agent** | CLI 捆绑在 Cursor IDE 内，npm 无独立包，安装需先装 Cursor        | 暂不做 extension；或假设用户已装 Cursor，仅配置 cliCommand 为 `cursor-agent` |
| **Nano Bot**     | brew 安装不是跨平台方案（Windows 不可用），且**未确认 ACP 支持** | 考虑降低优先级或移除                                                         |

### 问题 E：ACP 需要适配器（非原生支持）

| 工具            | 适配器 npm 包                                                                                                                                                                 | 适配器 bin 名      | 适配器安装                                                                                                             | 前提条件                                 | ACP 启动命令       | onInstall 方案                                                                                                                                                                 |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ | ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Claude Code** | `@agentclientprotocol/claude-agent-acp` v0.24.2（[GitHub](https://github.com/agentclientprotocol/claude-agent-acp)，旧包名 `@zed-industries/claude-agent-acp` 已 deprecated） | `claude-agent-acp` | `bun add -g @agentclientprotocol/claude-agent-acp`（纯 JS，无 postinstall，不需 `--trust`）                            | Claude Code CLI (`claude`) 已安装在 PATH | `claude-agent-acp` | onInstall 需**两步**：先装 Claude Code CLI，再装适配器。可以用 `/bin/bash -c` 串联：`bun add -g @anthropic-ai/claude-code && bun add -g @agentclientprotocol/claude-agent-acp` |
| **Codex**       | `@zed-industries/codex-acp` v0.11.1（[GitHub](https://github.com/zed-industries/codex-acp)）                                                                                  | `codex-acp`        | `bun add -g @zed-industries/codex-acp`（Rust 原生二进制，platform optional deps 分发，无 postinstall，不需 `--trust`） | Codex CLI (`codex`) 已安装在 PATH        | `codex-acp`        | onInstall 需**两步**：先装 Codex CLI，再装适配器。可以用 `/bin/bash -c` 串联：`bun add -g @openai/codex && bun add -g @zed-industries/codex-acp`                               |

**适配器工作原理**：适配器本身是一个进程，启动后通过 stdio 对外提供标准 ACP 协议。内部它启动底层 CLI 子进程（`claude` 或 `codex`），将底层 CLI 的自有协议/SDK 翻译为 ACP 标准消息。适配器和底层 CLI 是两个独立的包，必须都安装才能工作。

---

## 四、综合建议

1. **立即修复**（问题 A）：Goose、Nanobot、Copilot 三个 extension 的 npm 包名/安装方式是错的，需要立即更正
2. **加 `--trust`**（问题 B）：OpenCode、Droid、Qoder 的 `onInstall.shell.args` 需要加 `--trust` 参数
3. **curl 安装可行**（问题 C）：当前 lifecycle 代码支持 `{ cliCommand: "/bin/bash", args: ["-c", "curl ... | bash"] }` 写法，**不需要改 lifecycle 代码**，但 timeout 建议从 30s 调大到 120s
4. **新增 extension**：Codex、Droid、Kimi、Qoder、Mistral Vibe、Kiro 都支持 ACP 且有可行的安装方案，可以做 extension
5. **暂不做**：Cursor Agent（无独立 CLI 安装方案），Nanobot（无 ACP 确认 + brew only）
6. **跨平台 onInstall**：将 `onInstall.shell` 改为按 `process.platform`（`darwin` / `linux` / `win32`）分平台配置
7. **Extension 信任机制**：下一期实现，详见 [Extension 信任机制设计方案](./extension-trust-mechanism.md)

---

## 信息来源

- npm registry API 直接查询各包的 `bin`、`scripts.postinstall`、`optionalDependencies` 字段
- ACP agents 列表：https://agentclientprotocol.com/get-started/agents.md
- Copilot CLI 官方 ACP 文档：https://docs.github.com/en/copilot/reference/copilot-cli-reference/acp-server
- Kiro CLI ACP 文档：https://kiro.dev/docs/cli/acp/
- Qoder CLI ACP 文档：https://docs.qoder.com/cli/acp
- Goose ACP providers 文档：https://block.github.io/goose/docs/getting-started/providers
- AionUi lifecycle 代码：`lifecycleRunner.ts:40-44`，`lifecycle.ts:144`
- Claude Agent ACP 适配器：https://github.com/agentclientprotocol/claude-agent-acp （npm: `@agentclientprotocol/claude-agent-acp`）
- Codex ACP 适配器：https://github.com/zed-industries/codex-acp （npm: `@zed-industries/codex-acp`）
- Zed 外部 agents 文档：https://zed.dev/docs/ai/external-agents
- Factory Droid Zed 集成文档：https://docs.factory.ai/integrations/zed
- Kimi Code CLI GitHub：https://github.com/MoonshotAI/kimi-cli
- Mistral Vibe ACP 文档：https://github.com/mistralai/mistral-vibe/blob/main/docs/acp-setup.md
- OpenClaw ACP 文档：https://docs.openclaw.ai/cli/acp
