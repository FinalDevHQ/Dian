# 插件生命周期

这个页面会解释插件从加载到运行的整个过程。

## 一句话总结

Dian 启动时会自动扫描 `plugins` 文件夹，找到所有插件并加载它们。每个插件都会经历：**加载 → 设置 → 运行 → 停止** 这几个阶段。

## 生命周期图

```
Dian 启动
  ↓
扫描 plugins/ 文件夹
  ↓
找到 index.js 文件
  ↓
加载插件
  ↓
调用 onSetup() ← 你可以在这里注册指令、API 等
  ↓
插件开始运行，等待消息
  ↓
收到消息 → 匹配 Handler → 执行对应的处理函数
  ↓
Dian 关闭时调用 onStop()
```

## 每个阶段做了什么

### 1. 加载阶段

Dian 启动时会：
1. 扫描 `plugins/` 目录下的所有文件夹
2. 查找每个文件夹里的 `index.js` 文件
3. 用 `import()` 加载这个文件

**所以你构建完插件后，重启 Dian 就能看到它了。**

### 2. 设置阶段（onSetup）

加载插件后，Dian 会调用插件的 `onSetup` 方法。这是你注册各种功能的地方：

```typescript
onSetup(ctx: PluginSetupContext): void {
  // 注册指令
  ctx.command({
    name: "你好",
    pattern: "你好",
    description: "打招呼",
    handler: async (c) => {
      await c.reply("你好！");
    },
  });

  // 注册 HTTP API
  ctx.route("GET", "/status", (_req, reply) => {
    reply.send({ status: "ok" });
  });
}
```

### 3. 运行阶段

插件注册好指令后，就开始等待消息了。

当有人发消息时：
1. Dian 收到消息
2. 检查所有插件的 `@Handler` 装饰器
3. 如果消息匹配某个 Handler 的 pattern，就执行对应的处理函数

**举个例子：**

```typescript
@Handler("你好")      // 用户发送 "你好" 时触发
async onHello(ctx) {
  await ctx.reply("你好！");
}

@Handler(/^打卡/)     // 用户发送 "打卡xxx" 时触发
async onCheckIn(ctx) {
  await ctx.reply("打卡成功！");
}
```

### 4. 停止阶段（onStop）

当 Dian 关闭或插件被卸载时，会调用 `onStop` 方法。你可以在这里清理资源：

```typescript
onStop(): void {
  // 清理定时器
  clearInterval(this.timer);
  
  // 关闭连接
  this.connection.close();
}
```

**如果你的插件没有用定时器或连接，可以不写 onStop。**

## 事件处理流程

当一条消息到达时，Dian 会按以下顺序处理：

```
收到消息
  ↓
1. 执行所有拦截器（@Interceptor）
   - 按优先级排序（数字小的先执行）
   - 任何拦截器都可以调用 stopPropagation() 阻止后续处理
  ↓
2. 检查是否是帮助命令（菜单/help/帮助）
   - 如果是，自动生成帮助文本
  ↓
3. 遍历所有插件
   - 对每个插件，检查 @Handler 的 pattern
   - 如果匹配，执行处理函数
   - 如果调用了 stopPropagation()，停止遍历
```

## 热重载

Dian 支持插件热重载：修改代码后不用重启，自动重新加载。

**怎么用：**

1. 打开一个终端，在插件目录运行：
   ```bash
   npm run dev:plugin
   ```

2. 修改 `src/index.ts` 文件

3. 保存后，Dian 会自动重新加载插件

**热重载能做什么：**
- ✅ 修改消息处理逻辑
- ✅ 修改拦截器逻辑
- ✅ 修改 onSetup 里的指令注册

**热重载不能做什么：**
- ❌ 修改 @Plugin 的元信息（name、description 等）
- ❌ 新增 npm 依赖

## 下一步

现在你了解了插件的生命周期，可以继续学习：
- [装饰器](/api/decorators) — 查看所有可用的装饰器
- [EventContext](/api/event-context) — 了解事件上下文的完整 API
- [热重载](/advanced/hot-reload) — 深入了解热重载
