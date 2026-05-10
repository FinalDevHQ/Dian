import { ChildLogger, type LogService } from "@dian/logger";
import type { LogEntry, LogRepository } from "@dian/storage";

type Level = LogEntry["level"];
const LEVELS: Level[] = ["debug", "info", "warn", "error"];

function pickBotId(meta?: Record<string, unknown>): string {
  if (!meta) return "system";
  const v = meta.bot ?? meta.botId;
  return typeof v === "string" ? v : "system";
}

function safeWrite(repo: LogRepository, entry: LogEntry): void {
  // 不阻塞调用方；写入失败时打到 stderr，避免循环依赖再调 logger
  repo.write(entry).catch((err) => {
    process.stderr.write(
      `[log-bridge] failed to persist log: ${(err as Error).message}\n`
    );
  });
}

/**
 * 把 LogService / ChildLogger 的 4 个级别方法"装饰"一下，
 * 在原有控制台输出之外再镜像写入到 LogRepository（sqlite logs 表）。
 *
 * 设计取舍：
 * - 不改 @dian/logger 公共 API（向后兼容）
 * - patch 实例 + 类原型，已创建和未来创建的 child logger 都生效
 * - 通过 meta.bot / meta.botId 字段提取 botId；缺省时为 "system"
 *
 * @returns 卸载函数，用于优雅关停时还原（非必须，进程退出时无所谓）
 */
export function installLogPersistence(
  logger: LogService,
  repo: LogRepository
): () => void {
  // 保存原始函数以便卸载
  const origLs: Partial<Record<Level, LogService[Level]>> = {};
  const origChild: Partial<Record<Level, ChildLogger[Level]>> = {};

  for (const level of LEVELS) {
    // ── LogService 实例方法（绑定 this）──
    origLs[level] = logger[level].bind(logger);
    logger[level] = (msg: string, meta?: Record<string, unknown>) => {
      origLs[level]!(msg, meta);
      safeWrite(repo, {
        botId: pickBotId(meta),
        level,
        message: msg,
        meta,
      });
    };

    // ── ChildLogger 原型方法（影响所有实例）──
    origChild[level] = ChildLogger.prototype[level];
    ChildLogger.prototype[level] = function (
      this: ChildLogger,
      msg: string,
      meta?: Record<string, unknown>
    ) {
      origChild[level]!.call(this, msg, meta);
      safeWrite(repo, {
        botId: pickBotId(meta),
        level,
        message: msg,
        meta,
      });
    };
  }

  return () => {
    for (const level of LEVELS) {
      if (origLs[level]) logger[level] = origLs[level]!;
      if (origChild[level]) ChildLogger.prototype[level] = origChild[level]!;
    }
  };
}
