# PluginStore

PluginStore 是插件专属的 SQLite 存储，每个插件都有自己的数据库，互不干扰。

## 快速上手

```typescript
@Plugin({ name: "my-plugin" })
export default class MyPlugin {
  // 在 onSetup 里声明数据源（可选，会在数据库管理界面显示）
  onSetup(ctx: PluginSetupContext): void {
    ctx.datasource("my-plugin", "/path/to/data.sqlite");
  }

  @Handler("签到")
  async onSignIn(ctx: EventContext): Promise<void> {
    // 第一次使用时创建表
    await ctx.store?.createTable("sign_ins", [
      "id INTEGER PRIMARY KEY AUTOINCREMENT",
      "user_id TEXT",
      "timestamp INTEGER",
    ]);

    // 插入数据
    await ctx.store?.insert("sign_ins", {
      user_id: ctx.event.payload.userId,
      timestamp: Date.now(),
    });

    // 查询数据
    const records = await ctx.store?.query("sign_ins", {
      user_id: ctx.event.payload.userId,
    });

    await ctx.reply(`你已经签到 ${records?.length ?? 0} 次`);
  }
}
```

## 方法详解

### createTable()

创建数据表。

```typescript
await ctx.store?.createTable("users", [
  "id INTEGER PRIMARY KEY AUTOINCREMENT",  // 自增主键
  "user_id TEXT NOT NULL",                 // 用户 ID，不能为空
  "name TEXT",                             // 名字，可为空
  "points INTEGER DEFAULT 0",             // 积分，默认 0
  "created_at INTEGER",                   // 创建时间
]);
```

**参数：**

| 参数 | 类型 | 说明 |
|------|------|------|
| `tableName` | `string` | 表名 |
| `columns` | `string[]` | 列定义数组 |

**列定义格式：**
- `"列名 类型 约束"`
- 常用类型：`INTEGER`、`TEXT`、`REAL`
- 常用约束：`PRIMARY KEY`、`NOT NULL`、`DEFAULT 值`

::: tip 表名建议
表名建议使用 `插件名_功能名` 格式，如 `my-plugin_users`，避免和其他插件冲突。
:::

### insert()

插入一条数据。

```typescript
await ctx.store?.insert("users", {
  user_id: "123456",
  name: "张三",
  points: 100,
  created_at: Date.now(),
});
```

**参数：**

| 参数 | 类型 | 说明 |
|------|------|------|
| `tableName` | `string` | 表名 |
| `data` | `Record<string, unknown>` | 要插入的数据 |

### query()

查询数据。

```typescript
// 查询所有用户
const allUsers = await ctx.store?.query("users");

// 条件查询
const user = await ctx.store?.query("users", { user_id: "123456" });

// 分页查询（最近 10 条）
const recentUsers = await ctx.store?.query("users", 
  {},  // 空对象表示查询所有
  { 
    limit: 10, 
    orderBy: "created_at", 
    order: "DESC" 
  }
);
```

**参数：**

| 参数 | 类型 | 说明 |
|------|------|------|
| `tableName` | `string` | 表名 |
| `params` | `Record<string, unknown>` | 查询条件（可选，不传查询所有） |
| `options.limit` | `number` | 返回条数（可选） |
| `options.orderBy` | `string` | 排序字段（可选） |
| `options.order` | `"ASC" \| "DESC"` | 排序方向（可选，ASC 升序，DESC 降序） |

### delete()

删除数据。

```typescript
// 删除指定用户
await ctx.store?.delete("users", { user_id: "123456" });

// 删除所有数据
await ctx.store?.delete("users");
```

**参数：**

| 参数 | 类型 | 说明 |
|------|------|------|
| `tableName` | `string` | 表名 |
| `params` | `Record<string, unknown>` | 删除条件（可选，不传删除所有） |

**返回值：** 删除的行数

## 实战示例

### 示例 1：积分系统

```typescript
@Plugin({ name: "points" })
export default class PointsPlugin {
  onSetup(ctx: PluginSetupContext): void {
    ctx.datasource("points", "/path/to/points.sqlite");
  }

  @Handler("签到")
  async onSignIn(ctx: EventContext): Promise<void> {
    // 确保表存在
    await ctx.store?.createTable("points", [
      "user_id TEXT PRIMARY KEY",
      "points INTEGER DEFAULT 0",
      "last_sign INTEGER",
    ]);

    const userId = ctx.event.payload.userId!;
    const now = Date.now();

    // 查询用户
    const [user] = await ctx.store?.query("points", { user_id: userId }) ?? [];

    if (user) {
      // 检查今天是否已签到
      const lastSign = user.last_sign as number;
      const isToday = new Date(lastSign).toDateString() === new Date(now).toDateString();

      if (isToday) {
        await ctx.reply("今天已经签到过了！");
        return;
      }

      // 更新积分
      await ctx.store?.insert("points", {
        user_id: userId,
        points: (user.points as number) + 10,
        last_sign: now,
      });
    } else {
      // 新用户签到
      await ctx.store?.insert("points", {
        user_id: userId,
        points: 10,
        last_sign: now,
      });
    }

    await ctx.reply("签到成功！+10 积分");
  }

  @Handler("查积分")
  async onCheckPoints(ctx: EventContext): Promise<void> {
    const userId = ctx.event.payload.userId!;
    const [user] = await ctx.store?.query("points", { user_id: userId }) ?? [];

    const points = (user?.points as number) ?? 0;
    await ctx.reply(`你当前有 ${points} 积分`);
  }
}
```

### 示例 2：消息记录

```typescript
@Plugin({ name: "message-log" })
export default class MessageLogPlugin {
  private initialized = false;

  @Interceptor(1)
  async logMessage(ctx: EventContext): Promise<void> {
    // 第一条消息时创建表
    if (!this.initialized && ctx.store) {
      await ctx.store.createTable("messages", [
        "id INTEGER PRIMARY KEY AUTOINCREMENT",
        "user_id TEXT",
        "group_id TEXT",
        "content TEXT",
        "timestamp INTEGER",
      ]);
      this.initialized = true;
    }

    // 记录消息
    if (ctx.store && ctx.event.type === "message") {
      await ctx.store.insert("messages", {
        user_id: ctx.event.payload.userId,
        group_id: ctx.event.payload.groupId,
        content: ctx.event.payload.text,
        timestamp: ctx.event.timestamp,
      });
    }
  }

  @Handler("查记录")
  async onCheckLog(ctx: EventContext): Promise<void> {
    const messages = await ctx.store?.query("messages",
      { user_id: ctx.event.payload.userId },
      { limit: 5, orderBy: "timestamp", order: "DESC" }
    );

    if (!messages?.length) {
      await ctx.reply("没有你的消息记录");
      return;
    }

    const text = messages
      .map(m => `${new Date(m.timestamp as number).toLocaleString()}: ${m.content}`)
      .join("\n");

    await ctx.reply(`最近 5 条消息:\n${text}`);
  }
}
```

## 注意事项

1. **表名唯一** — 同一个插件内的表名不能重复
2. **类型安全** — 查询结果是 `Record<string, unknown>[]`，需要自己转换类型
3. **性能** — SQLite 适合中小数据量，不要存太多数据
4. **备份** — 数据库文件在 `plugins/你的插件/data/` 目录下，记得备份
