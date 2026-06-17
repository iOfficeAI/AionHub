---
name: siliconflow-keyframe-video-outfit
description: "Create a SiliconFlow keyframe-based outfit-transfer video from a clothing reference image and a person video. Use when Codex needs the fast scheme 1 workflow to sample representative video frames, transfer clothing style with SiliconFlow image editing, generate I2V clips, concatenate to the original duration, and return a finished MP4 without doing expensive full per-frame video editing."
---

# SiliconFlow Keyframe Video Outfit

## Overview

Use this skill for the fast multi-segment workflow: one clothing image plus one person video becomes a finished outfit-transfer MP4. This is not strict frame-by-frame video editing; it intentionally uses representative keyframes and SiliconFlow I2V clips to produce a practical result faster.

## Required Inputs

- A person video, preferably vertical MP4.
- A clothing reference image.
- `SILICONFLOW_API_KEY` in the environment, or an API key file passed to the script.
- `ffmpeg` and `ffprobe` available in PATH or passed with `--ffmpeg` and `--ffprobe`.

Never put the token in output URLs, final filenames, logs, or generated prompts. Do not read local app config files for tokens unless the user explicitly asks.

## Quick Start

Run the bundled script:

```powershell
$env:SILICONFLOW_API_KEY = "<your SiliconFlow API key>"
node ".\scripts\keyframe-video-outfit.mjs" `
  --video ".\inputs\person.mp4" `
  --clothes ".\inputs\clothes.jpg" `
  --out ".\outputs\outfit-video.mp4" `
  --workdir ".\work"
```

If `ffmpeg` is not in PATH:

```powershell
node ".\scripts\keyframe-video-outfit.mjs" `
  --video ".\inputs\person.mp4" `
  --clothes ".\inputs\clothes.jpg" `
  --out ".\outputs\result.mp4" `
  --ffmpeg "<path-to-ffmpeg>" `
  --ffprobe "<path-to-ffprobe>"
```

## Workflow

1. Probe the source video for duration, size, frame rate, and audio.
2. Copy source files into the work directory with ASCII filenames to avoid Windows path encoding issues.
3. Extract representative keyframes, default `7`, across the video timeline.
4. Resize the clothing reference for API upload.
5. Call SiliconFlow image generation/editing model `Qwen/Qwen-Image-Edit-2509` for each keyframe.
6. Build a contact sheet so the user can inspect original vs edited keyframes.
7. Submit each edited keyframe to `Wan-AI/Wan2.2-I2V-A14B`.
8. Poll `/v1/video/status` until all segments succeed, then download every segment.
9. Trim each generated segment to equal slices of the original duration, concatenate, and attach original audio.
10. Save the final MP4 and a preview sheet next to the requested output.

## Quality Rules

- Prefer 5-9 keyframes. Seven is a good default for a 5-10 second vertical video.
- Ask the model to preserve identity, pose, handbag, background, lighting, crop, and camera angle.
- For close-up selfie frames, edit only visible clothing below the chin. Do not ask for a full-body robe.
- If a keyframe is bad, rerun only that keyframe using a stricter prompt, then rerun the I2V segment for that keyframe.
- Do not present this workflow as strict video-to-video try-on. It is a keyframe/I2V approximation.

## Bundled Resources

- `scripts/keyframe-video-outfit.mjs`: end-to-end automation script.
- `references/siliconflow-video-outfit.md`: API notes, output expectations, and troubleshooting.
