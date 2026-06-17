# edit_plan.json

Use this schema for deterministic local renders.

```json
{
  "output": "output/final.mp4",
  "format": {
    "width": 1080,
    "height": 1920,
    "fps": 30
  },
  "clips": [
    {
      "file": "C:/Videos/source-1.mp4",
      "start": "00:00:03",
      "duration": "00:00:08",
      "volume": 1.0
    }
  ],
  "voiceover": {
    "file": "C:/Videos/voiceover.wav",
    "volume": 1.0
  },
  "music": {
    "file": "C:/Videos/bgm.mp3",
    "volume": 0.18
  },
  "subtitles": {
    "file": "C:/Videos/subtitles.srt",
    "burn": true
  }
}
```

Fields:

- `output`: final MP4 path. Relative paths resolve from the plan file directory.
- `format.width`, `format.height`, `format.fps`: output geometry and frame rate.
- `clips`: ordered source clips. Each clip may include `start`, `duration`, and `volume`.
- `voiceover.file`: optional local voiceover WAV/MP3 file.
- `music.file`: optional local BGM file. Keep volume low when voiceover exists.
- `subtitles.file`: optional SRT file.
- `subtitles.burn`: true to burn subtitles into the video.

Recommended presets:

- Douyin/TikTok/Reels/Shorts: `1080x1920`, `fps: 30`
- Bilibili/YouTube horizontal: `1920x1080`, `fps: 30`
- Square feed: `1080x1080`, `fps: 30`
