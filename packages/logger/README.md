# @myfinal/logger

[Dian](https://github.com/FinalDevHQ/Dian) 框架的日志服务，基于 [pino](https://github.com/pinojs/pino) 封装。

## 安装

```bash
npm install @myfinal/logger
```

## 使用

```ts
import { LogService } from "@myfinal/logger";

const log = new LogService();

log.init({
  level: "info",
  pretty: true,       // 开发模式开启彩色格式化输出
  logFile: "app.log", // 可选，同时输出到文件
});

log.info("服务已启动");
log.error({ err }, "发生错误");
```

## API

### `new LogService()`

创建日志服务实例。

### `log.init(options)`

初始化日志服务，必须在使用 logger 之前调用。

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `level` | `"debug" \| "info" \| "warn" \| "error"` | `"info"` | 日志级别 |
| `pretty` | `boolean` | `false` | 开启 pino-pretty 彩色格式化（开发模式） |
| `logFile` | `string` | — | 日志文件路径，同时写入 stdout 和文件 |

### `log.debug / info / warn / error`

标准 pino logger 方法，支持字符串、对象或 `{ err }` 等形式。

## 相关包

- [Dian 主仓库](https://github.com/FinalDevHQ/Dian)
