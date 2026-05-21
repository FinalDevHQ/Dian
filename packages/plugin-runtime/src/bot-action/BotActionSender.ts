/**
 * Bot 管理器的接口（plugin-runtime 只依赖这个最小接口，不耦合 server 层的 BotManager）。
 */
export interface BotManager {
  getBots(): BotInstance[];
}

export interface BotInstance {
  botId: string;
  sendAction<TData = unknown>(request: {
    action: string;
    params?: Record<string, unknown>;
  }): Promise<ActionResult>;
}

export interface ActionResult {
  ok: boolean;
  status: string;
  message?: string;
  data?: unknown;
}

/**
 * Bot Action 发送器。
 * 持有 BotManager 引用，提供 sendBotAction 方法供插件调用。
 */
export class BotActionSender {
  private _botManager: BotManager | null = null;

  setBotManager(botManager: BotManager): void {
    this._botManager = botManager;
  }

  async sendBotAction(
    action: string,
    params?: Record<string, unknown>,
  ): Promise<ActionResult> {
    if (!this._botManager) {
      return { ok: false, status: "failed", message: "BotManager not initialized" };
    }
    const bots = this._botManager.getBots();
    if (bots.length === 0) {
      return { ok: false, status: "failed", message: "No bots available" };
    }
    return bots[0].sendAction({ action, params });
  }
}
