import { WebSocket } from "ws";
import type { FSWatcher } from "chokidar";

export interface DianDevClientOptions {
  wsUrl: string;
  token: string;
  pluginName: string;
}

export class DianDevClient {
  private ws: WebSocket | null = null;
  private options: DianDevClientOptions;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private backoffMs = 1000;
  private watcher: FSWatcher | null = null;
  private pendingPush = false;
  private callbacks: Map<string, Array<(data: unknown) => void>> = new Map();

  constructor(options: DianDevClientOptions) {
    this.options = options;
  }

  connect(): void {
    if (this.ws) return;
    const { wsUrl, token, pluginName } = this.options;

    console.info(`[dian-dev] connecting to ${wsUrl}...`);
    this.ws = new WebSocket(wsUrl);

    this.ws.on("open", () => {
      console.info("[dian-dev] connected, sending auth...");
      this.backoffMs = 1000;
      this.send({ type: "auth", token, pluginName });
    });

    this.ws.on("message", (raw) => {
      let data: unknown;
      try {
        data = JSON.parse(String(raw));
      } catch {
        return;
      }
      const d = data as Record<string, unknown>;
      const type = String(d?.type ?? "");

      switch (type) {
        case "auth-result":
          if (d.ok) {
            console.info("[dian-dev] auth ok, waiting for file changes...");
          } else {
            console.error("[dian-dev] auth failed:", d.message);
            this.close();
          }
          break;
        case "bundle-accepted":
          console.info("[dian-dev] bundle accepted by server");
          break;
        case "reload-complete":
          console.info("[dian-dev] server reloaded successfully");
          this.emit("reload-complete", d);
          break;
        case "reload-error":
          console.error("[dian-dev] server reload error:", d.message);
          this.emit("reload-error", d);
          break;
        case "error":
          console.error("[dian-dev] server error:", d.message);
          break;
      }
    });

    this.ws.on("close", (code) => {
      console.warn(`[dian-dev] connection closed (code=${code})`);
      this.ws = null;
      this.scheduleReconnect();
    });

    this.ws.on("error", (err) => {
      console.error("[dian-dev] ws error:", err.message);
    });
  }

  pushBundle(base64Zip: string): void {
    if (!this.ws || this.ws.readyState !== 1) {
      console.warn("[dian-dev] not connected, skip push");
      return;
    }
    this.send({
      type: "push-bundle",
      pluginName: this.options.pluginName,
      bundle: base64Zip,
    });
  }

  on(event: "reload-complete" | "reload-error", cb: (data: unknown) => void): void {
    if (!this.callbacks.has(event)) this.callbacks.set(event, []);
    this.callbacks.get(event)!.push(cb);
  }

  private emit(event: string, data: unknown): void {
    this.callbacks.get(event)?.forEach((cb) => cb(data));
  }

  private send(data: Record<string, unknown>): void {
    if (this.ws && this.ws.readyState === 1) {
      this.ws.send(JSON.stringify(data));
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, this.backoffMs);
    this.backoffMs = Math.min(this.backoffMs * 2, 30000);
  }

  close(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.watcher?.close();
    this.watcher = null;
    this.ws?.close();
    this.ws = null;
  }
}
