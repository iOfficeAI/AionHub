# Value Skills Pack

This extension packages the useful parts of `增值技能.zip` for OpenClaw/AionUi distribution through AionHub.

Included skills:

- `train-12306`
- `siliconflow-all`
- `image-process`
- `aicharmer`
- `ecommerce-listing`
- `digital-human-voiceover`
- `old-photo-restoration`
- `old-photo-animation`
- `video-editor`
- `ai-manga-drama`
- `siliconflow-video-gen`
- `siliconflow-keyframe-video-outfit`

Safety and portability rules applied before publishing:

- No API keys, user secrets, or local private config files are included.
- No `node_modules`, package locks, logs, generated exports, sample media projects, local models, or large binary tools are included.
- Video editor dependencies such as FFmpeg and whisper.cpp models are optional and must be installed locally or placed on `PATH`.
- Cloud skills read credentials from environment variables such as `SILICONFLOW_API_KEY`, `MINIMAX_API_KEY`, `LIUDONG_ACCESS_TOKEN`, `VOLCENGINE_ACCESS_KEY_ID`, and `VOLCENGINE_SECRET_ACCESS_KEY`.

The internal "super brain" package from the source archive was intentionally not included because it contains machine/user-specific workspace state rather than a reusable public skill.
