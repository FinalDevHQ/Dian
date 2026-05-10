/**
 * 连接测试脚本
 * 用法：node test-connection.mjs
 */

import { OneBotAdapter } from "./packages/sdk/dist/index.js";

const adapter = new OneBotAdapter({
  botId: "my-bot-001",
  mode: "hybrid",
  ws: {
    url: "ws://192.168.2.14:13001/",
    accessToken: "lxy666666.@",
    heartbeatIntervalMs: 30000,
    reconnectIntervalMs: 5000,
  },
  http: {
    baseUrl: "http://192.168.2.14:13000/",
    accessToken: "IBC39ocS1ceznq87",
    timeoutMs: 5000,
  },
});

adapter.onEvent(async (event) => {
  console.log("[事件]", JSON.stringify(event, null, 2));
});

console.log("正在连接 bot，等待事件（Ctrl+C 退出）...");
await adapter.start();
