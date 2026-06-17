# aicharmer - AI 图片与视频生成助手

## 功能说明

通过 SiliconFlow API 或 MiniMax CLI 生成图片和视频。

**智能路由：** 自动检测当前 AI 模型，如果是 MiniMax 则优先使用 MiniMax CLI，否则使用 SiliconFlow API。

## 触发场景

当用户要求：
- 生成图片
- 制作视频 / 做视频
- 用 AI 生成图片/视频
- 类似的图片/视频生成请求

## AI 使用规范

**⚠️ 重要：作为 AI 助手，在你需要生成图片或视频时，必须先读取本 SKILL.md 文件，了解如何调用。**

---

### 第一步：检测当前模型

检查当前运行的模型是否包含 "minimax"（不区分大小写）：

```javascript
// 模型名称在 session_status 或 runtime 信息里
// 例如：custom/MiniMax-M2.7-highspeed
const isMiniMax = currentModel.toLowerCase().includes('minimax');
```

---

### 第二步：根据模型选择Provider

#### 如果是 MiniMax 模型：

**1. 检查 MiniMax CLI 是否已安装**
```bash
which mmx || npm list -g mmx-cli
```

**2. 如果未安装，先让用户确认后再安装**
```bash
npm install -g mmx-cli --registry https://registry.npmmirror.com
```

**3. 配置 API Key**
```bash
# 优先使用环境变量，不要把 key 写入技能文件或聊天记录
$env:MINIMAX_API_KEY="你的 MiniMax API Key"
mmx auth login --api-key {MINIMAX_API_KEY}
```

**4. 生成图片**
```bash
mmx image "你的图片描述"
```

**5. 生成视频**
```bash
mmx video generate --prompt "视频描述" --download output.mp4
```

---

#### 如果是非 MiniMax 模型（默认使用 SiliconFlow）：

**1. 从环境变量读取 SiliconFlow API 配置**
- API 接口地址：`https://api.siliconflow.cn`
- API Key：`SILICONFLOW_API_KEY`
- 图片模型：`Qwen/Qwen-Image`
- 视频模型：`Wan-AI/Wan2.2-T2V-A14B`

**2. 生成图片（curl）**
```bash
curl -X POST 'https://api.siliconflow.cn/v1/images/generations' \
  -H 'Authorization: Bearer {API_KEY}' \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "Qwen/Qwen-Image",
    "prompt": "你的图片描述",
    "image_size": "1024x1024",
    "num_images": 1
  }'
```

**3. 生成视频（curl + 轮询）**
```bash
# 提交任务
curl -X POST 'https://api.siliconflow.cn/v1/video/submit' \
  -H 'Authorization: Bearer {API_KEY}' \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "Wan-AI/Wan2.2-T2V-A14B",
    "image_url": "图片URL",
    "prompt": "视频描述",
    "duration": 5
  }'

# 轮询查询（等待 status 为 Succeed）
curl -X POST 'https://api.siliconflow.cn/v1/video/status' \
  -H 'Authorization: Bearer {API_KEY}' \
  -H 'Content-Type: application/json' \
  -d '{"requestId": "任务ID"}'
```

---

### 重要：MiniMax API Key 获取

MiniMax 的 API Key 不从项目文件读取，默认只读环境变量 `MINIMAX_API_KEY` 或 MiniMax CLI 自己的登录状态。

**用户配置方式：**
1. 如果用户接入了 MiniMax 大模型，他的 API key 就是 MiniMax 平台的 key
2. 设置 `MINIMAX_API_KEY`，或提前运行 `mmx auth login`
3. 或者让用户直接说 "用 MiniMax 生成图片" 明确指定

---

## 命令行使用

```bash
# 生成图片（自动选择 Provider）
node aicharmer.js image "一只橘猫在晒太阳" --save

# 生成视频（自动选择 Provider）
node aicharmer.js video "图片URL" "猫咪在伸懒腰" --save

# 强制使用 SiliconFlow
node aicharmer.js image "一只橘猫" --save --provider siliconflow

# 强制使用 MiniMax
node aicharmer.js image "一只橘猫" --save --provider minimax

# 查看帮助
node aicharmer.js help
```

---

## 提示词技巧

### 图片提示词结构
```
[主体] + [细节特征] + [动作/状态] + [背景环境] + [风格/质量]
```
**示例：**
```
A cute corgi dog, fluffy golden fur, big smile, sitting at a beach, sunset background, warm lighting, cartoon style, high quality
一只可爱的柴犬，毛茸茸的金色毛发，笑容灿烂，坐在海滩上，日落背景，暖色调，卡通风格，高质量
```

### 视频提示词结构
```
[主体] + [具体动作1] + [具体动作2] + [轻微动态] + [氛围]
```
**示例：**
```
The corgi is wagging its tail happily, tilting its head, blinking its eyes, slight body movement, warm and cheerful atmosphere
柴犬开心地摇着尾巴，歪着头，眨着眼睛，身体轻微晃动，温暖欢快的氛围
```

---

## 返回说明

- 成功：返回图片/视频URL，以及本地保存路径（如果用了--save）
- 失败：返回错误信息
- 视频生成需要等待（1-5分钟），会自动轮询直到完成
- MiniMax 视频会直接下载到本地（--download 参数）
