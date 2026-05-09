import { defineConfig } from "tsup";
import { cpSync, existsSync } from "node:fs";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "node20",
  outDir: "dist",
  clean: true,
  dts: false,
  sourcemap: false,
  // 将 @dian/plugin-runtime 和 reflect-metadata 打包进输出，
  // 使插件成为单一可移植的 index.js
  noExternal: ["@dian/plugin-runtime", "reflect-metadata"],
  onSuccess: async () => {
    if (existsSync("src/public")) {
      cpSync("src/public", "dist/public", { recursive: true });
      console.log("  ✓ Copied src/public → dist/public");
    }
  },
});
