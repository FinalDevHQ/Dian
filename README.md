# Dian

基于 OneBot 协议的多机器人管理框架，支持插件热加载、Web 控制台与 Docker 一键部署。

## 项目结构

```
apps/
  server/     # Fastify 后端（HTTP API + SSE）
  web/        # React 控制台前端
packages/
  config/         # YAML 配置读取与热重载
  logger/         # pino 日志封装
  plugin-runtime/ # 插件加载、热重载、装饰器
  module-runtime/ # 模块生命周期管理
  sdk/            # OneBot WebSocket / HTTP 适配器
  shared/         # 共享类型定义
  storage/        # SQLite / MySQL / Redis 适配器
plugins/          # 已安装的插件（运行时目录）
config/           # 配置文件（bot.yaml / settings.yaml 等）
data/             # 运行时数据（SQLite 等）
```

---

## 快速开始（Docker，推荐）

### 前置要求

- Docker & Docker Compose v2

### 1. 克隆仓库

```bash
git clone https://github.com/FinalDevHQ/Dian.git
cd Dian
```

### 2. 编写配置

编辑 `config/settings.yaml`，按需调整日志级别和存储选项：

```yaml
logLevel: info
storage:
  sqlite: data/dian.db   # 默认启用 SQLite
  # mysql: mysql://user:password@host:3306/dian
```

编辑 `config/bot.yaml`，填写你的 OneBot 连接信息：

```yaml
bots:
  - botId: my-bot
    enabled: true
    mode: hybrid          # ws + http 双向
    ws:
      url: ws://your-onebot-host:3001/
      accessToken: ""
    http:
      baseUrl: http://your-onebot-host:3000/
      accessToken: ""
```

### 3. 启动

```bash
docker compose up -d --build
```

Web 控制台：`http://<服务器IP>:18099`

> 首次构建需要下载镜像和编译原生模块，约 5~10 分钟。后续只要依赖未变，`npm ci` 层会命中缓存，重新构建通常在 1 分钟内完成。

---

## 本地开发

### 前置要求

- **Node.js**：20 LTS 或更高（已在 20.19 / 22 上验证）
- **npm**：10+（随 Node 自带）
- **构建工具链**：`better-sqlite3` 需要原生模块，Windows 上请安装 [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)（包含 "Desktop development with C++"），macOS 上 `xcode-select --install`，Linux 上 `build-essential` + `python3`

### 1. 克隆并安装依赖

```bash
git clone https://github.com/FinalDevHQ/Dian.git
cd Dian
npm install
```

> npm workspaces 会一次性安装 `apps/*` 与 `packages/*` 的所有依赖，根目录无需重复安装。

### 2. 准备配置

最少需要这两个文件（首次克隆后即存在示例）：

- `config/settings.yaml` — 日志级别 / 存储路径
- `config/bot.yaml` — 至少一条 bot 记录（schema 限制不可为空）

如果你暂时没有可用的 OneBot 服务，把 bot 的 `enabled` 改为 `false` 即可——后端会跳过它，不会因为连不上而崩溃；连接失败也只会降级为后台重连，并通过控制台「Bot 列表」展示真实在线状态。

### 3. 一次性构建（必须）

`apps/server` 走的是 `tsc` 编译产物（`dist/main.js`），第一次必须先构建，否则 `npm run start` 会报 `Cannot find module 'dist/main.js'`：

```bash
# 一条命令同时构建 packages 和 server
npm run build
```

等价于：

```bash
npm run build -w packages && npm run build -w apps/server
```

### 4. 启动后端

```bash
npm run start -w apps/server
# 默认监听 http://localhost:3000
# 自定义端口：PORT=4000 npm run start -w apps/server
```

成功日志关键字：

```
HTTP server listening on http://0.0.0.0:3000
Bots startup complete: N registered, X initial failure(s)
```

> 后端会守护 `bot.yaml` 文件变更并热重载 bot 列表；插件目录 `plugins/` 也是热加载的，无需重启。

### 5. 启动前端

另开一个终端：

```bash
npm run dev -w apps/web
# Vite 默认 http://localhost:5173；若端口被占会自动尝试 5174、5175...
```

`apps/web/vite.config.ts` 已经把以下路径反代到后端：

- `/api/*` → `http://localhost:3000/*`（业务接口）
- `/plugins/*` → 插件运行时资源

如果你改了后端端口，记得同步更新 `vite.config.ts` 中的 `target` 或设置环境变量 `VITE_API_BASE_URL`。

### 6. 修改源码后

| 你改了什么 | 需要做什么 |
|------------|------------|
| `apps/web/**`（前端） | Vite HMR 自动刷新，无需重启 |
| `apps/server/**` 或 `packages/**` | 重新 `npm run build`，然后 Ctrl+C 后再 `npm run start -w apps/server` |
| `plugins/**` | 自动热加载，无需任何操作 |
| `config/**.yaml` | 自动热重载（bot.yaml、settings.yaml） |

如果想要 server/packages 也支持自动重新编译，可以再开一个终端跑：

```bash
npm run dev -w packages       # 监听 packages
npm run dev -w apps/server    # 监听 server（仅编译，不会重启 node 进程）
```

> 注意 `apps/server` 的 `dev` 脚本只是 `tsc -b --watch`，不会自动重启 node。当前仓库没有内置 `nodemon`/`tsx watch`，建议在 server 代码改动后手动重启 `npm run start`。

### 常见问题

- **`Cannot find module '.../apps/server/dist/main.js'`**：还没构建。运行根目录 `npm run build`。
- **`Fatal startup error: socket hang up` / `ECONNRESET`**：旧版会在 bot 首次连接失败时崩溃；现已修复为后台重连。若仍遇到，请确认依赖已更新到最新（`git pull && npm install && npm run build`）。
- **`better-sqlite3` 安装失败**：检查上面的"构建工具链"前置要求；Windows 上确保 VS Build Tools 已装好 C++ 工作负载。
- **端口 3000 / 5173 被占用**：后端用 `PORT=xxxx`；前端 Vite 会自动换端口（控制台会打印实际地址）。
- **Bot 在控制台一直显示「离线 · 重连中」**：检查 `config/bot.yaml` 中 `ws.url` / `http.baseUrl` / `accessToken` 是否与你的 OneBot 实例匹配，以及网络是否可达。

---

## 插件开发

使用官方插件模版：[FinalDevHQ/Dian-plugin-template](https://github.com/FinalDevHQ/Dian-plugin-template)

```bash
git clone https://github.com/FinalDevHQ/Dian-plugin-template.git my-plugin
cd my-plugin
npm install
npm run dev:plugin   # 监听编译插件逻辑
npm run dev:ui       # 监听编译插件 UI
npm run pack         # 打包为 <name>.zip
```

打包好的 zip 可直接在 Web 控制台「插件」页上传安装，框架自动热加载，无需重启。

---

## 配置文件说明

| 文件 | 说明 |
|------|------|
| `config/bot.yaml` | 机器人连接配置（支持多 bot） |
| `config/settings.yaml` | 全局设置（日志、存储） |
| `config/templates.yaml` | 消息模板 |
| `config/plugin-scope.json` | 插件 bot 白名单（运行时自动维护） |