# 热重载

热重载就是修改代码后不用重启 Dian，插件自动更新。这是开发插件时最常用的功能。

## 怎么用

### 第一步：打开两个终端

**终端 1：启动 Dian**

```bash
npm run start
```

**终端 2：进入插件目录，启动开发模式**

```bash
cd plugins/your-plugin
npm run dev:plugin
```

### 第二步：修改代码

打开 `src/index.ts`，随便改点什么，比如：

```typescript
// 原来
await ctx.reply("你好！");

// 改成
await ctx.reply("你好！欢迎使用！");
```

### 第三步：保存文件

保存后，终端 2 会显示：

```
build complete in 0.5s
```

然后你的 Dian 会自动重新加载插件，新代码立即生效！

## 热重载能做什么

### ✅ 可以热重载

- 修改消息处理逻辑
- 修改拦截器逻辑
- 修改 onSetup 里的指令注册
- 修改 HTTP API 路由

### ❌ 不能热重载

- 修改 `@Plugin` 的元信息（name、description 等）
- 新增 npm 依赖
- 修改 package.json

**如果改了这些，需要重启 Dian。**

## 最佳实践

### 1. 使用动态 Pattern

让配置修改后立即生效：

```typescript
// ✅ 好：配置改了立即生效
ctx.command({
  pattern: () => this.config.command,  // 动态获取
  // ...
});

// ❌ 不好：配置改了需要重启
@Handler("!hello")  // 写死了
async onHello(ctx) {
  // ...
}
```

### 2. 清理资源

插件卸载时要清理资源，避免内存泄漏：

```typescript
@Plugin({ name: "my-plugin" })
export default class MyPlugin {
  private timer?: NodeJS.Timeout;
  private connection?: WebSocket;

  onSetup(ctx: PluginSetupContext): void {
    this.timer = setInterval(() => { /* ... */ }, 1000);
    this.connection = new WebSocket("ws://...");
  }

  // 插件卸载时会调用这个方法
  onStop(): void {
    if (this.timer) clearInterval(this.timer);
    if (this.connection) this.connection.close();
  }
}
```

### 3. 避免全局变量

热重载会重新加载模块，全局变量会丢失：

```typescript
// ❌ 不好：热重载后状态丢失
let globalState = {};

@Plugin({ name: "my-plugin" })
export default class MyPlugin {
  // ...
}

// ✅ 好：状态在实例里，热重载不会丢
@Plugin({ name: "my-plugin" })
export default class MyPlugin {
  private state = {};  // 实例属性
  // ...
}
```

## 遇到问题？

### 热重载不生效？

1. 检查文件路径对不对
2. 检查文件名是不是 `index.js`
3. 看终端有没有报错
4. 试试重启 Dian

### 插件状态丢了？

热重载会重新创建插件实例，所以内存里的状态会丢失。如果需要持久化，用 [PluginStore](/api/plugin-store) 存到数据库。

## 下一步

- [开发 CLI](/advanced/dev-cli) — 从远程开发机同步代码
- [Bot Scope](/advanced/bot-scope) — 控制插件在哪些机器人上运行
