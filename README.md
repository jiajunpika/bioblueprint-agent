# BioBlueprint Agent

从 Instagram 截图中分析用户画像，生成结构化的 BioBlueprint JSON。

## 核心特性

- **两阶段分析流水线**：Scanner 快速扫描 + Analyzer 深度分析
- **EXIF 元数据提取**：GPS 定位、拍摄时间自动解析
- **OCR 文字识别**：提取图片中的文字作为推断依据
- **跨图关联推断**：多张图片中出现相同元素时提高置信度
- **零幻觉原则**：只输出有证据支持的信息

## 架构设计

```
用户上传图片
      ↓
┌─────────────────────────────────────┐
│      Preprocessor                   │
│  - HEIC → JPG 格式转换              │
│  - 图片压缩 (max 800px)             │
│  - EXIF 提取 (GPS, 时间)            │
└─────────────────┬───────────────────┘
                  ↓
┌─────────────────────────────────────┐
│      Phase 1: Scanner Agent         │
│  - 快速扫描所有图片                  │
│  - OCR 提取文字                      │
│  - 生成标签索引                      │
│  - 检测跨图关联主题                  │
└─────────────────┬───────────────────┘
                  ↓
┌─────────────────────────────────────┐
│      Phase 2: Analyzer Agent        │
│  - 基于扫描结果深度分析              │
│  - 结合 EXIF 数据推断                │
│  - 生成 BioBlueprint JSON           │
└─────────────────┬───────────────────┘
                  ↓
            最终 JSON 输出
```

## BioBlueprint 7 大分类

| 分类 | 说明 | 示例字段 |
|-----|------|---------|
| **corePersonality** | 核心性格特质 | 家庭导向、文化认同 |
| **careerEngine** | 职业相关 | 职业类型、工作方式 |
| **expressionEngine** | 表达方式 | 内容创作风格 |
| **aestheticEngine** | 审美偏好 | 家居风格、穿搭 |
| **simulation** | 日常生活 | 爱好、饮食、常去地点 |
| **backstory** | 背景故事 | 家庭、教育、人生事件 |
| **goal** | 目标愿景 | 人生追求 |

## 置信度系统

| 证据类型 | 置信度 |
|---------|--------|
| EXIF GPS 坐标 | 0.95+ |
| OCR 识别文字 | 0.9+ |
| 4+ 张图片出现 | 0.85-0.9 |
| 3 张图片 + 明确证据 | 0.8-0.85 |
| < 0.8 | **不输出** |

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置 API Key

```bash
cp .env.example .env
# 编辑 .env 添加 ANTHROPIC_API_KEY
```

### 3. 准备图片

将 Instagram 截图放入目录，支持 JPG/PNG/HEIC 格式。

如果有 HEIC 格式，先转换：
```bash
# macOS 使用 sips 转换
for f in *.HEIC; do sips -s format jpeg "$f" --out "${f%.HEIC}.jpg"; done
```

### 4. 运行分析

```bash
npm run test:full /path/to/images
```

## 输出示例

```json
{
  "simulation": {
    "currentLocation": {
      "value": "Bay Area, California",
      "confidence": 0.98,
      "evidence": ["16 images with GPS in SF Bay Area"],
      "inferredFrom": "GPS coordinates cluster analysis"
    }
  },
  "backstory": {
    "recentChinaVisit": {
      "value": "family trip to China in December 2025",
      "confidence": 0.9,
      "evidence": ["GPS 26.09, 119.24 (Fujian Province)"],
      "inferredFrom": "EXIF GPS + children present in photos"
    }
  }
}
```

## 项目结构

```
bioblueprint-agent/
├── src/
│   ├── pipeline.ts          # 两阶段流水线
│   ├── prompts/
│   │   ├── scanner.ts       # Scanner Agent prompt
│   │   └── analyzer.ts      # Analyzer Agent prompt
│   ├── types/
│   │   └── bioblueprint.ts  # 类型定义
│   └── utils/
│       └── preprocess.ts    # 图片预处理 + EXIF
├── test/
│   └── full.test.ts         # 完整测试
└── results/                  # 分析结果
```

## 设计原则

### 零幻觉 (Zero Hallucination)

- 只输出图片中实际存在的信息
- 没有证据就不填写
- 置信度必须反映真实确定性

### 证据优先级

1. EXIF GPS → 最高置信度（实际坐标）
2. EXIF 时间戳 → 活动时间线
3. OCR 文字 → 商家名、地点标签
4. 视觉内容 → 图片可见元素
5. 跨图模式 → 多次出现的元素

### 动态字段

二级字段不固定，根据图片内容动态生成。只有 7 个顶级分类是固定的。

## 迭代方向

- [ ] 添加更多图片测试（50+ 张）
- [ ] 构建 Web 上传界面
- [ ] 实现方案 2（多 Agent 并行）
- [ ] 添加地点反查（GPS → 地名）
- [ ] 支持 Instagram API 直接获取图片
