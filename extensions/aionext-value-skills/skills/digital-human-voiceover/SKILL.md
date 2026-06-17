---
name: digital-human-voiceover
description: 从一张图片和文案生成数字人口播视频，支持流动和火山引擎两种处理轨迹，提供真人直接口播和AI数字人口播两种生成方案，自动为口播视频添加字幕和AI配音。使用当需要生成数字人视频口播内容时。
---

# 数字人口播

## 概述

本技能支持从输入图片和文案生成两种不同的数字人口播视频方案，分别可以使用流动和火山引擎两个不同的平台轨迹进行处理。所有生成的视频都会自动添加字幕并使用AI生成配音。

## 功能与方案

本技能提供两种生成方案：

1. **真人直接口播**：直接使用输入图片中的人物进行口播视频生成
2. **AI数字人转换口播**：先将输入图片转换为AI数字人形象，再基于数字人生成口播视频

两种方案都支持选择**流动**或**火山引擎**两种处理轨迹，最终输出都会包含：
- 生成的口播视频文件
- 自动嵌入的字幕
- AI生成的配音

## 工作流程

### 1. 输入检查
- 确认输入包含：1张图片 + 文案文本
- 如果缺少任一输入，请求用户补充

### 2. 选择处理轨迹
- 默认询问用户选择使用流动还是火山引擎，如果用户不指定，优先推荐流动轨迹
- 根据用户选择加载对应平台的API配置和处理脚本

### 3. 选择生成方案
- 默认提供两种方案供选择：真人直接口播 / AI数字人转换后口播
- 如果用户不指定，同时生成两种方案

### 4. 执行生成
- 根据选择的轨迹和方案，调用对应平台的API进行视频生成
- 自动生成AI配音，基于文案生成对应字幕
- 将字幕嵌入生成的视频中

### 5. 输出结果
- 返回生成的视频文件下载链接或本地路径
- 告知用户两种方案的生成结果

## 平台对接说明

### 流动 (Liudong)
- 参考流动开放平台API文档：[references/liudong-api.md](references/liudong-api.md)
- 处理脚本：[scripts/digital-human-liudong.py](scripts/digital-human-liudong.py)

### 火山引擎 (Volcengine)
- 参考火山引擎开放平台API文档：[references/volcengine-api.md](references/volcengine-api.md)
- 处理脚本：[scripts/digital-human-volcengine.py](scripts/digital-human-volcengine.py)

## 资源

### scripts/
- `digital-human-liudong.py`: 流动平台数字人口播生成脚本
- `digital-human-volcengine.py`: 火山引擎平台数字人口播生成脚本
- `add-subtitles.py`: 通用字幕嵌入脚本

### references/
- `liudong-api.md`: 流动平台API参考文档
- `volcengine-api.md`: 火山引擎API参考文档
