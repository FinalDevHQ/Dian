# Dian

基于 OneBot 协议的多机器人管理框架，支持插件热加载、Web 控制台与 Docker 一键部署。

## 特性

- **多 Bot 管理** — 同时连接多个 OneBot 实例，独立启停、状态监控、热重载
- **Web 管理控制台** — 仪表盘、Bot 管理、配置编辑、插件管理、数据库浏览器、消息查询、实时日志
- **JWT 认证** — Web 控制台受密码保护，默认密码 `change_me`
- **插件系统** — 热加载/热重载，支持上传安装与开发者模式实时推送
- **插件市场** — Web 控制台内一键浏览并安装社区插件
- **消息持久化** — 历史消息存储与搜索
- **统计分析** — 消息量趋势、群/用户维度统计
- **灵活存储** — SQLite 内置，可选 MySQL / Redis
- **Docker 一键部署** — 也可本地开发运行

## 项目结构

```
apps/
  server/     # Fastify 后端（HTTP API + SSE + WebSocket）
  web/        # React 19 + Vite 8 控制台前端
packages/
  config/         # YAML 配置读取与热重载
  logger/         # pino 日志封装
  plugin-runtime/ # 插件加载、热重载、装饰器
  module-runtime/ # 模块生命周期管理
  sdk/            # OneBot 适配器（WebSocket / HTTP）+ dian-dev CLI
  shared/         # 共享类型定义
  storage/        # SQLite / MySQL / Redis 适配器 + PluginStore
plugins/          # 已安装的插件（运行时目录）
config/           # 配置文件（bot.yaml / settings.yaml 等）
data/             # 运行时数据（dian.db / messages.db 等）
.vscode/          # VS Code 推荐设置
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

编辑 `config/settings.yaml`，按需调整日志级别、认证密码和存储选项：

```yaml
logLevel: info
auth:
  passwordHash: "$2b$10$..."   # 用 bcrypt 生成，默认密码 change_me
  tokenExpiresIn: 86400
storage:
  sqlite: data/dian.db
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

### 2. 准备配置

最少需要这两个文件（首次克隆后即存在示例）：

- `config/settings.yaml` — 日志级别 / 存储路径 / 认证配置
- `config/bot.yaml` — 至少一条 bot 记录（schema 限制不可为空）

如果你暂时没有可用的 OneBot 服务，把 bot 的 `enabled` 改为 `false` 即可——后端会跳过它，不会因为连不上而崩溃；连接失败也只会降级为后台重连，并通过控制台「Bot 列表」展示真实在线状态。

### 3. 一次性构建（必须）

```bash
npm run build
```

等价于：

```bash
npm run build -w packages && npm run build -w apps/server
```

### 4. 启动后端

```bash
npm run start
# 默认监听 http://localhost:3000
# 自定义端口：PORT=4000 npm run start
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
npm run dev:web
# Vite 默认 http://localhost:5173；若端口被占会自动尝试 5174、5175...
```

`apps/web/vite.config.ts` 已经把以下路径反代到后端：

- `/api/*` → `http://localhost:3000/*`（业务接口）
- `/plugins/*` → 插件运行时资源

### 6. 修改源码后

| 你改了什么 | 需要做什么 |
|------------|------------|
| `apps/web/**`（前端） | Vite HMR 自动刷新，无需重启 |
| `apps/server/**` 或 `packages/**` | 重新 `npm run build`，然后重启 `npm run start` |
| `plugins/**` | 自动热加载，无需任何操作 |
| `config/**.yaml` | 自动热重载（bot.yaml、settings.yaml） |

开发模式下也可使用监听式自动编译：

```bash
npm run dev        # 同时监听 packages + apps/server（仅编译，不会重启 node）
```

> 当前仓库没有内置 `nodemon`/`tsx watch`，server 代码改动后需要手动重启 `npm run start`。

根目录可用脚本一览：

| 命令 | 说明 |
|------|------|
| `npm run build` | 构建 packages + server |
| `npm run start` | 启动后端 |
| `npm run dev:web` | 启动前端开发服务器 |
| `npm run dev` | 监听编译 packages + server（不重启 node） |

### 常见问题

- **`Cannot find module '.../apps/server/dist/main.js'`**：还没构建。运行根目录 `npm run build`。
- **`better-sqlite3` 安装失败**：检查上面的"构建工具链"前置要求；Windows 上确保 VS Build Tools 已装好 C++ 工作负载。
- **端口 3000 / 5173 被占用**：后端用 `PORT=xxxx`；前端 Vite 会自动换端口（控制台会打印实际地址）。
- **Bot 在控制台一直显示「离线 · 重连中」**：检查 `config/bot.yaml` 中 `ws.url` / `http.baseUrl` / `accessToken` 是否与你的 OneBot 实例匹配，以及网络是否可达。

---

## Web 控制台

启动后访问 `http://localhost:5173`（或 Docker 部署时的 `http://<IP>:18099`），首次进入需要登录。

| 页面 | 功能 |
|------|------|
| 仪表盘 | 系统概览：CPU / 内存、消息量趋势、Bot 在线状态 |
| Bot 管理 | 添加/编辑/删除 Bot，启用/禁用切换 |
| 消息 | 历史消息搜索与浏览 |
| 分析 | 消息量统计、群/用户维度数据、趋势图 |
| 插件 | 插件列表、启停、上传安装、范围配置 |
| 市场 | 从社区仓库浏览并一键安装插件 |
| 配置 | Web 界面编辑 bot.yaml、settings.yaml 等 |
| 数据库 | SQLite 数据库浏览器与 SQL 查询 |
| 日志 | 实时事件日志查看器 |

---

## 插件开发

使用插件 SDK CLI（基于 `@myfinal/sdk` 的开发者模式）：

```bash
# 在已安装的插件目录中启动开发者模式
npx dian-dev
```

或使用官方插件模版：[FinalDevHQ/Dian-plugin-template](https://github.com/FinalDevHQ/Dian-plugin-template)

```bash
git clone https://github.com/FinalDevHQ/Dian-plugin-template.git my-plugin
cd my-plugin
npm install
npm run dev:plugin   # 监听编译插件逻辑
npm run dev:ui       # 监听编译插件 UI
npm run pack         # 打包为 <name>.zip
```

打包好的 zip 可直接在 Web 控制台「插件」页上传安装，框架自动热加载，无需重启。

插件在运行时可以使用 `@myfinal/storage` 提供的 `PluginStore` 接口，自动获得独立的 SQLite 表空间。

---

## 配置文件说明

| 文件 | 说明 |
|------|------|
| `config/bot.yaml` | 机器人连接配置（支持多 bot，含心跳/重连/超时参数） |
| `config/settings.yaml` | 全局设置（日志、存储、认证） |
| `config/templates.yaml` | 消息模板 |
| `config/plugin-scope.json` | 插件 bot 白名单（运行时自动维护） |
| `config/bot.yaml.example` | Bot 配置无密钥模板 |
| `config/settings.yaml.example` | 全局设置无密钥模板 |

---

## 认证

Web 控制台使用 JWT 认证保护。默认密码为 `change_me`，首次部署后请及时修改。

生成新密码哈希：

```bash
npm install -g bcrypt
node -e "console.log(require('bcrypt').hashSync('your-new-password', 10))"
```

将输出的哈希填入 `config/settings.yaml` 的 `auth.passwordHash` 字段，然后重启后端。
