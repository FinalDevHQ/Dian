# @myfinal/config

[Dian](https://github.com/FinalDevHQ/Dian) 框架的配置读取与热重载服务，支持 `settings.yaml`、`bot.yaml`、`templates.yaml`，使用 [Zod](https://zod.dev) 进行 schema 校验。

## 安装

```bash
npm install @myfinal/config
```

## 使用

```ts
import { ConfigService } from "@myfinal/config";

const config = new ConfigService();

// 从磁盘加载（校验失败会抛出错误）
config.init(); // 默认读取 <cwd>/config 目录

// 获取配置
const { logLevel, storage, auth } = config.settings;
const bots = config.bots;

// 监听配置变更（热重载）
config.watch();
config.on("change", ({ file, config }) => {
  console.log(`${file} 已变更`, config);
});
```

## 配置文件

| 文件 | 说明 |
|------|------|
| `settings.yaml` | 全局设置：日志级别、存储连接、JWT 认证 |
| `bot.yaml` | Bot 列表：WebSocket / HTTP 连接参数、心跳、重连 |
| `templates.yaml` | 消息模板 |

### `settings.yaml` 示例

```yaml
logLevel: info
auth:
  passwordHash: "$2b$10$..."
  tokenExpiresIn: 86400
storage:
  sqlite: data/dian.db
```

### `bot.yaml` 示例

```yaml
bots:
  - botId: my-bot
    enabled: true
    mode: hybrid
    ws:
      url: ws://localhost:3001/
      accessToken: ""
    http:
      baseUrl: http://localhost:3000/
      accessToken: ""
```

## API

### `config.init(configDir?)`

从磁盘加载全量配置，默认目录为 `<cwd>/config`。

### `config.watch()`

启动文件监听，配置变更时触发 `change` 事件。

### `config.settings`

返回 `Settings` 对象（`logLevel`、`storage`、`auth`）。

### `config.bots`

返回 `BotEntry[]` Bot 配置列表。

## 相关包

- [Dian 主仓库](https://github.com/FinalDevHQ/Dian)
