import { $ } from "bun";

const PKG = "opencode-ai";

const registries: { name: string; url: string }[] = [
  { name: "npm 官方源", url: "https://registry.npmjs.org" },
  { name: "华为开源镜像站", url: "https://repo.huaweicloud.com/repository/npm/" },
  { name: "腾讯云镜像源", url: "https://mirrors.cloud.tencent.com/npm/" },
  { name: "淘宝镜像源", url: "https://registry.npmmirror.com" },
];

let installed = false;

for (const reg of registries) {
  const cmd = `bun install -g --trust ${PKG} --registry=${reg.url}`;
  console.log(`[install] $ ${cmd} | 尝试 ${reg.name} (${reg.url}) ...`);
  try {
    await $`bun install -g --trust ${PKG} --registry=${reg.url}`.quiet();
    console.log(`[install] 通过 ${reg.name} 安装成功`);
    installed = true;
    break;
  } catch {
    console.warn(`[install] ${reg.name} 安装失败，尝试下一个源...`);
  }
}

if (!installed) {
  console.error("[install] 所有源均安装失败，请检查网络连接后重试");
  process.exit(1);
}
