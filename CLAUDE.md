# BioBlueprint Agent 项目规范

## 数据集目录结构

测试数据集保存在 `datasets/` 目录：

```
datasets/
├── jiajun/          # 第一个测试数据集
│   ├── IMG_3498.JPG
│   ├── IMG_3566.JPG
│   └── ...
├── dataset_name/    # 其他数据集
│   └── ...
```

命名规范：
- 使用小写字母和下划线
- 按人名或项目名命名
- 每个数据集一个子目录

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
# 使用默认数据集 (datasets/jiajun)
npm run test:full

# 指定数据集
npm run test:full datasets/other_dataset

# 指定数据集和输出文件
npm run test:full datasets/jiajun results/custom_name.json
```

## 代码注释语言

- 代码注释使用英文
- 文档和 README 使用中文

## 置信度阈值

- 当前阈值：0.8
- 低于阈值的字段不输出
