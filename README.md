# 代码替换工具

## 项目简介
基于Node.js开发的批量代码替换工具，用于根据配置规则自动替换源代码中的特定模式。

## 功能特性
- 支持多目录并行处理
- 正则表达式替换
- 自动创建目标目录结构
- 可选文件备份功能

## 快速开始

### 环境要求
- Node.js >= 14.x

### 安装步骤
```bash
npm install
```

### 配置说明
1. 修改`replace-config.json`:
```json
{
  "rules": [
    {
      "pattern": "原始文本",
      "replacement": "替换文本"
    }
  ]
}
```
2. 编辑`replace.js`中的路径配置：
```js
const sourcePaths = [
  // 原始路径
];

const outputDir = [
  // 输出路径
];
```

### 运行命令
```bash
npm start
```

## 注意事项
1. 确保源路径与目标路径数组长度一致
2. 启用备份功能需设置`backupEnabled = true`
3. 替换规则支持正则表达式语法
4. 输出目录应用 切到开发分支