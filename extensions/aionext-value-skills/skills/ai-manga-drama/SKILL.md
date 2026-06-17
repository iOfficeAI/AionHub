---
name: ai-manga-drama
description: Create AI manga drama episodes for OpenClaw, including story bible, episode outline, storyboard, SiliconFlow/Wan video generation jobs, video polling/download, subtitles, voiceover planning, and final short-drama assembly. Use when the user asks for AI漫剧, AI漫画剧, 竖屏短剧, SiliconFlow video model workflows, Wan2.2 T2V/I2V clips, or turning still panels/prompts into moving video clips.
---

# AI Manga Drama

Use this skill to help OpenClaw produce vertical AI manga-drama episodes. Prefer a project folder with one episode per directory:

```text
projects/<series-name>/story_bible.json
projects/<series-name>/episode-01/
  storyboard.csv
  siliconflow-video-jobs.json
  subtitles.srt
  assets/
    panels/
    clips/
    audio/
  output/
```

## Workflow

1. Write `story_bible.json` for characters, tone, world rules, visual style, and recurring constraints.
2. Write a scene-by-scene storyboard. Keep each shot short and visually clear.
3. For still-image motion, use SiliconFlow image-to-video (`Wan-AI/Wan2.2-I2V-A14B`) with a public image URL or a local image path converted to a data URL by the script.
4. For shots without a panel image, use text-to-video (`Wan-AI/Wan2.2-T2V-A14B`) and describe character, action, background, camera movement, lighting, and style.
5. Submit video jobs with `scripts/submit-siliconflow-videos.ps1`.
6. Poll and download clips with `scripts/poll-siliconflow-videos.ps1`.
7. Assemble downloaded clips with subtitles, narration, and music using the local editing skill or ffmpeg.

## SiliconFlow

Load `references/siliconflow.md` before creating, submitting, or polling SiliconFlow jobs.

Use `SILICONFLOW_API_KEY` for credentials, or copy `config/siliconflow.config.template.json` to `config/siliconflow.config.json` inside this skill folder and fill it locally. Never ask the user to paste keys into chat.

## Scripts

- `scripts/submit-siliconflow-videos.ps1`: submit or dry-run video jobs.
- `scripts/poll-siliconflow-videos.ps1`: poll request IDs and optionally download generated MP4 clips.

Prefer dry-run first:

```powershell
powershell -ExecutionPolicy Bypass -File ".\scripts\submit-siliconflow-videos.ps1" -JobsPath ".\examples\siliconflow-video-jobs.json" -DryRun
```

Then submit after the user has filled the API key:

```powershell
powershell -ExecutionPolicy Bypass -File ".\scripts\submit-siliconflow-videos.ps1" -JobsPath "<episode>\siliconflow-video-jobs.json"
```

Poll results:

```powershell
powershell -ExecutionPolicy Bypass -File ".\scripts\poll-siliconflow-videos.ps1" -JobsPath "<episode>\siliconflow-video-jobs.results.json" -Download
```

## Prompt Rules

- Keep each video job focused on one action beat.
- For vertical Douyin/Bilibili/TikTok style, use `image_size: "720x1280"`.
- For I2V, provide `image` as an HTTP URL or local PNG/JPG path.
- Include camera language: close-up, slow push-in, handheld, pan, tilt, rack focus.
- Include motion language: hair moves, eyes blink, rain falls, coat flutters, neon reflection ripples.
- Avoid asking the model for complex plot transitions inside one clip; split into more shots.
