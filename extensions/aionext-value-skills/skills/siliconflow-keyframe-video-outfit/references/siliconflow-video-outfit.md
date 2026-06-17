# SiliconFlow Video Outfit Reference

## Models

- Image edit: `Qwen/Qwen-Image-Edit-2509`
- Image-to-video: `Wan-AI/Wan2.2-I2V-A14B`

## Endpoints

- Image edit: `POST https://api.siliconflow.cn/v1/images/generations`
- Video submit: `POST https://api.siliconflow.cn/v1/video/submit`
- Video status: `POST https://api.siliconflow.cn/v1/video/status`

## Important Behavior

- Video generation is asynchronous. Submit returns `requestId`; poll status until a result URL appears.
- Generated I2V clips are commonly about 5 seconds. The script trims each clip so the concatenated output matches the original video duration.
- SiliconFlow temporary result URLs expire. Download immediately and keep local copies in the work directory.
- Windows paths with Chinese characters can break some ffmpeg invocations under legacy code pages. The script copies inputs to ASCII filenames in the work directory before processing.

## Failure Modes

- `401` or `403`: API key missing, invalid, or no model permission.
- `inqueue` for a long time: backend queue is slow; continue polling.
- Completed status without a URL: save the status JSON and inspect response shape; endpoint response may have changed.
- Scene drift in edited keyframes: rerun the affected keyframe with a stricter prompt that says "edit only visible clothing areas" and "do not use image2 as pose reference."
