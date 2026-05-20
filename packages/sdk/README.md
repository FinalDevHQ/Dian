# @myfinal/sdk

[Dian](https://github.com/FinalDevHQ/Dian) 框架的 OneBot 适配器，提供 WebSocket 和 HTTP 双向通信支持，以及插件开发者模式 CLI（`dian-dev`）。

## 安装

```bash
npm install @myfinal/sdk
```

## OneBot 适配器

```ts
import { OneBotAdapter } from "@myfinal/sdk";

const adapter = new OneBotAdapter({
  botId: "my-bot",
  ws: {
    url: "ws://localhost:3001/",
    accessToken: "",
  },
  http: {
    baseUrl: "http://localhost:3000/",
    accessToken: "",
  },
});

adapter.on("event", (event) => {
  console.log(event.type, event.payload.text);
});

await adapter.connect();

// 调用 OneBot API
const result = await adapter.sendAction("send_group_msg", {
  group_id: 123456,
  message: "Hello!",
});
```

## 连接模式

| 模式 | 说明 |
|------|------|
| `ws` | 仅 WebSocket（接收事件 + 发送 action） |
| `http` | 仅 HTTP（发送 action，通过反向 HTTP 接收事件） |
| `hybrid` | WebSocket 接收事件 + HTTP 发送 action（推荐） |

## `dian-dev` CLI（开发者模式）

在插件开发时，可使用 `dian-dev` CLI 将本地编译产物实时推送到运行中的 Dian 实例，无需手动打包上传。

```bash
# 在插件目录中启动开发者模式
npx dian-dev
```

配置文件 `dev.config.mjs`：

```js
export default {
  serverUrl: "http://localhost:3000",
  token: "your-jwt-token",
  pluginName: "my-plugin",
  watchDir: "./dist",
};
```

## 相关包

- [`@myfinal/shared`](https://www.npmjs.com/package/@myfinal/shared) — 共享类型
- [Dian 主仓库](https://github.com/FinalDevHQ/Dian)
- [插件模板](https://github.com/FinalDevHQ/Dian-plugin-template)
