---
name: old-photo-restoration
description: 通过AI技术修复老旧照片，支持流动和火山引擎两种处理轨迹，提供高清AI修复能力。使用当需要修复老照片、提升老照片清晰度、修复老照片损坏时。
---

# 老照片修复

## 概述

本技能提供AI老照片修复能力，支持使用流动和火山引擎两种不同的AI处理轨迹对老照片进行修复，能够提升老照片清晰度、修复损坏区域、还原色彩，并生成高清版本的修复结果。

## 工作流程

### 1. 输入检查
- 确认输入包含需要修复的老照片文件
- 如果缺少输入，请求用户补充

### 2. 选择处理轨迹
- 默认询问用户选择使用流动还是火山引擎，如果用户不指定，优先推荐流动轨迹
- 根据用户选择加载对应平台的API配置和处理脚本

### 3. 执行修复
- 调用对应平台的AI修复API上传老照片
- 等待AI修复完成，获取修复后的高清图片

### 4. 输出结果
- 返回修复后的高清图片，对比修复前后效果
- 保存修复后的图片到本地或提供下载链接

## 平台对接说明

### 流动 (Liudong)
- 参考流动开放平台API文档：[references/liudong-api.md](references/liudong-api.md)
- 处理脚本：[scripts/restoration-liudong.py](scripts/restoration-liudong.py)

### 火山引擎 (Volcengine)
- 参考火山引擎开放平台API文档：[references/volcengine-api.md](references/volcengine-api.md)
- 处理脚本：[scripts/restoration-volcengine.py](scripts/restoration-volcengine.py)

## 资源

### scripts/
- `restoration-liudong.py`: 流动平台老照片修复脚本
- `restoration-volcengine.py`: 火山引擎平台老照片修复脚本

### references/
- `liudong-api.md`: 流动平台API参考文档
- `volcengine-api.md`: 火山引擎API参考文档
