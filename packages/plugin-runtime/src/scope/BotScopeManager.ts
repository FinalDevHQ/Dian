/**
 * Bot 作用域管理器：维护 插件名 → 允许响应的 botId 白名单。
 *
 * 语义：未在 map 中或集合为空 ⇒ 对**任何 bot 都不响应**（白名单默认拒绝）。
 * 装载/卸载插件不会清掉这里的配置，方便插件 reload 后保留作用域。
 */
export class BotScopeManager {
  private readonly _scopes = new Map<string, Set<string>>();

  /** 设置插件允许响应的 bot 列表。传空数组 ⇒ 任何 bot 都不响应。 */
  setPluginBots(name: string, botIds: readonly string[]): void {
    this._scopes.set(name, new Set(botIds));
  }

  /** 读取插件当前的 bot 白名单（返回数组拷贝）。 */
  getPluginBots(name: string): string[] {
    return [...(this._scopes.get(name) ?? [])];
  }

  /** 判断某个 bot 是否在指定插件的白名单内。 */
  isEnabledForBot(name: string, botId: string): boolean {
    const set = this._scopes.get(name);
    return !!set && set.has(botId);
  }

  /** 批量导入持久化的 scope 配置（启动时调用）。 */
  bulkSet(map: Record<string, readonly string[]>): void {
    for (const [name, bots] of Object.entries(map)) {
      this._scopes.set(name, new Set(bots));
    }
  }

  /** 导出当前所有 scope 配置（用于持久化）。 */
  export(): Record<string, string[]> {
    const out: Record<string, string[]> = {};
    for (const [name, set] of this._scopes) {
      out[name] = [...set];
    }
    return out;
  }
}
