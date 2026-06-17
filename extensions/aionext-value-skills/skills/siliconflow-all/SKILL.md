---
name: siliconflow-all
description: 硅基流动 SiliconFlow 全模态云模型 skill。覆盖 ASR（语音转文字）、TTS（文字转语音）、Chat（云端 LLM 对话/补标点/改写/翻译/总结）、Embedding（向量化）、Vision（看图/识图/视频帧分析）、ImageGen（生图）、VideoGen（生视频）。**不写死任何模型 ID**，每次任务前先 `GET /v1/models` 实时拉清单，按任务语义动态匹配。任务前简报 + 任务后简报，让用户确认。
---

# 硅基流动全模态云模型 Skill（D 盘桌面版）

## ⚠️ 核心原则
1. **不写死任何模型 ID**。所有模型必须 `GET /v1/models` 实时拉。
2. **任务前**输出 1 段"打算调啥 + 为什么 + 费用估"（≤ 80 字），等用户 1 个字"OK"就开干（或"换"则重选）。
3. **任务后**输出 1 段"实际用了啥 + 产物路径 + 用了多少 token/秒"。
4. 凭据**只走环境变量 `SILICONFLOW_API_KEY`**，绝不入文件。
5. **Pro/ 付费版默认跳过**，用户主动说"用最好的"才选。

## 何时触发
触发关键词（任一命中即用本 skill）：

| 类别 | 关键词 |
|---|---|
| 平台 | 硅基流动 / SiliconFlow / SF / siliconflow / silicon / 云模型 / 云端 |
| ASR | 语音转文字 / 转录 / 字幕 / ASR / stt / 听写 / 字幕提取 / 视频转文字 / 音频转文字 |
| TTS | 文字转语音 / 朗读 / TTS / tts / 合成语音 / 配音 |
| Chat | 补标点 / 改写 / 翻译 / 总结 / 摘要 / 润色 / 扩写 / 续写 / 用云跑 / 云上对话 / prompt |
| Embed | 嵌入 / 向量化 / embedding / 相似度 / 检索 / rerank |
| Vision | 看图 / 识图 / 描述图 / 图像理解 / 图片问答 / 视频帧分析 / 截屏分析 / OCR |
| ImageGen | 画图 / 生图 / 文生图 / image generation / 给我画 / 出图 / 海报 |
| VideoGen | 生视频 / 文生视频 / 视频生成 / video generation / 给我拍 / 出一段视频 |
| 多模态 | 多模态 / 端到端 / 全模态 / 任一附件 |

## API 凭证
- 读 `os.environ["SILICONFLOW_API_KEY"]`（或 PowerShell `$env:SILICONFLOW_API_KEY`）
- 找不到 → 提示："未配置 SILICONFLOW_API_KEY，去 https://cloud.siliconflow.cn/account/ak 申请，然后 `setx SILICONFLOW_API_KEY sk-...` 重开终端"
- 401 → key 无效；402 → 余额；429 → 退避 5s 最多 3 次

## 端点
| 用途 | 方法 | URL |
|---|---|---|
| 拉模型清单 | GET | `https://api.siliconflow.cn/v1/models` |
| 聊天 | POST | `https://api.siliconflow.cn/v1/chat/completions` |
| 语音转文字 | POST | `https://api.siliconflow.cn/v1/audio/transcriptions` |
| 文字转语音 | POST | `https://api.siliconflow.cn/v1/audio/speech` |
| 嵌入 | POST | `https://api.siliconflow.cn/v1/embeddings` |
| 图像理解 | POST | `https://api.siliconflow.cn/v1/chat/completions`（vision 模型）|
| 图像生成 | POST | `https://api.siliconflow.cn/v1/images/generations` |
| 视频生成 | POST | `https://api.siliconflow.cn/v1/videos/generations`（若平台支持）|

公共头：`Authorization: Bearer $SILICONFLOW_API_KEY`、`Content-Type: application/json`（非 multipart 时）。

## 动态选模型 4 步（每次必走）

### 步骤 1：拉清单
```python
models = GET /v1/models
# 缓存：同 session 内 ≤ 10 分钟；新会话重新拉
```

### 步骤 2：把模型按用途分桶（关键词命中即归桶，全文小写比较）

| 桶 | 命中关键词 |
|---|---|
| `asr` | asr, whisper, sensevoice, paraformer, telespeech, audiosense, stt, transcribe, audio-to-text |
| `tts` | tts, cosyvoice, chat-tts, text-to-audio, text-to-speech, voice, speech |
| `chat` | instruct, chat, qwen, glm, deepseek, llama, internlm, yi, mistral, gemma, baichuan, MiniMax, doubao, kimi, hunyuan, moss, seed, ernie, inclusionai, step, telechat |
| `vision` | vl, vision, see, glm-4v, qwen-vl, qwen2-vl, qwen3-vl, internvl, cogvlm, minicpm-v, gpt-4v, llava, omni |
| `imagegen` | image, sdxl, flux, sd-, kolors, cogview, kling, hunyuan-image, z-image, qwen-image, janus |
| `videogen` | video, t2v, i2v, sora, wan, kling, hunyuan-video, cogvideo |
| `embed` | embed, bge, m3e, text-embedding, retriever, reranker, retrieval |

### 步骤 3：组内优选（按用户意图调整）

1. **基础过滤**（默认应用）：
   - 去掉 `Pro/` 前缀（付费增强版）
   - 去掉 `LoRA/` 前缀
   - 去掉专门化分支（`-R1`, `-Thinking`, `-Coder`, `-OCR`, `-MT`, `-TTS`, `-ASR`），除非任务语义刚好对得上

2. **按用户上下文加权重**：
   - 用户语言是中文 → 名字含 `zh` `中文` `Chinese` `CN` 优先
   - 长上下文（>32k 文本）→ 名字含 `32K` `128K` `Instruct-128K` `long` 优先
   - 用户说"小快"/"省钱"/"省 token" → 名字里数字小的（4B < 8B < 14B < 32B < 72B）
   - 用户说"最强"/"最好"/"不差钱" → 不限 Pro，选名字里数字最大的

3. **次选**：上述无解 → 取组内**最靠前**的（硅基流动上新顺序）
4. **仍无解** → 告知"硅基流动未上架此类模型"，列出邻近桶供选

### 步骤 4：使用
直接传 `model=<selected_id>`。在最终简报里告诉用户"用了哪个 + 走的哪条规则"。

## 任务 → 桶的语义映射

| 用户任务 | 选哪个桶 | 备注 |
|---|---|---|
| "把 mp4 转字幕" / "听写" / "ASR" | asr | 输出 srt/verbose_json |
| "朗读这段文字" | tts | 输出 mp3/wav |
| "补标点" / "改写" / "翻译" / "总结" / "润色" / "扩写" | chat | 长上下文场景用 chat 长上下文组 |
| "嵌入" / "向量化" / "相似度" | embed | |
| "看这张图" / "描述图片" / "OCR" / "视频帧" | vision | 图片 base64 传入 |
| "画…图" / "生图" / "海报" | imagegen | |
| "生视频" / "出一段视频" | videogen | |
| 附件是音频（没说做什么）| asr | 默认转字幕 |
| 附件是图片（没说做什么）| vision | 描述 + 提问 |
| 附件是视频（没说做什么）| asr → vision | 1) 先抽音轨转字幕 2) 抽关键帧给 vision |

## 确认协议

### 任务前简报（≤ 80 字）
```
即将：[任务描述]
模型：[选出的桶/ID]
费用估：[token 估 / 视频秒数 / 图片张数 / "免费额度内"]
产物：[输出路径或"打印到聊天"]
开干？回 "OK" / "换" 重选 / "停" 取消
```

### 任务后简报（≤ 120 字）
```
完成：[任务描述]
模型：[实际 ID]
耗时：[秒]
产物：[路径 + 大小]
费用：[token / 视频秒 / "免费"]
```

## 强制规则
1. **每次任务前必拉 `/v1/models`**，缓存 ≤ 10 分钟
2. **代码/变量/注释/Shell 字符串里禁止出现具体模型 ID**（除了"刚选出来的、马上要用的"那一个变量）
3. **简报必给两次**（前 + 后），让用户可控
4. 选错导致效果差时，立刻重选并简报
5. 任何下载用 `requests.get(..., stream=True)`，不要 `urlretrieve`
6. 凭据**只走环境变量**，严禁入文件/日志
7. 用户问"你这次用的啥"必须如实回答 ID + 选它的规则

## 常见坑
- **key 401**：`setx` 改完要新开终端
- **音频 > 25MB**：先 ffmpeg 切分 / 16k mono
- **SRT 多语言**：verbose_json 拿 `language`
- **TTS 音色**：格式 `model_id:voice_name`，先 `GET /v1/models` 看 type=audio 详情
- **vision 图片**：先 base64（data URL）
- **Pro 模型**：默认跳过
- **视频生成** 慢（30s-5min），简报里要说"等 1-3 分钟"
- **生图 prompt** 要英文为主（多数模型英文效果更好）
- **生图分辨率** 1024x1024 是默认 / 4K 多为 1-2 元/张
