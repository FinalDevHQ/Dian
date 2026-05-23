# 开发 CLI

`dian-dev` 是一个命令行工具，可以让你在本地开发机上修改代码，实时同步到远程的 Dian 服务器。

## 什么时候用这个？

- 你在自己的电脑上开发插件
- Dian 跑在另一台服务器上
- 你想边改代码边测试，不用每次都手动上传

## 工作原理

```
你的电脑                          Dian 服务器
   │                                  │
   │  1. 检测到文件变化               │
   │  2. 打包成 ZIP 文件              │
   │  3. 通过 WebSocket 发送          │
   │ ──────────────────────────────> │
   │                                  │  4. 解压文件
   │                                  │  5. 热重载插件
   │ <────────────────────────────── │
```

## 怎么用

### 第一步：配置 Dian 服务器

确保你的 Dian 服务器已经启用了 `dian-dev-sync` 插件。

编辑 `plugins/dian-dev-sync/config.json`：

```json
{
  "token": "my-secret-token",
  "port": 3901,
  "host": "0.0.0.0"
}
```

### 第二步：在你的电脑上安装 SDK

```bash
# 在你的插件项目目录下
npm install -D @myfinal/sdk
```

### 第三步：配置开发同步

编辑 `package.json`，添加配置：

```json
{
  "dian": {
    "dev": {
      "wsUrl": "ws://你的服务器IP:3901",
      "token": "my-secret-token",
      "pluginName": "my-plugin",
      "distDir": "./dist",
      "debounceMs": 500
    }
  }
}
```

**配置说明：**

| 参数 | 说明 |
|------|------|
| `wsUrl` | Dian 服务器的 WebSocket 地址 |
| `token` | 和服务器配置的 token 一致 |
| `pluginName` | 你的插件名字 |
| `distDir` | 构建产物目录（一般是 `./dist`） |
| `debounceMs` | 防抖延迟（毫秒），防止频繁同步 |

### 第四步：启动开发同步

打开两个终端：

**终端 1：自动构建**

```bash
npm run dev:plugin  # 或者 tsup --watch
```

**终端 2：同步到服务器**

```bash
npx dian-dev
```

### 第五步：开始开发

现在你修改 `src/index.ts`，保存后：
1. 终端 1 自动重新构建
2. 终端 2 自动同步到服务器
3. 插件自动热重载

## 常见问题

### 连接失败？

```
❌ WebSocket 连接失败: Connection refused
```

检查：
1. Dian 服务器是否在运行
2. `dian-dev-sync` 插件是否已加载
3. IP 和端口是否正确
4. 防火墙是否阻止了连接

### 认证失败？

```
❌ 认证失败: Invalid token
```

检查：
1. token 是否和服务器配置一致
2. token 有没有多余空格

### 同步失败？

```
❌ 同步失败: Plugin not found
```

检查：
1. `pluginName` 配置是否正确
2. 服务器上是否存在这个插件

## 安全提醒

- 生产环境不要启用 `dian-dev-sync` 插件
- 使用强随机的 token
- 限制服务器的访问 IP
- 使用 WSS（加密的 WebSocket）

## 下一步

- [Bot Scope](/advanced/bot-scope) — 控制插件在哪些机器人上运行
