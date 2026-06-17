# 流动开放平台 API 参考

## 认证

所有API请求需要在Header中携带access_token：
```
Authorization: Bearer {ACCESS_TOKEN}
```

环境变量配置：
- `LIUDONG_ACCESS_TOKEN`: 流动平台访问令牌
- `LIUDONG_API_BASE`: https://api.liudongai.com/v1

## 数字人口播 API

### 1. 真人直接口播生成

Endpoint: `POST /digital-human/generate`

请求参数：
```json
{
  "image_url": "https://example.com/input.jpg",
  "text": "口播文案内容",
  "voice_id": "default",
  "with_subtitles": true
}
```

响应：
```json
{
  "code": 0,
  "data": {
    "task_id": "task-xxxxxxx",
    "status": "processing"
  }
}
```

### 2. AI数字人转换 + 口播生成

Endpoint: `POST /digital-human/create-and-generate`

请求参数：
```json
{
  "image_url": "https://example.com/input.jpg",
  "text": "口播文案内容",
  "voice_id": "default",
  "with_subtitles": true,
  "enable_digital_human": true
}
```

### 3. 查询任务状态

Endpoint: `GET /task/{task_id}`

响应：
```json
{
  "code": 0,
  "data": {
    "status": "success",
    "video_url": "https://example.com/output.mp4",
    "subtitle_url": "https://example.com/subtitles.srt"
  }
}
```

## 老照片修复 API

Endpoint: `POST /image/restoration`

请求参数：
```json
{
  "image_url": "https://example.com/old-photo.jpg",
  "upscale": 2,
  "face_enhance": true
}
```

响应：
```json
{
  "code": 0,
  "data": {
    "restored_image_url": "https://example.com/restored.jpg"
  }
}
