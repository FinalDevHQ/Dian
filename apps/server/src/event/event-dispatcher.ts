import type { BotEvent } from "@myfinal/shared";
import type { LogService } from "@myfinal/logger";
import type { MessageRepository } from "@myfinal/storage";
import { SqlitePluginStore } from "@myfinal/storage";
import type { PluginStore } from "@myfinal/plugin-runtime";
import { pluginManager } from "@myfinal/plugin-runtime";
import type { BotService } from "../bot/bot-service.js";

/**
 * EventDispatcher — 事件路由
 *
 * 负责将来自 BotInstance 的事件分发给插件系统
 */
export class EventDispatcher {
  private readonly log: ReturnType<LogService["child"]>;
  /** 简单去重：记录最近处理过的 eventId */
  private readonly seen = new Set<string>();
  private readonly MAX_SEEN = 2000;
  private botService?: BotService;
  private messageRepo?: MessageRepository;
  private sqliteStore?: SqlitePluginStore;
  /** 已初始化的插件表 */
  private initializedTables = new Set<string>();

  constructor(logger: LogService) {
    this.log = logger.child({ component: "EventDispatcher" });
  }

  setBotService(botService: BotService): void {
    this.botService = botService;
  }

  setMessageRepository(repo: MessageRepository): void {
    this.messageRepo = repo;
  }

  setStore(store: SqlitePluginStore): void {
    this.sqliteStore = store;
  }

  /**
   * 确保插件表存在
   */
  private async ensureTable(tableName: string, columns: string[]): Promise<void> {
    if (this.initializedTables.has(tableName)) return;
    if (!this.sqliteStore) return;
    
    await this.sqliteStore.createTable(tableName, columns);
    this.initializedTables.add(tableName);
  }

  async dispatch(event: BotEvent): Promise<void> {
    // 去重
    if (this.seen.has(event.eventId)) {
      this.log.debug("Duplicate event, skipped", { eventId: event.eventId });
      return;
    }
    this.seen.add(event.eventId);
    if (this.seen.size > this.MAX_SEEN) {
      // 清掉最早加入的那批
      const iter = this.seen.values();
      for (let i = 0; i < 500; i++) this.seen.delete(iter.next().value!);
    }

    this.log.debug(
      "Dispatching event",
      { eventId: event.eventId, type: event.type, botId: event.botId }
    );

    const bot = this.botService?.getBot();

    // 构建 reply 回调：根据事件来源发送群消息或私聊消息
    const reply = async (text: string): Promise<void> => {
      if (!bot) {
        this.log.warn("reply called but bot not found", { botId: event.botId });
        return;
      }
      const { groupId, userId } = event.payload;
      const action = groupId ? "send_group_msg" : userId ? "send_private_msg" : null;
      if (!action) {
        this.log.warn("reply skipped: event has neither groupId nor userId", {
          eventId: event.eventId,
        });
        return;
      }
      const params = groupId
        ? { group_id: Number(groupId), message: text }
        : { user_id: Number(userId), message: text };

      const result = await bot.sendAction({ action, params });
      if (!result.ok) {
        // 发送失败必须显式记录，否则上层完全感知不到
        this.log.error("Failed to send reply", {
          botId: event.botId,
          action,
          params,
          status: result.status,
          retcode: result.retcode,
          message: result.message,
        });
      } else {
        this.log.debug("Reply sent", { botId: event.botId, action, params });
        // 存储机器人发送的消息，用于后续撤回
        if (this.messageRepo && result.data) {
          const replyMsgId = (result.data as { message_id?: number }).message_id;
          if (replyMsgId != null) {
            this.messageRepo.writeMessage({
              eventId: `${event.botId}:reply:${replyMsgId}`,
              botId: event.botId,
              subtype: groupId ? "group" : "private",
              groupId: groupId,
              userId: undefined,
              senderName: undefined,
              messageId: String(replyMsgId),
              text: text,
              timestamp: Math.floor(Date.now() / 1000),
            }).catch((err) => {
              this.log.error("Failed to persist reply message", { err });
            });
            
            // 同时写入插件表
            if (this.sqliteStore && groupId) {
              this.ensureTable("qq_group_admin_bot_messages", [
                "bot_id TEXT NOT NULL",
                "group_id TEXT NOT NULL",
                "message_id TEXT NOT NULL",
                "text TEXT",
                "timestamp INTEGER NOT NULL",
              ]).then(() => {
                return this.sqliteStore!.insert("qq_group_admin_bot_messages", {
                  bot_id: event.botId,
                  group_id: groupId,
                  message_id: String(replyMsgId),
                  text: text,
                  timestamp: Math.floor(Date.now() / 1000),
                });
              }).catch((err) => {
                this.log.error("Failed to persist reply to plugin table", { err });
              });
            }
          }
        }
      }
    };

    // 构建 sendAction 回调：让插件可以调用底层 API
    const sendAction = async (action: string, params?: Record<string, unknown>) => {
      if (!bot) {
        this.log.warn("sendAction called but bot not found", { botId: event.botId });
        return { ok: false, status: "failed" as const, message: "Bot not found" };
      }
      const result = await bot.sendAction({ action, params });
      
      // 存储机器人通过 sendAction 发送的消息
      if (result.ok && this.messageRepo && action === "send_group_msg" && result.data) {
        const replyMsgId = (result.data as { message_id?: number }).message_id;
        if (replyMsgId != null) {
          const groupId = params?.group_id;
          this.messageRepo.writeMessage({
            eventId: `${event.botId}:send:${replyMsgId}`,
            botId: event.botId,
            subtype: "group",
            groupId: groupId ? String(groupId) : undefined,
            userId: undefined,
            senderName: undefined,
            messageId: String(replyMsgId),
            text: typeof params?.message === "string" ? params.message : undefined,
            timestamp: Math.floor(Date.now() / 1000),
          }).catch((err) => {
            this.log.error("Failed to persist sendAction message", { err });
          });
          
          // 同时写入插件表
          if (this.sqliteStore && groupId) {
            this.ensureTable("qq_group_admin_bot_messages", [
              "bot_id TEXT NOT NULL",
              "group_id TEXT NOT NULL",
              "message_id TEXT NOT NULL",
              "text TEXT",
              "timestamp INTEGER NOT NULL",
            ]).then(() => {
              return this.sqliteStore!.insert("qq_group_admin_bot_messages", {
                bot_id: event.botId,
                group_id: String(groupId),
                message_id: String(replyMsgId),
                text: typeof params?.message === "string" ? params.message : null,
                timestamp: Math.floor(Date.now() / 1000),
              });
            }).catch((err) => {
              this.log.error("Failed to persist sendAction to plugin table", { err });
            });
          }
        }
      }
      
      return result;
    };

    try {
      // 创建带插件名作用域的 PluginStore 工厂
      // 每个插件收到的 store 会自动在 createTable 时注入 pluginName，确保 _plugin_tables 正确注册
      const storeFactory = this.sqliteStore
        ? (pluginName: string): PluginStore | undefined => {
            const raw = this.sqliteStore!;
            return {
              createTable: (tableName, columns) => raw.createTable(tableName, columns, pluginName),
              insert: (tableName, data) => raw.insert(tableName, data),
              query: (tableName, params, options) => raw.query(tableName, params, options),
              delete: (tableName, params) => raw.delete(tableName, params),
            };
          }
        : undefined;

      await pluginManager.dispatch(event, reply, sendAction, storeFactory);
    } catch (err) {
      this.log.error("Plugin dispatch error", { err, eventId: event.eventId });
    }
  }
}
