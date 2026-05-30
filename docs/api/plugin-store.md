# PluginStore

PluginStore 是插件专属的 SQLite 存储。所有插件共享同一个数据库文件，但通过 `_plugin_tables` 元数据表跟踪每个插件拥有的表，卸载时可一键清理。

## 快速上手

```typescript
@Plugin({ name: "my-plugin" })
export default class MyPlugin {
  @Handler("签到")
  async onSignIn(ctx: EventContext): Promise<void> {
    if (!ctx.store) return;

    // 第一次使用时创建表（框架会自动注入 pluginName）
    await ctx.store.createTable("my_sign_ins", [
      "user_id TEXT NOT NULL",
      "timestamp INTEGER NOT NULL",
    ]);

    // 插入数据
    await ctx.store.insert("my_sign_ins", {
      user_id: ctx.event.payload.userId,
      timestamp: Date.now(),
    });

    // 查询数据
    const records = await ctx.store.query("my_sign_ins", {
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
await ctx.store.createTable("my_users", [
  "id INTEGER PRIMARY KEY AUTOINCREMENT",
  "user_id TEXT NOT NULL",
  "name TEXT",
  "points INTEGER DEFAULT 0",
  "created_at INTEGER",
]);
```

**参数：**

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `tableName` | `string` | ✅ | 表名 |
| `columns` | `string[]` | ✅ | 列定义数组 |

::: tip 自动追踪
框架会自动为每个插件创建带作用域的 `store`，调用 `createTable` 时会自动注入 `pluginName`，无需手动传第三个参数。表会自动在 `_plugin_tables` 元数据表中注册。
:::

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
await ctx.store.insert("my_users", {
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
const allUsers = await ctx.store.query("my_users");

// 条件查询
const user = await ctx.store.query("my_users", { user_id: "123456" });

// 分页查询（最近 10 条）
const recentUsers = await ctx.store.query("my_users",
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
await ctx.store.delete("my_users", { user_id: "123456" });

// 删除所有数据
await ctx.store.delete("my_users");
```

**参数：**

| 参数 | 类型 | 说明 |
|------|------|------|
| `tableName` | `string` | 表名 |
| `params` | `Record<string, unknown>` | 删除条件（可选，不传删除所有） |

**返回值：** 删除的行数

### getPluginTables()

获取插件拥有的所有表名（从 `_plugin_tables` 元数据表查询）。

```typescript
const tables = await ctx.store.getPluginTables("my-plugin");
console.log(tables); // ["my_users", "my_sign_ins", ...]
```

### dropPluginTables()

删除插件拥有的所有表（包括元数据记录）。卸载插件时由框架自动调用。

```typescript
await ctx.store.dropPluginTables("my-plugin");
```

## 实战示例

### 示例 1：积分系统

```typescript
@Plugin({ name: "points" })
export default class PointsPlugin {
  private tableReady = false;

  private async ensureTable(store: PluginStore): Promise<void> {
    if (this.tableReady) return;
    await store.createTable("points_data", [
      "user_id TEXT PRIMARY KEY",
      "points INTEGER DEFAULT 0",
      "last_sign INTEGER",
    ]);
    this.tableReady = true;
  }

  @Handler("签到")
  async onSignIn(ctx: EventContext): Promise<void> {
    if (!ctx.store) return;
    await this.ensureTable(ctx.store);

    const userId = ctx.event.payload.userId!;
    const now = Date.now();

    // 查询用户
    const [user] = await ctx.store.query("points_data", { user_id: userId });

    if (user) {
      // 检查今天是否已签到
      const lastSign = user.last_sign as number;
      const isToday = new Date(lastSign).toDateString() === new Date(now).toDateString();

      if (isToday) {
        await ctx.reply("今天已经签到过了！");
        return;
      }

      // 更新积分
      await ctx.store.delete("points_data", { user_id: userId });
      await ctx.store.insert("points_data", {
        user_id: userId,
        points: (user.points as number) + 10,
        last_sign: now,
      });
    } else {
      // 新用户签到
      await ctx.store.insert("points_data", {
        user_id: userId,
        points: 10,
        last_sign: now,
      });
    }

    await ctx.reply("签到成功！+10 积分");
  }

  @Handler("查积分")
  async onCheckPoints(ctx: EventContext): Promise<void> {
    if (!ctx.store) return;
    await this.ensureTable(ctx.store);

    const userId = ctx.event.payload.userId!;
    const [user] = await ctx.store.query("points_data", { user_id: userId });

    const points = (user?.points as number) ?? 0;
    await ctx.reply(`你当前有 ${points} 积分`);
  }
}
```

### 示例 2：HTTP 路由中使用

在 `ctx.route()` 注册的路由中，通过 `req.pluginStore` 访问：

```typescript
onSetup(ctx: PluginSetupContext): void {
  ctx.route("GET", "/notes", async (req, reply) => {
    const store = (req as unknown as Record<string, unknown>).pluginStore as PluginStore | undefined;
    if (!store) {
      reply.send({ ok: true, notes: [] });
      return;
    }
    await store.createTable("my_notes", [
      "content TEXT NOT NULL",
      "user_id TEXT NOT NULL",
      "created_at INTEGER NOT NULL",
    ]);
    const rows = await store.query("my_notes", {}, { limit: 20, orderBy: "id", order: "DESC" });
    reply.send({ ok: true, notes: rows });
  });
}
```

::: tip 路由中的 pluginStore
`req.pluginStore` 是框架在路由处理时自动注入的，已绑定当前插件的 `pluginName`，`createTable` 时可以不传第三个参数。
:::

## _plugin_tables 机制

框架通过 `_plugin_tables` 元数据表跟踪每个插件拥有的表：

```
_plugin_tables
├── id (自增主键)
├── plugin_name (插件名)
├── table_name (表名)
└── created_at (创建时间)
```

- 框架自动为每个插件创建带作用域的 `store`，`createTable` 时自动注册
- 卸载插件时，管理界面列出所有关联表供用户选择是否删除
- `dropPluginTables()` 一键删除插件所有表

## 注意事项

1. **表名唯一** — 同一个插件内的表名不能重复
2. **自动追踪** — 框架会自动注入 `pluginName`，无需手动传参
3. **类型安全** — 查询结果是 `Record<string, unknown>[]`，需要自己转换类型
4. **性能** — SQLite 适合中小数据量，不要存太多数据
