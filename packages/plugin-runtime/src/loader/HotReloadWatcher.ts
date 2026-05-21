import { extname, relative, sep } from "node:path";
import chokidar, { type FSWatcher } from "chokidar";

export interface HotReloadCallbacks {
  /** 文件变更时触发（已确认是插件入口文件） */
  onChange: (filePath: string) => void;
  /** 新文件添加时触发 */
  onAdd: (filePath: string) => void;
  /** 文件删除时触发 */
  onUnlink: (filePath: string) => void;
  /** 安装锁状态查询（解压期间不触发 reload） */
  isInstallLocked: () => boolean;
}

/**
 * 文件监听热重载：监听插件目录变化，触发回调。
 * 不直接耦合 PluginManager，通过回调解耦。
 */
export class HotReloadWatcher {
  private _watcher: FSWatcher | null = null;
  private _pluginsDir: string | null = null;

  get isWatching(): boolean {
    return this._watcher !== null;
  }

  get pluginsDir(): string | null {
    return this._pluginsDir;
  }

  /** 开始监听指定目录。 */
  watch(pluginsDir: string, callbacks: HotReloadCallbacks): void {
    if (this._watcher) return;
    this._pluginsDir = pluginsDir;

    this._watcher = chokidar.watch(pluginsDir, {
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 300, pollInterval: 50 },
    });

    const isPluginEntry = (filePath: string): boolean => {
      if (extname(filePath) !== ".js") return false;
      const rel = relative(pluginsDir, filePath);
      const parts = rel.split(sep);
      return parts.length === 1 || (parts.length === 2 && parts[1] === "index.js");
    };

    this._watcher.on("change", (filePath: string) => {
      if (callbacks.isInstallLocked()) return;
      if (!isPluginEntry(filePath)) return;
      callbacks.onChange(filePath);
    });

    this._watcher.on("add", (filePath: string) => {
      if (callbacks.isInstallLocked()) return;
      if (!isPluginEntry(filePath)) return;
      callbacks.onAdd(filePath);
    });

    this._watcher.on("unlink", (filePath: string) => {
      if (callbacks.isInstallLocked()) return;
      callbacks.onUnlink(filePath);
    });
  }

  /** 停止监听。 */
  async unwatch(): Promise<void> {
    if (this._watcher) {
      await this._watcher.close();
      this._watcher = null;
    }
  }
}
