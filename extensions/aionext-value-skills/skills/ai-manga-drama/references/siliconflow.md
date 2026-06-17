# SiliconFlow Video Backend

Official API pages:

- Create video: https://docs.siliconflow.cn/cn/api-reference/videos/videos_submit
- Retrieve video: https://docs.siliconflow.cn/cn/api-reference/videos/get_videos_status
- Video guide: https://docs.siliconflow.cn/cn/userguide/capabilities/video

## Endpoints

- Submit: `POST https://api.siliconflow.cn/v1/video/submit`
- Status: `POST https://api.siliconflow.cn/v1/video/status`

Use `Authorization: Bearer <SILICONFLOW_API_KEY>` and `Content-Type: application/json`.

## Models

- Text-to-video: `Wan-AI/Wan2.2-T2V-A14B`
- Image-to-video: `Wan-AI/Wan2.2-I2V-A14B`

## Submit Body

Common fields:

```json
{
  "model": "Wan-AI/Wan2.2-T2V-A14B",
  "prompt": "shot description",
  "image_size": "720x1280",
  "negative_prompt": "bad hands, extra fingers, text, watermark",
  "seed": 123
}
```

For image-to-video, add `image`. The value may be a public image URL or `data:image/png;base64,...` / `data:image/jpeg;base64,...`.

```json
{
  "model": "Wan-AI/Wan2.2-I2V-A14B",
  "prompt": "the girl blinks, rain moves, slow camera push-in",
  "image_size": "720x1280",
  "image": "https://example.com/panel.png"
}
```

Allowed `image_size` values: `1280x720`, `720x1280`, `960x960`.

The submit response returns:

```json
{ "requestId": "..." }
```

## Status Body

```json
{ "requestId": "..." }
```

Status values include `Succeed`, `InQueue`, `InProgress`, and `Failed`.

When status is `Succeed`, the first clip URL is usually at:

```text
results.videos[0].url
```

Download generated video URLs quickly. Official docs say generated result links expire.

## Practical Defaults

- Use CN base URL by default: `https://api.siliconflow.cn/v1`.
- For vertical short drama: `720x1280`.
- Use I2V when character consistency matters.
- Use T2V for establishing shots, transitions, and background action.
