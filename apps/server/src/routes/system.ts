import os from "node:os";
import type { FastifyInstance } from "fastify";
import type { LogService } from "@dian/logger";

/**
 * GET /system —— 仪表盘的系统信息端点
 *
 * 返回 OS、CPU、内存、Node 进程等运行时指标。
 * CPU 利用率通过对 os.cpus() 做一次短间隔差分采样得到。
 */
export async function systemRoutes(
  app: FastifyInstance,
  _opts: { logger: LogService }
): Promise<void> {
  app.get("/system", async (_req, reply) => {
    const cpuUsage = await sampleCpuUsage(150);
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const cpus = os.cpus();
    const proc = process.memoryUsage();

    return reply.send({
      ts: Date.now(),
      os: {
        platform: process.platform,
        type: os.type(),
        release: os.release(),
        arch: process.arch,
        hostname: os.hostname(),
        uptimeSec: Math.floor(os.uptime()),
      },
      node: {
        version: process.version,
        pid: process.pid,
        uptimeSec: Math.floor(process.uptime()),
        cwd: process.cwd(),
      },
      cpu: {
        model: cpus[0]?.model ?? "unknown",
        cores: cpus.length,
        speedMHz: cpus[0]?.speed ?? 0,
        usagePercent: cpuUsage, // 0..100，整体平均
        loadAvg: os.loadavg(),  // [1m, 5m, 15m]，Windows 上恒为 0
      },
      memory: {
        totalBytes: totalMem,
        freeBytes: freeMem,
        usedBytes: totalMem - freeMem,
        usagePercent: totalMem > 0 ? ((totalMem - freeMem) / totalMem) * 100 : 0,
        process: {
          rssBytes: proc.rss,
          heapUsedBytes: proc.heapUsed,
          heapTotalBytes: proc.heapTotal,
          externalBytes: proc.external,
        },
      },
    });
  });
}

// ───────────────────────────────────────────────────────────────────────────

interface CpuTimes {
  idle: number;
  total: number;
}

function snapshotCpu(): CpuTimes {
  let idle = 0;
  let total = 0;
  for (const c of os.cpus()) {
    const t = c.times;
    idle += t.idle;
    total += t.user + t.nice + t.sys + t.idle + t.irq;
  }
  return { idle, total };
}

/** 采样 CPU 利用率（百分比 0..100），间隔 ~delayMs */
async function sampleCpuUsage(delayMs: number): Promise<number> {
  const a = snapshotCpu();
  await new Promise<void>((r) => setTimeout(r, delayMs));
  const b = snapshotCpu();
  const idleDelta = b.idle - a.idle;
  const totalDelta = b.total - a.total;
  if (totalDelta <= 0) return 0;
  const usage = 1 - idleDelta / totalDelta;
  return Math.max(0, Math.min(100, usage * 100));
}
