# EventContext

每个消息处理器都会收到一个 `ctx` 参数，它的类型就是 `EventContext`。它包含了当前消息的所有信息和操作方法。

## 快速上手

```typescript
@Handler("你好")
async onHello(ctx: EventContext): Promise<void> {
  // 获取消息文本
  const text = ctx.event.payload.text;  // "你好"
  
  // 获取用户 ID
  const userId = ctx.event.payload.userId;  // "123456"
  
  // 回复消息
  await ctx.reply("你好！");
}
```

## 核心属性

### ctx.event

当前事件的完整信息。

```typescript
ctx.event = {
  eventId: "123456:789",     // 事件唯一 ID
  botId: "bot-1",            // 机器人 ID
  platform: "onebot",        // 平台（目前只有 "onebot"）
  type: "message",           // 事件类型
  subtype: "message.group",  // 子类型
  timestamp: 1234567890,     // 时间戳（秒）
  payload: { ... },          // 消息内容
  raw: { ... },              // 原始数据
}
```

### ctx.event.payload

消息的核心数据，最常用的字段：

| 字段 | 类型 | 说明 |
|------|------|------|
| `text` | `string` | 消息文本 |
| `userId` | `string` | 发送者 ID |
| `groupId` | `string` | 群 ID（群消息才有） |
| `messageId` | `string` | 消息 ID |
| `senderName` | `string` | 发送者昵称 |

## 核心方法

### ctx.reply()

向消息来源发送文本回复。

```typescript
// 回复文本
await ctx.reply("你好！");

// 回复多行文本
await ctx.reply("第一行\n第二行");
```

**注意：** `reply` 只能发文本，不能发图片、表情等。如果需要发其他内容，请用 `ctx.sendAction`。

### ctx.sendAction()

调用底层平台 API（OneBot）。

```typescript
// 发送群消息
await ctx.sendAction("send_group_msg", {
  group_id: 123456,
  message: "Hello!",
});

// 禁言用户（需要管理员权限）
await ctx.sendAction("set_group_ban", {
  group_id: 123456,
  user_id: 789012,
  duration: 60,  // 禁言 60 秒
});

// 获取群信息
const result = await ctx.sendAction("get_group_info", {
  group_id: 123456,
});
if (result.ok) {
  console.log(result.data);
}
```

**常用 Action：**

| Action | 说明 | 示例参数 |
|--------|------|----------|
| `send_group_msg` | 发送群消息 | `{ group_id, message }` |
| `set_group_ban` | 禁言 | `{ group_id, user_id, duration }` |
| `get_group_info` | 获取群信息 | `{ group_id }` |
| `get_user_info` | 获取用户信息 | `{ user_id }` |

### ctx.stopPropagation()

阻止后续处理器执行。

```typescript
@Interceptor(10)
async blockUser(ctx: EventContext): Promise<void> {
  if (this.isBlocked(ctx.event.payload.userId)) {
    ctx.stopPropagation();  // 这条消息不再被后续处理器处理
  }
}
```

### ctx.store

插件专属的 SQLite 存储。所有插件共享同一个数据库文件，通过 `_plugin_tables` 跟踪每个插件的表。

```typescript
// 创建表（框架会自动注入 pluginName）
await ctx.store?.createTable("my_messages", [
  "id INTEGER PRIMARY KEY AUTOINCREMENT",
  "user_id TEXT",
  "content TEXT",
]);

// 插入数据
await ctx.store?.insert("my_messages", {
  user_id: "123456",
  content: "Hello!",
});

// 查询数据
const messages = await ctx.store?.query("my_messages",
  { user_id: "123456" },
  { limit: 10 }
);
```

详见 [PluginStore](/api/plugin-store)。

## 使用示例

### 示例 1：简单问答

```typescript
@Handler("天气")
async onWeather(ctx: EventContext): Promise<void> {
  const city = ctx.event.payload.text?.replace("天气", "").trim() || "北京";
  const weather = await this.fetchWeather(city);
  await ctx.reply(`${city}今天${weather}`);
}
```

### 示例 2：群消息处理

```typescript
@Handler(/^@bot/)
async onAtBot(ctx: EventContext): Promise<void> {
  // 只处理群消息
  if (!ctx.event.payload.groupId) {
    await ctx.reply("请在群里使用此指令");
    return;
  }

  const text = ctx.event.payload.text?.replace("@bot", "").trim();
  await ctx.reply(`你说的是: ${text}`);
}
```

### 示例 3：记录用户操作

```typescript
@Handler("签到")
async onSignIn(ctx: EventContext): Promise<void> {
  const userId = ctx.event.payload.userId!;
  
  // 记录签到
  await ctx.store?.insert("sign_ins", {
    user_id: userId,
    timestamp: Date.now(),
  });

  // 查询签到次数
  const records = await ctx.store?.query("sign_ins", { user_id: userId });
  await ctx.reply(`签到成功！你已经签到 ${records?.length ?? 0} 次`);
}
```

## 下一步

- [PluginStore](/api/plugin-store) — 了解插件存储的完整 API
- [SetupContext](/api/setup-context) — 了解 onSetup 的完整 API
