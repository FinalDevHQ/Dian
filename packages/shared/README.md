# @myfinal/shared

[Dian](https://github.com/FinalDevHQ/Dian) 框架的共享类型定义包。

## 安装

```bash
npm install @myfinal/shared
```

## 内容

该包导出 Dian 框架各层之间共享的核心类型，所有上层模块（插件、SDK、存储等）均通过此包交互，不直接依赖协议原始字段。

### 核心类型

```ts
import type { BotEvent, EventPayload, BotEventType, Platform, ActionResult, SendActionFn } from "@myfinal/shared";
```

| 类型 | 说明 |
|------|------|
| `Platform` | 平台标识，目前为 `"onebot"` |
| `BotEventType` | 事件大类：`message` / `notice` / `request` / `meta_event` 等 |
| `BotEvent` | 统一事件对象，包含 `botId`、`type`、`subtype`、`payload`、`raw` |
| `EventPayload` | 结构化 payload，抽出 `text`、`userId`、`groupId`、`messageId`、`senderName` 等常用字段 |
| `ActionResult<T>` | Action 调用结果，包含 `ok`、`status`、`retcode`、`data` |
| `SendActionFn` | 通用 action 发送函数类型 |

## 相关包

- [`@myfinal/plugin-runtime`](https://www.npmjs.com/package/@myfinal/plugin-runtime) — 插件系统
- [`@myfinal/sdk`](https://www.npmjs.com/package/@myfinal/sdk) — OneBot 适配器
- [Dian 主仓库](https://github.com/FinalDevHQ/Dian)
