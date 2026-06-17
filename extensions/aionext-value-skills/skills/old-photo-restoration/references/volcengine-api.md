# 火山引擎 API 参考

## 认证

使用火山引擎账号的Access Key进行认证：
- `VOLCENGINE_ACCESS_KEY_ID`: Access Key ID
- `VOLCENGINE_SECRET_ACCESS_KEY`: Secret Access Key
- `VOLCENGINE_REGION`: cn-beijing (默认)

API Base URL: `https://open.volcengineapi.com`

## 数字人口播 API (通过火山引擎智能创作)

### 1. 创建数字人

Endpoint: `POST /api/v1/digital_human/create`

请求参数：
```json
{
  "image_url": "https://example.com/input.jpg",
  "name": "digital-human-xxx"
}
```

### 2. 提交口播生成任务

- **真人直接口播**（使用原图驱动）：
Endpoint: `POST /api/v1/digital_human/start_generation`

```json
{
  "image_url": "https://example.com/input.jpg",
  "text": "口播文案内容",
  "speaker_id": "default",
  "add_subtitle": true
}
```

- **AI数字人口播**（先创建数字人再生成）：
```json
{
  "digital_human_id": "created-digital-human-id",
  "text": "口播文案内容",
  "speaker_id": "default",
  "add_subtitle": true
}
```

### 3. 查询任务结果

Endpoint: `GET /api/v1/digital_human/get_generation_result/{task_id}`

响应：
```json
{
  "ResponseMetadata": {
    "RequestId": "xxx"
  },
  "Result": {
    "Status": "Success",
    "VideoUrl": "https://example.com/output.mp4",
    "SubtitleUrl": "https://example.com/subtitle.srt"
  }
}
```

## 老照片修复 API (通过火山引擎图像修复)

Endpoint: `POST /api/v1/image/enhance`

请求参数：
```json
{
  "image_url": "https://example.com/old-photo.jpg",
  "upscale": 2,
  "repair_scratch": true,
  "colorize": true
}
```

响应：
```json
{
  "ResponseMetadata": {
    "RequestId": "xxx"
  },
  "Result": {
    "result_image_url": "https://example.com/restored.jpg"
  }
}
