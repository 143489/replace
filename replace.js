/*
 * @Description: 
 * @Author: luokang
 * @Date: 2025-03-05 10:34:20
 */
const fs = require('fs');
const path = require('path');
// 加载替换规则配置
const config = require('./replace-config.json');

// 配置参数
const sourcePaths = [
  String.raw`D:\gitProject\国内jms\jms-web-financialreportweb\src\views\internal-settlement-bill`,
];
const outputDir = [
  String.raw`D:\gitProject\国内jms\yl-jms-wd-financialmanagement-front\src\views\internal-settlement-bill`,
];
const backupEnabled = false; // 是否启用备份功能

async function processFile(filePath, createDir, absSource) {
  try {
    const relativePath = path.relative(absSource, filePath);
    const targetPath = path.join(createDir, relativePath);
    
    // 创建目标目录
    await fs.promises.mkdir(path.dirname(targetPath), { recursive: true });

    const content = await fs.promises.readFile(filePath, 'utf8');
    let modified = content;

    // 应用所有替换规则
    config.rules.forEach(rule => {
      modified = modified.replace(new RegExp(rule.pattern, 'g'), rule.replacement);
    });
    
    // 写入目标文件
    await fs.promises.writeFile(targetPath, modified);
    
    // 保留原备份逻辑
    if (backupEnabled) {
      const backupPath = `${filePath}.bak`;
      await fs.promises.writeFile(backupPath, content);
    }

    console.log(`✅ 处理完成: ${filePath}`);
  } catch (error) {
    console.error(`❌ 处理失败 ${filePath}:`, error.message);
  }
}

async function walk(dir, outputPath, absSource) {
  try {
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativeToSource = path.relative(absSource, fullPath);
      const targetPath = path.resolve(outputPath, relativeToSource);

      if (entry.isDirectory()) {
        await fs.promises.mkdir(targetPath, { recursive: true });
        await walk(fullPath, outputPath, absSource);
      } else {
        await processFile(fullPath, outputPath, absSource);
      }
    }
  } catch (error) {
    console.error(`🚨 遍历目录失败 [${dir}]:`, error.message);
  }
}

async function processFile(filePath, outputPath, absSource) {
  try {
    const relativePath = path.relative(absSource, filePath);
    const targetPath = path.join(outputPath, relativePath);
    
    await fs.promises.mkdir(path.dirname(targetPath), { recursive: true });
    
    const content = await fs.promises.readFile(filePath, 'utf8');
    let modified = content;
    
    config.rules.forEach(rule => {
      modified = modified.replace(new RegExp(rule.pattern, 'g'), rule.replacement);
    });
    
    await fs.promises.writeFile(targetPath, modified);
    
    console.log(`✅ 处理完成: ${filePath}`);
  } catch (error) {
    console.error(`❌ 处理失败 ${filePath}:`, error);
    throw error;
  }
}

(async () => {
  try {
    if (sourcePaths.length !== outputDir.length) {
      throw new Error('sourcePaths和outputDir数组长度必须一致');
    }

    for (let i = 0; i < sourcePaths.length; i++) {
      const currentSource = path.resolve(sourcePaths[i]);
      const currentOutput = path.resolve(outputDir[i]);
if (!outputDir[i]) throw new Error(`outputDir[${i}] 未配置`);
      
      await fs.promises.mkdir(currentOutput, { recursive: true });
      
      const stats = await fs.promises.stat(currentSource);
      if (stats.isDirectory()) {
        await walk(currentSource, currentOutput, currentSource);
      } else {
        await processFile(currentSource, currentOutput, currentSource);
      }
    }
    console.log('✅ 所有文件处理完成');
  } catch (error) {
    console.error('❌ 主流程异常:', error);
    process.exit(1);
  }
})();