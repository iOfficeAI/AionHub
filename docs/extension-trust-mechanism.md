# Extension 信任机制设计方案

## 核心流程

```
用户点击"安装 Extension"
        ↓
读取 aion-extension.json 的 onInstall
        ↓
弹出确认对话框，展示将要执行的命令
        ↓
  用户确认 → 执行 onInstall
  用户拒绝 → 取消安装
        ↓
持久化信任记录（hash 命令内容）
        ↓
下次同版本安装不再弹窗
```

## 要解决的问题

不管 `shell: true` 还是 `shell: false`，extension 的 `onInstall` 都可以执行任意命令。`shell: false` + `/bin/bash -c` workaround 并不比 `shell: true` 更安全。真正的安全问题不在于是否允许管道/重定向，而在于**是否信任 extension 的 onInstall 内容**。

需要一个机制让用户在安装 extension 时**明确知道并同意**将要执行的命令。

## 信任粒度

| 粒度                     | 做法                           | 优缺点                                                   |
| ------------------------ | ------------------------------ | -------------------------------------------------------- |
| 信任 extension           | 记录 `extensionId`             | 简单，但 extension 更新后 onInstall 可能变了，用户不知道 |
| 信任 extension + version | 记录 `extensionId@version`     | 每次版本更新重新确认，安全但烦                           |
| **信任命令内容（推荐）** | 记录 `hash(cliCommand + args)` | 命令不变就不弹窗，命令变了就重新确认                     |

推荐按**命令内容 hash** 做信任粒度：extension 版本更新但安装命令没变则不弹窗，安装命令变了才重新确认。兼顾安全和体验。

## 展示什么给用户

不能只展示 raw JSON，要让非技术用户也能看懂风险等级：

```
┌──────────────────────────────────────────────┐
│  安装 Extension: Kimi Code                   │
│                                              │
│  此 extension 需要执行以下安装命令：         │
│                                              │
│  /bin/bash -c                                │
│    "curl -L code.kimi.com/install.sh | bash" │
│                                              │
│  ⚠ 此命令将从网络下载并执行脚本              │
│                                              │
│  [允许]  [查看详情]  [拒绝]                  │
└──────────────────────────────────────────────┘
```

可以做简单的风险标签检测：

| 命令特征                         | 风险标签                |
| -------------------------------- | ----------------------- |
| 含 `curl \| bash` / `wget \| sh` | "从网络下载并执行脚本"  |
| 含 `--trust`                     | "允许包执行安装后脚本"  |
| 含 `rm` / `sudo`                 | "高风险操作"            |
| 只是 `bun add -g xxx`            | "安装 npm 包"（低风险） |

## 信任存储

存在用户本地，比如 `~/.aionui/trusted-extensions.json`：

```json
{
  "aionext-kimi": {
    "commandHash": "sha256:abc123...",
    "trustedAt": "2026-04-03T10:00:00Z",
    "command": "/bin/bash -c \"curl -L code.kimi.com/install.sh | bash\""
  }
}
```

## 官方 Registry 的 Extension

可以考虑对官方 registry 的 extension 自动信任（或降低确认等级），对第三方 extension 强制确认。类似 macOS Gatekeeper 的"已签名应用"vs"未签名应用"的区分。

| 来源          | 确认行为                      |
| ------------- | ----------------------------- |
| 官方 registry | 自动信任 / 仅展示通知，不阻断 |
| 第三方        | 弹窗确认，用户必须点允许      |
