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
console.log(`安装方法：`);
console.log(`  - 推荐：在 Dian Web UI「插件」页点「上传插件」选择 ${zipFile}，框架会自动热加载，无需重启`);
console.log(`  - 或手动：将 ${zipFile} 解压到 Dian 项目的 plugins/${pluginName}/ 目录，文件监听会自动识别新插件\n`);
