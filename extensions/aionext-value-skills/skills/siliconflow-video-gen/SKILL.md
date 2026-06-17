---
name: siliconflow-video-gen
description: Generate video clips through SiliconFlow video APIs for OpenClaw, especially Wan2.2 text-to-video and image-to-video. Use when the user asks for siliconflow-video-gen, 硅基流动视频, Wan2.2, 文生视频, 图生视频, AI video generation, request lists, polling video status, or downloading generated MP4 clips.
---

# SiliconFlow Video Gen

Use this skill to create and execute SiliconFlow video jobs. It is wired to the shared scripts in this extension:

```text
../ai-manga-drama/scripts/
```

## Quick Start

1. Use the `SILICONFLOW_API_KEY` environment variable, or copy `../ai-manga-drama/config/siliconflow.config.template.json` to `../ai-manga-drama/config/siliconflow.config.json` and fill it locally.
2. Create a job file using `examples\siliconflow-video-jobs.json` as the schema.
3. Dry-run first to inspect request bodies.
4. Submit jobs only after the user confirms cost/credit usage.
5. Poll and download results quickly because SiliconFlow video result links expire.

## Commands

Dry-run:

```powershell
powershell -ExecutionPolicy Bypass -File "..\ai-manga-drama\scripts\submit-siliconflow-videos.ps1" -JobsPath "<episode>\siliconflow-video-jobs.json" -DryRun
```

Submit:

```powershell
powershell -ExecutionPolicy Bypass -File "..\ai-manga-drama\scripts\submit-siliconflow-videos.ps1" -JobsPath "<episode>\siliconflow-video-jobs.json"
```

Poll and download:

```powershell
powershell -ExecutionPolicy Bypass -File "..\ai-manga-drama\scripts\poll-siliconflow-videos.ps1" -JobsPath "<episode>\siliconflow-video-jobs.results.json" -Download
```

## Defaults

- Text-to-video model: `Wan-AI/Wan2.2-T2V-A14B`
- Image-to-video model: `Wan-AI/Wan2.2-I2V-A14B`
- Vertical short video size: `720x1280`
- Base URL: `https://api.siliconflow.cn/v1`

Read `references\siliconflow.md` for endpoint and JSON details.
