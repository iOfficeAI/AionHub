# SiliconFlow Video API Notes

Use the shared scripts:

- `../ai-manga-drama/scripts/submit-siliconflow-videos.ps1`
- `../ai-manga-drama/scripts/poll-siliconflow-videos.ps1`

Official pages:

- Submit video jobs: https://docs.siliconflow.cn/cn/api-reference/videos/videos_submit
- Poll video status: https://docs.siliconflow.cn/cn/api-reference/videos/get_videos_status
- Capability guide: https://docs.siliconflow.cn/cn/userguide/capabilities/video

Endpoints:

- `POST https://api.siliconflow.cn/v1/video/submit`
- `POST https://api.siliconflow.cn/v1/video/status`

Authentication:

```text
Authorization: Bearer <SILICONFLOW_API_KEY>
Content-Type: application/json
```

Models:

- `Wan-AI/Wan2.2-T2V-A14B`
- `Wan-AI/Wan2.2-I2V-A14B`

Job file schema:

```json
{
  "project": "demo",
  "episode": "episode-01",
  "defaults": {
    "image_size": "720x1280",
    "negative_prompt": "text, watermark, low quality"
  },
  "jobs": [
    {
      "id": "S001",
      "mode": "t2v",
      "prompt": "vertical anime cinematic shot..."
    },
    {
      "id": "S002",
      "mode": "i2v",
      "image": "assets/panels/P001.png",
      "prompt": "same character, blink, rain moves, slow push-in"
    }
  ]
}
```
