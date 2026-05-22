import type { Module } from "../types.js";
import { isModule } from "../types.js";

/**
 * ModuleManager — 模块生命周期管理
 */
export class ModuleManager {
  /** 已注册的模块，按注册顺序存储（teardown 时逆序） */
  private readonly _modules: Module[] = [];

  /**
   * 手动注册一个模块（用于程序化注册，不通过目录扫描）。
   */
  register(mod: Module): void {
    if (this._modules.find((m) => m.name === mod.name)) {
      throw new Error(`[module-runtime] 模块 "${mod.name}" 已注册，不可重复注册`);
    }
    this._modules.push(mod);
  }

  /**
   * 从目录扫描并启动所有模块。
   *
   * 约定：目录下每个子目录或 .js 文件默认导出一个实现 Module 接口的对象。
   *
   * @param modulesDir 模块目录绝对路径
   */
  async discoverAndStart(modulesDir: string): Promise<void> {
    const { readdir } = await import("node:fs/promises");
    const { resolve, extname } = await import("node:path");

    let entries: string[];
    try {
      entries = await readdir(modulesDir);
    } catch {
      // 目录不存在时跳过，不报错
      return;
    }

    for (const entry of entries) {
      const fullPath = resolve(modulesDir, entry);
      const ext = extname(entry);

      // 只处理 .js 文件和无扩展名目录（目录化模块）
      if (ext !== ".js" && ext !== "") continue;

      let mod: unknown;
      try {
        const imported = (await import(fullPath)) as Record<string, unknown>;
        mod = imported.default;
      } catch (err) {
        console.error(`[module-runtime] 加载模块失败 "${entry}":`, err);
        continue;
      }

      if (!isModule(mod)) {
        console.warn(`[module-runtime] "${entry}" 未导出合法的 Module，已跳过`);
        continue;
      }

      try {
        this.register(mod);
        await mod.setup();
        console.info(`[module-runtime] 模块 "${mod.name}" 已启动`);
      } catch (err) {
        console.error(`[module-runtime] 模块 "${mod.name}" setup 失败:`, err);
      }
    }
  }

  /**
   * 按注册逆序调用所有模块的 teardown()。
   */
  async stopAll(): Promise<void> {
    const reversed = [...this._modules].reverse();
    for (const mod of reversed) {
      try {
        await mod.teardown();
        console.info(`[module-runtime] 模块 "${mod.name}" 已停止`);
      } catch (err) {
        console.error(`[module-runtime] 模块 "${mod.name}" teardown 失败:`, err);
      }
    }
  }

  /** 获取所有已注册模块列表（只读） */
  get modules(): readonly Module[] {
    return this._modules;
  }
}

// ---------------------------------------------------------------------------
// 全局单例
// ---------------------------------------------------------------------------

import { HookBus } from "../hookbus/HookBus.js";

export const hookBus = new HookBus();
export const moduleManager = new ModuleManager();
