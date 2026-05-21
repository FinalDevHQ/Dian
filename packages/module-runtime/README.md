# @myfinal/module-runtime

[Dian](https://github.com/FinalDevHQ/Dian) 框架的模块生命周期管理，提供 `Module` 接口和 `HookBus` 广播/管道机制。

## 安装

```bash
npm install @myfinal/module-runtime
```

## 使用

### Module 接口

```ts
import type { Module } from "@myfinal/module-runtime";

class MyModule implements Module {
  readonly name = "my-module";

  async setup() {
    // 启动逻辑
  }

  async teardown() {
    // 清理逻辑
  }
}
```

### HookBus

```ts
import { HookBus } from "@myfinal/module-runtime";

const bus = new HookBus();

// 广播模型：并发触发所有 handler
bus.register("bot:ready", async (botId) => {
  console.log(`Bot ${botId} 已就绪`);
});
await bus.broadcast("bot:ready", "my-bot");

// 管道模型：顺序传递，每个 handler 可修改值
bus.register("message:filter", async (text) => text.trim());
const result = await bus.pipe("message:filter", "  hello  ");
// result => "hello"
```

## API

### `Module` 接口

| 方法 | 说明 |
|------|------|
| `setup()` | 模块启动，由 `ModuleManager` 调用 |
| `teardown()` | 模块停止，由 `ModuleManager` 调用 |

### `HookBus`

| 方法 | 说明 |
|------|------|
| `register(hook, handler)` | 注册 hook handler |
| `unregister(hook, handler)` | 注销 hook handler |
| `broadcast(hook, ...args)` | 并发触发所有 handler（fire-and-forget） |
| `pipe(hook, value)` | 顺序管道，每个 handler 接收并返回修改后的值 |

## 相关包

- [Dian 主仓库](https://github.com/FinalDevHQ/Dian)
