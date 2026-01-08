# BioBlueprint Agent 项目规范

## 测试结果命名规范

测试结果保存在 `results/` 目录，命名格式：

```
bioblueprint_YYYYMMDD_HHMMSS.json
```

示例：
- `bioblueprint_20260108_103000.json`
- `bioblueprint_20260107_185800.json`

运行测试时会自动生成带时间戳的文件名。

## 运行测试

```bash
# 使用默认路径，自动命名
npm run test:full /path/to/images

# 指定输出文件
npm run test:full /path/to/images /path/to/output.json
```

## 代码注释语言

- 代码注释使用英文
- 文档和 README 使用中文

## 置信度阈值

- 当前阈值：0.8
- 低于阈值的字段不输出
