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
  String.raw`C:\Users\keith.luo\Desktop\replace`,
];
const outputDir = [
  String.raw`C:\Users\keith.luo\Desktop\create`,
];
const backupEnabled = false; // 是否启用备份功能
const chalk = require('chalk');
const inquirer = require('inquirer');

// 统计对象
let stats = {
  totalFiles: 0,
  processed: 0,
  success: 0,
  failed: 0,
  replacements: 0,
  startTime: Date.now()
};

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
    stats.processed++;
    const relativePath = path.relative(absSource, filePath);
    
    // 添加进度显示
    const progress = ((stats.processed / stats.totalFiles) * 100).toFixed(1);
    const elapsed = ((Date.now() - stats.startTime) / 1000).toFixed(1);
    process.stdout.write(chalk.yellow(`⌛ (已用 ${elapsed}s)\r`));

    const targetPath = path.join(outputPath, relativePath);
    
    await fs.promises.mkdir(path.dirname(targetPath), { recursive: true });
    
    const content = await fs.promises.readFile(filePath, 'utf8');
    let modified = content;
    
    config.rules.forEach(rule => {
      modified = modified.replace(new RegExp(rule.pattern, 'g'), rule.replacement);
    });
    
    await fs.promises.writeFile(targetPath, modified);
    
    // 更新替换统计
    config.rules.forEach(rule => {
      const matches = (modified.match(new RegExp(rule.pattern, 'g')) || []).length;
      stats.replacements += matches;
    });

    stats.success++;
    console.log(chalk.green(`✅ 成功处理: ${relativePath}`));
  } catch (error) {
    stats.failed++;
    console.error(chalk.red(`❌ 处理失败: ${relativePath}`), error);
    throw error;
  }
}

(async () => {
  try {
    // 交互确认
    const answer = await inquirer.prompt([{
      type: 'confirm',
      name: 'confirm',
      message: '即将开始替换操作，请确认源路径和输出路径配置正确',
      default: false
    }]);

    if (!answer.confirm) {
      console.log(chalk.yellow('⚠️  用户取消操作'));
      process.exit(0);
    }

    // 初始化统计
    stats.startTime = Date.now();
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
    // 最终统计报告
    const totalTime = ((Date.now() - stats.startTime) / 1000).toFixed(1);
    console.log(chalk.cyan('\n📊 替换统计报告:'));
    console.log(chalk.cyan(`├─ 总文件数: ${stats.totalFiles}`));
    console.log(chalk.cyan(`├─ 成功处理: ${stats.success}`));
    console.log(chalk.cyan(`├─ 失败处理: ${stats.failed}`));
    console.log(chalk.cyan(`├─ 总替换次数: ${stats.replacements}`));
    console.log(chalk.cyan(`└─ 总耗时: ${totalTime} 秒`));

  } catch (error) {
    console.error(chalk.red('❌ 主流程异常:'), error);
    process.exit(1);
  }
})();