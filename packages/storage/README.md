# @myfinal/storage

[Dian](https://github.com/FinalDevHQ/Dian) 框架的存储适配器，支持 SQLite、MySQL、Redis，并提供插件专属的 `PluginStore` 接口。

## 安装

```bash
npm install @myfinal/storage
```

> 原生模块依赖：`better-sqlite3` 需要编译工具链。Windows 上需安装 [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)，macOS 上 `xcode-select --install`，Linux 上 `build-essential`。

## 使用

```ts
import { StorageService } from "@myfinal/storage";

const storage = new StorageService();

await storage.init({
  sqlite: "data/dian.db",
  // mysql: "mysql://user:pass@host:3306/db",
  // redis: "redis://localhost:6379",
});

// 消息存储
await storage.messages.save({ botId: "my-bot", ... });
const msgs = await storage.messages.query({ groupId: "123456" });

// 插件专属存储（PluginStore）
const store = storage.getPluginStore("my-plugin");
await store.createTable("my_plugin_data", ["key TEXT", "value TEXT"]);
await store.insert("my_plugin_data", { key: "foo", value: "bar" });
const rows = await store.query("my_plugin_data", { key: "foo" });
```

## 适配器

| 适配器 | 说明 |
|--------|------|
| SQLite | 内置，零配置，数据存于本地文件 |
| MySQL | 通过连接字符串配置，适合生产环境 |
| Redis | 用于缓存、消息队列等高速读写场景 |

## `PluginStore` 接口

插件专属的 SQLite 表空间，自动隔离，互不干扰。

| 方法 | 说明 |
|------|------|
| `createTable(name, columns)` | 创建插件专属表 |
| `insert(table, data)` | 插入数据 |
| `query(table, params?, options?)` | 查询数据，支持 `limit`、`orderBy` |
| `delete(table, params?)` | 删除数据 |

## 相关包

- [Dian 主仓库](https://github.com/FinalDevHQ/Dian)
