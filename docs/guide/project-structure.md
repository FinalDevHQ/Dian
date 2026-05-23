# 项目结构

这个页面会解释插件项目里每个文件的作用。

## 一个插件长什么样？

```
hello-plugin/
├── src/
│   └── index.ts          # 插件代码写在这里（最重要！）
├── dist/
│   └── index.js          # 构建后生成的文件（自动产生，不用管）
├── package.json          # 项目配置
├── tsconfig.json         # TypeScript 配置
└── tsup.config.ts        # 构建配置（一般不用改）
```

你只需要关心 `src/index.ts`，其他文件基本不用动。

## src/index.ts 详解

打开 `src/index.ts`，它看起来像这样：

```typescript
import "reflect-metadata";  // 装饰器需要的，必须保留
import {
  Plugin,                    // 插件装饰器
  Handler,                   // 消息处理器装饰器
  type EventContext,         // 事件上下文类型
} from "@myfinal/plugin-runtime";

// 这里定义插件的基本信息
@Plugin({
  name: "hello-plugin",      // 插件名字（英文小写加横杠）
  description: "我的插件",   // 描述
  version: "1.0.0",          // 版本
  author: "你的名字",        // 作者
  icon: "👋",               // 图标
})
export default class HelloPlugin {

  // 这是一个消息处理器
  // 当用户发送 "你好" 时，这个方法会被调用
  @Handler("你好")
  async onHello(ctx: EventContext): Promise<void> {
    await ctx.reply("你好！");  // 回复消息
  }

  // onSetup 方法在插件加载时执行
  // 可以在这里注册更多指令、API、UI 等
  onSetup(ctx: PluginSetupContext): void {
    // 注册一个指令
    ctx.command({
      name: "帮助",
      pattern: "帮助",
      description: "显示帮助信息",
      handler: async (c: EventContext) => {
        await c.reply("可用指令：你好、帮助");
      },
    });
  }
}
```

## 关键概念

### 装饰器是什么？

装饰器就是那些 `@` 开头的东西，比如 `@Plugin`、`@Handler`。

你可以把它们理解成"标签"：
- `@Plugin` 标记这个类是一个 Dian 插件
- `@Handler` 标记这个方法是用来处理消息的

### EventContext 是什么？

每个消息处理器都会收到一个 `ctx` 参数，它包含了当前消息的所有信息：

```typescript
@Handler("你好")
async onHello(ctx: EventContext): Promise<void> {
  // 用户发的消息文本
  console.log(ctx.event.payload.text);  // "你好"
  
  // 用户 ID
  console.log(ctx.event.payload.userId);  // "123456"
  
  // 群 ID（如果是群消息）
  console.log(ctx.event.payload.groupId);  // "789012"
  
  // 回复消息
  await ctx.reply("收到！");
}
```

### onSetup 是什么？

`onSetup` 是插件加载时执行的方法，可以在这里：
- 注册指令（`ctx.command`）
- 注册 HTTP API（`ctx.route`）
- 声明 Web UI（`ctx.ui`）
- 声明数据库（`ctx.datasource`）

## package.json 说明

```json
{
  "name": "hello-plugin",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "build": "tsup",           // 构建插件
    "dev:plugin": "tsup --watch"  // 开发模式（自动重新构建）
  },
  "dependencies": {
    "@myfinal/plugin-runtime": "^0.2.5",  // 插件运行时
    "@myfinal/shared": "^0.2.3",          // 共享类型
    "reflect-metadata": "^0.2.2"          // 装饰器支持
  }
}
```

## tsup.config.ts 说明

这个文件定义了怎么把你的代码打包成一个文件。一般不用改，除非你需要：

- 把某些依赖打进插件包
- 修改输出目录
- 其他高级配置

## 下一步

现在你了解了插件的基本结构，可以继续学习：
- [插件生命周期](/guide/plugin-lifecycle) — 了解插件是怎么加载和运行的
- [装饰器](/api/decorators) — 查看所有可用的装饰器
