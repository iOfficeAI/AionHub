---
name: video-editor
description: Local-first video editing with no API keys. Use when Codex or OpenClaw needs to cut and merge multiple videos, add local voiceover, mix background music, create or burn subtitles, normalize aspect ratios for short-form or horizontal exports, inspect media with ffprobe, or render an edit plan using bundled FFmpeg/whisper.cpp/Piper-style local tools.
---

# Video Editor

Use this skill to create videos from local assets without cloud APIs or API keys. This GitHub extension is lightweight: large binaries, local models, and sample media are not bundled. Prefer tools on `PATH`, or run the optional dependency script before rendering.

## Workflow

1. Inspect inputs with `ffprobe` before editing.
2. Build or update an `edit_plan.json` using the schema in `references/edit_plan.md`.
3. Render deterministic cuts with `scripts/render-from-plan.ps1`.
4. Use `whisper.cpp` only when the user needs local speech-to-text subtitles.
5. Use Piper only when the user needs local text-to-speech voiceover.
6. Keep intermediate files in a task-local output directory and preserve `render.log`.

## Tool Selection

- Use FFmpeg/ffprobe for trimming, concatenation, transcoding, aspect-ratio conversion, subtitle burn-in, and audio mixing.
- Use whisper.cpp for local subtitle generation. Do not use faster-whisper, OpenAI Whisper API, or any cloud ASR.
- Use Piper for local TTS. Do not use ElevenLabs, edge-tts, or any key-based TTS.
- If a needed local binary or model is missing, report exactly which file is missing and continue with the parts that can run.

## Optional Portable Paths

When dependencies have been downloaded for a portable package, resolve paths relative to the package root:

```text
剪辑技能/
  bin/win/ffmpeg.exe
  bin/win/ffprobe.exe
  bin/win/whisper/whisper-cli.exe
  bin/win/piper/piper.exe
  models/whisper.cpp/
  models/piper/
  assets/fonts/
  assets/music/
  assets/sfx/
```

The skill folder is `剪辑技能/skills/video-editor`. The package root is two levels above the skill folder.

Run `download-deps-windows.ps1` from this skill folder to populate optional portable binaries and default local models. Do not commit the downloaded `bin/`, `models/`, or media assets back into the extension.

## Rendering

Use:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\render-from-plan.ps1 -PlanPath C:\path\to\edit_plan.json
```

The script supports:

- clip trimming by `start` and `duration`
- multi-clip concatenation
- 16:9, 9:16, 1:1, or custom width/height output
- optional voiceover and background music
- optional SRT subtitle burn-in
- output of `final.mp4`, temporary clips, and `render.log`

For complex creative edits, generate a new plan and then render. Avoid ad hoc FFmpeg commands unless the plan schema cannot express the request.

## Subtitle Generation

When asked to make subtitles from speech:

1. Extract or reuse source audio with FFmpeg.
2. Run the bundled `whisper-cli.exe` if present.
3. Save subtitles as `.srt`.
4. Add the `.srt` path to `edit_plan.json`.
5. Render with subtitle burn-in when requested.

Use the smallest available model that is good enough. Prefer a local small Chinese-capable whisper.cpp model if available; otherwise ask the user before downloading a larger model.

## Voiceover

When asked to create voiceover:

1. Ask the model to draft or revise narration text if needed.
2. Run the bundled `piper.exe` with a local `.onnx` voice model if present.
3. Save voiceover as WAV.
4. Add it to `edit_plan.json` under `voiceover.file`.

Never require API keys for voiceover.

## Verification

After rendering, verify:

- output file exists and is non-empty
- duration is plausible with `ffprobe`
- subtitles are readable when burn-in was requested
- background music does not overpower voiceover
- aspect ratio matches the requested platform
