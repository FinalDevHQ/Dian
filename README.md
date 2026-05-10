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

- Node.js 22+
- npm 10+

### 安装依赖

```bash
npm install
```

### 编译所有 packages

```bash
npm run build -w packages
```

### 启动后端（监听模式）

```bash
npm run dev -w apps/server
# 另开终端
npm run start -w apps/server
```

### 启动前端开发服务器

```bash
npm run dev -w apps/web
# 访问 http://localhost:5173
# /api/* 和 /plugins/* 已通过 Vite proxy 转发到后端 :3000
```

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