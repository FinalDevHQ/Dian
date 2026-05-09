import pino, { type Logger as PinoLogger, type LoggerOptions } from "pino";

// ---------------------------------------------------------------------------
// 类型
// ---------------------------------------------------------------------------

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogServiceOptions {
  level?: LogLevel;
  /** 是否启用 pino-pretty 格式化（开发模式用），默认 false */
  pretty?: boolean;
  /** 日志文件输出路径，不填则只输出到 stdout */
  logFile?: string;
}

// ---------------------------------------------------------------------------
// LogService
// ---------------------------------------------------------------------------

export class LogService {
  private _logger: PinoLogger | null = null;

  /**
   * 初始化日志服务。
   * @param options 日志配置，通常由 ConfigService.settings 传入
   */
  init(options: LogServiceOptions = {}): void {
    const { level = "info", pretty = false, logFile } = options;

    const pinoOptions: LoggerOptions = { level };

    if (pretty) {
      // 开发模式：pino-pretty 格式化输出
      this._logger = pino(
        pinoOptions,
        pino.transport({ target: "pino-pretty", options: { colorize: true } }),
      );
    } else if (logFile) {
      // 生产模式：stdout + 文件双输出
      this._logger = pino(
        pinoOptions,
        pino.multistream([
          { stream: process.stdout },
          { stream: pino.destination(logFile) },
        ]),
      );
    } else {
      // 默认：纯 stdout JSON
      this._logger = pino(pinoOptions);
    }
  }

  // ── 内部工具 ──────────────────────────────────────────────────────────────

  private get logger(): PinoLogger {
    if (!this._logger) {
      throw new Error("[logger] LogService 尚未初始化，请先调用 init()");
    }
    return this._logger;
  }

  // ── 公开日志方法 ──────────────────────────────────────────────────────────

  debug(msg: string, meta?: Record<string, unknown>): void {
    meta ? this.logger.debug(meta, msg) : this.logger.debug(msg);
  }

  info(msg: string, meta?: Record<string, unknown>): void {
    meta ? this.logger.info(meta, msg) : this.logger.info(msg);
  }

  warn(msg: string, meta?: Record<string, unknown>): void {
    meta ? this.logger.warn(meta, msg) : this.logger.warn(msg);
  }

  error(msg: string, meta?: Record<string, unknown>): void {
    meta ? this.logger.error(meta, msg) : this.logger.error(msg);
  }

  // ── child logger ──────────────────────────────────────────────────────────

  /**
   * 创建带固定 context 的子 logger（如 botId、pluginName）。
   * 子 logger 的每条日志都会自动附加这些字段。
   *
   * @example
   * const botLogger = logService.child({ botId: "bot-001" });
   * botLogger.info("connected");
   */
  child(bindings: Record<string, unknown>): ChildLogger {
    return new ChildLogger(this.logger.child(bindings));
  }
}

// ---------------------------------------------------------------------------
// ChildLogger — 子 logger 包装，不暴露 pino 内部类型
// ---------------------------------------------------------------------------

export class ChildLogger {
  constructor(private readonly _logger: PinoLogger) {}

  debug(msg: string, meta?: Record<string, unknown>): void {
    meta ? this._logger.debug(meta, msg) : this._logger.debug(msg);
  }

  info(msg: string, meta?: Record<string, unknown>): void {
    meta ? this._logger.info(meta, msg) : this._logger.info(msg);
  }

  warn(msg: string, meta?: Record<string, unknown>): void {
    meta ? this._logger.warn(meta, msg) : this._logger.warn(msg);
  }

  error(msg: string, meta?: Record<string, unknown>): void {
    meta ? this._logger.error(meta, msg) : this._logger.error(msg);
  }

  child(bindings: Record<string, unknown>): ChildLogger {
    return new ChildLogger(this._logger.child(bindings));
  }
}

/** 全局单例 */
export const logService = new LogService();
