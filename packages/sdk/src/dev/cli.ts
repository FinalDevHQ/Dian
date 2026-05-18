#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import chokidar from "chokidar";
import { DianDevClient } from "./client.js";
import { packDirToBase64 } from "./zip.js";

// ── 配置读取 ────────────────────────────────────────────────────────────────────

interface DevConfig {
  wsUrl: string;
  token: string;
  pluginName: string;
  distDir: string;
  debounceMs?: number;
}

async function loadConfig(): Promise<DevConfig> {
  const pkgPath = resolve(process.cwd(), "package.json");
  let fromPkg: Partial<DevConfig> = {};
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
      fromPkg = pkg.dian?.dev ?? {};
    } catch { /* ignore */ }
  }

  const configPath = resolve(process.cwd(), "dian.config.js");
  let fromFile: Partial<DevConfig> = {};
  if (existsSync(configPath)) {
    try {
      fromFile = (await import(configPath)).default ?? {};
    } catch { /* ignore */ }
  }

  const wsUrl = process.env.DIAN_DEV_WS_URL ?? fromFile.wsUrl ?? fromPkg.wsUrl ?? "ws://localhost:3901";
  const token = process.env.DIAN_DEV_TOKEN ?? fromFile.token ?? fromPkg.token ?? "";
  const pluginName = process.env.DIAN_DEV_PLUGIN_NAME ?? fromFile.pluginName ?? fromPkg.pluginName ?? "";
  const distDir = process.env.DIAN_DEV_DIST_DIR ?? fromFile.distDir ?? fromPkg.distDir ?? "dist";
  const debounceMs = fromFile.debounceMs ?? fromPkg.debounceMs ?? 300;

  if (!token) {
    console.error("[dian-dev] token is required (set DIAN_DEV_TOKEN or configure dian.dev.token)");
    process.exit(1);
  }
  if (!pluginName) {
    console.error("[dian-dev] pluginName is required (set DIAN_DEV_PLUGIN_NAME or configure dian.dev.pluginName)");
    process.exit(1);
  }

  return { wsUrl, token, pluginName, distDir: resolve(distDir), debounceMs };
}

// ── 主逻辑 ────────────────────────────────────────────────────────────────────

async function main() {
  const config = await loadConfig();
  const { wsUrl, token, pluginName, distDir, debounceMs = 300 } = config;

  if (!existsSync(distDir)) {
    console.error(`[dian-dev] dist directory not found: ${distDir}`);
    process.exit(1);
  }

  console.info(`[dian-dev] watching ${distDir}`);
  console.info(`[dian-dev] target plugin: ${pluginName}`);
  console.info(`[dian-dev] server: ${wsUrl}`);

  const client = new DianDevClient({ wsUrl, token, pluginName });
  client.connect();

  // 防抖推送到服务器
  let timer: NodeJS.Timeout | null = null;

  const push = async () => {
    try {
      const base64 = await packDirToBase64(distDir);
      console.info(`[dian-dev] pushing ${Math.round(base64.length / 1024)}KB...`);
      client.pushBundle(base64);
    } catch (err) {
      console.error("[dian-dev] failed to pack/push:", err instanceof Error ? err.message : String(err));
    }
  };

  const debouncedPush = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(push, debounceMs);
  };

  const watcher = chokidar.watch(distDir, {
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 50 },
  });

  watcher.on("change", debouncedPush);
  watcher.on("add", debouncedPush);
  watcher.on("unlink", debouncedPush);

  const stop = () => {
    console.info("[dian-dev] shutting down...");
    watcher.close();
    client.close();
    process.exit(0);
  };

  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}

main().catch((err) => {
  console.error("[dian-dev] fatal:", err);
  process.exit(1);
});
