/**
 * 将 dist/ 目录打包为可安装的 ZIP 文件（使用 PowerShell Compress-Archive）。
 * 用法：node scripts/pack.mjs
 */
import { execSync } from "node:child_process";
import { readFileSync, existsSync, unlinkSync } from "node:fs";

const pkg = JSON.parse(readFileSync("./package.json", "utf8"));
const pluginName = pkg.name;
const zipFile = `${pluginName}.zip`;

if (existsSync(zipFile)) unlinkSync(zipFile);

try {
  execSync(
    `powershell -NoProfile -Command "Compress-Archive -Path 'dist\\*' -DestinationPath '${zipFile}'"`,
    { stdio: "inherit" }
  );
} catch {
  console.error("打包失败，请确认已安装 PowerShell 并完成 build。");
  process.exit(1);
}

console.log(`\n✓  打包完成：${zipFile}`);
console.log(`\n安装方法：`);
console.log(`  1. 将 ${zipFile} 解压到 Dian 项目的 plugins/${pluginName}/ 目录`);
console.log(`  2. 重启 Dian 服务，或等待热重载生效\n`);
