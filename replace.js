/*
 * @Description:
 * @Author: luokang
 * @Date: 2025-03-05 10:34:20
 */
const fs = require('fs');
const path = require('path');
const { Transform, pipeline } = require('stream');
// 加载替换规则配置
const config = require('./replace-config.json');

// 配置参数
const sourcePaths = [
  path.normalize(String.raw`D:\gitProject\国内jms\jms-web-financialreportweb\src\views\financial-management\invoice-platform`),
  path.normalize(String.raw`D:\gitProject\国内jms\jms-web-financialreportweb\src\views\financial-management\billing-platform`),
];
// 输出目录
const outputDir = [
  path.normalize(String.raw`D:\gitProject\国内jms\yl-jms-wd-smartdevice-front\src\views\moduan-management\invoice-platform`),
  path.normalize(String.raw`D:\gitProject\国内jms\yl-jms-wd-smartdevice-front\src\views\moduan-management\billing-platform`),
];
const backupEnabled = false; // 是否启用备份功能
const chalk = require('chalk');
const inquirer = require('inquirer');
const diff = require('diff');

// 统计对象
let stats = {
  totalFiles: 0,
  processed: 0,
  success: 0,
  failed: 0,
  replacements: 0,
  startTime: Date.now(),
  answer: null
};

// 移除重复的processFile函数定义

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
    console.error(chalk.red(`🚨 遍历目录失败 [${dir}]:`), error.message);
    throw error;
  }
}

async function countTotalFiles(paths) {
  let count = 0;
  for (const p of paths) {
    const stats = await fs.promises.stat(p);
    if (stats.isDirectory()) {
      const files = await fs.promises.readdir(p, { recursive: true });
      count += files.length;
    } else {
      count++;
    }
  }
  return count;
}

async function processFile(filePath, outputPath, absSource) {
  try {
    stats.processed++;
    const relativePath = path.relative(absSource, filePath);
    
    // 流式处理（统一变量声明）
    const targetPath = path.join(outputPath, relativePath);
    const readStream = fs.createReadStream(filePath, { highWaterMark: 64 * 1024 });
    const writeStream = fs.createWriteStream(targetPath);
    const transformStream = new Transform({
      transform(chunk, encoding, callback) {
        let modified = chunk.toString();
        config.rules.forEach(rule => {
          const escapedPattern = escapeRegExp(rule.pattern);
          modified = modified.replace(new RegExp(escapedPattern, 'g'), (match) => {
            stats.replacements++;
            return rule.replacement;
          });
        });
        this.push(modified);
        callback();
      }
    });

    await new Promise((resolve, reject) => {
      pipeline(
        readStream,
        transformStream,
        writeStream,
        async (err) => {
          if (err) {
            reject(err);
          } else {
            // 差异对比逻辑
            if (stats.answer.preview) {
              const originalContent = await fs.promises.readFile(filePath, 'utf8');
              const modifiedContent = await fs.promises.readFile(targetPath, 'utf8');
              console.log(chalk.yellow(`\n🔍 差异预览：${relativePath}`));
              await showDiffPreview(originalContent, modifiedContent);
            }
            resolve();
          }
        }
      );
    });
    stats.success++;
    
    // 更新文件总数统计
    if (!stats.totalFiles) {
      stats.totalFiles = await countTotalFiles(sourcePaths);
    }
    
    // 添加进度显示
    const progress = ((stats.processed / stats.totalFiles) * 100).toFixed(1);
    const elapsed = ((Date.now() - stats.startTime) / 1000).toFixed(1);
    process.stdout.write(chalk.yellow(`⌛ (已用 ${elapsed}s)\r`));

    // 移除重复的文件处理逻辑，保留流式处理结果
    console.log(chalk.green(`✅ 成功处理: ${relativePath}`));
  } catch (error) {
    stats.failed++;
    console.error(chalk.red(`❌ 处理失败 [${filePath}] -> [${outputPath}]:`), error.message);
    console.error(error.stack);
    throw error;
  }
}

async function showDiffPreview(original, modified) {
  const contextLines = 10;
  const differences = diff.diffLines(original, modified, { newlineIsToken: true });
  
  let outputBuffer = [];
  let changeBlocks = [];

  differences.forEach((part, index) => {
    const lines = part.value.split('\n');
    if (part.added || part.removed) {
      const start = outputBuffer.length;
      lines.forEach(line => {
        const marker = part.added ? '▶ ' : '◀ ';
        outputBuffer.push({ line: marker + line, type: part.added ? 'added' : 'removed' });
      });
      const end = outputBuffer.length - 1;
      changeBlocks.push({ start, end });
    } else {
      lines.forEach(line => outputBuffer.push({ line, type: 'context' }));
    }
  });

  // 生成带上下文的预览
  const previewLines = [];
  // 合并所有变更块的上下文
  const contextRange = 3;
  let mergedRanges = [];
  
  changeBlocks.forEach(block => {
    const blockStart = Math.max(0, block.start - contextRange);
    const blockEnd = Math.min(outputBuffer.length, block.end + contextRange + 1);
    mergedRanges.push({ start: blockStart, end: blockEnd });
  });

  // 合并重叠的区间
  if (mergedRanges.length > 0) {
    mergedRanges.sort((a, b) => a.start - b.start);
    
    let current = mergedRanges[0];
    const result = [current];
    
    for (let i = 1; i < mergedRanges.length; i++) {
      if (mergedRanges[i].start <= current.end) {
        current.end = Math.max(current.end, mergedRanges[i].end);
      } else {
        current = mergedRanges[i];
        result.push(current);
      }
    }
    
    result.forEach(range => {
      if (range.start > 0) previewLines.push(chalk.gray('...'));
      
      outputBuffer.slice(range.start, range.end).forEach((item, idx) => {
        const lineNum = range.start + idx + 1;
        const color = item.type === 'added' ? chalk.green.bold 
                     : item.type === 'removed' ? chalk.red.strikethrough 
                     : chalk.gray;
        previewLines.push(color(`${lineNum.toString().padStart(4)}: ${item.line}`));
      });
      
      if (range.end < outputBuffer.length) previewLines.push(chalk.gray('...'));
    });
  }
  
  // 添加交互选项
  const { showFullDiff } = await inquirer.prompt([{
    type: 'confirm',
    name: 'showFullDiff',
    message: '是否查看完整差异？',
    default: false,
    when: (answers) => answers.preview
  }]);

  if (showFullDiff) {
    console.log('\n完整差异：');
    differences.forEach(part => {
      const color = part.added ? chalk.green.bold : part.removed ? chalk.red.strikethrough : chalk.gray;
      console.log(color(part.value));
    });
  } else {
    console.log(previewLines.join('\n'));
  }
}

// 强制启用chalk颜色支持
chalk.level = 3;

(async () => {
  try {
    // 增强交互确认
    stats.answer = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'preview',
        message: '是否要预览替换差异？',
        default: true
      }
    ]);

    // 初始化统计
    stats.startTime = Date.now();
    if (sourcePaths.length !== outputDir.length) {
      throw new Error('sourcePaths和outputDir数组长度必须一致');
    }

    for (let i = 0; i < sourcePaths.length; i++) {
      const currentSource = path.resolve(
        sourcePaths[i].replace(/[\\/]+/g, path.sep)
      );
      const currentOutput = path.resolve(
        outputDir[i].replace(/[\\/]+/g, path.sep)
      );
      if (!outputDir[i]) throw new Error(`outputDir[${i}] 未配置`);

      await fs.promises.mkdir(currentOutput, { recursive: true });

      const sourceStat = await fs.promises.stat(currentSource);
      if (sourceStat.isDirectory()) {
        await walk(currentSource, currentOutput, currentSource);
      } else {
        // 处理单个文件时，使用源文件所在目录作为基准路径
        const absSourceDir = path.dirname(currentSource);
        await fs.promises.mkdir(path.dirname(currentOutput), { recursive: true });
        await processFile(currentSource, currentOutput, absSourceDir);
        stats.totalFiles = 1; // 更新文件总数统计
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

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
