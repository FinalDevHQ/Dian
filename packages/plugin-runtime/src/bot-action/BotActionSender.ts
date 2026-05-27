/**
 * Bot 服务的接口（plugin-runtime 只依赖这个最小接口，不耦合 server 层的 BotService）。
 */
export interface BotService {
  getBot(): BotInstance | undefined;
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
 * 持有 BotService 引用，提供 sendBotAction 方法供插件调用。
 */
export class BotActionSender {
  private _botService: BotService | null = null;

  setBotService(botService: BotService): void {
    this._botService = botService;
  }

  async sendBotAction(
    action: string,
    params?: Record<string, unknown>,
  ): Promise<ActionResult> {
    if (!this._botService) {
      return { ok: false, status: "failed", message: "BotService not initialized" };
    }
    const bot = this._botService.getBot();
    if (!bot) {
      return { ok: false, status: "failed", message: "No bot available" };
    }
    return bot.sendAction({ action, params });
  }
}
