# 自定义插件

本教程会带你从零创建一个完整的插件。我们以一个"天气查询"插件为例。

## 目标功能

1. 用户发送 `天气 北京`，插件回复北京的天气
2. 用户发送 `天气设置 apikey xxx`，设置 API Key
3. 用户发送 `天气帮助`，显示帮助信息

## 步骤 1：创建项目

```bash
# 进入 Dian 的 plugins 目录
cd plugins

# 创建插件目录
mkdir weather-bot
cd weather-bot
```

## 步骤 2：初始化项目

推荐基于模板创建：

```bash
# 复制模板
cp -r my-plugin/Dian-plugin-template plugins/weather-bot
cd plugins/weather-bot

# 修改 package.json 中的 name
# 修改 src/index.ts 中的 @Plugin name
```

或者手动初始化 `package.json`：

```json
{
  "name": "weather-bot",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "build": "tsup",
    "dev:plugin": "tsup --watch"
  },
  "dependencies": {
    "@myfinal/plugin-runtime": "^0.2.7",
    "@myfinal/shared": "^0.2.3",
    "reflect-metadata": "^0.2.2"
  },
  "devDependencies": {
    "tsup": "^8.5.0",
    "typescript": "^5.6.3"
  }
}
```

## 步骤 3：创建配置文件

创建 `tsup.config.ts`：

```typescript
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "node20",
  outDir: "dist",
  clean: true,
  external: ["@myfinal/plugin-runtime"],
  noExternal: ["reflect-metadata"],
});
```

创建 `tsconfig.json`：

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "strict": true,
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

## 步骤 4：安装依赖

```bash
npm install
```

## 步骤 5：编写插件代码

创建 `src/index.ts`：

```typescript
import "reflect-metadata";
import {
  Plugin,
  Handler,
  type EventContext,
  type PluginSetupContext,
} from "@myfinal/plugin-runtime";

// 配置接口
interface Config {
  apiKey: string;
  defaultCity: string;
}

// 默认配置
const DEFAULT_CONFIG: Config = {
  apiKey: "",
  defaultCity: "北京",
};

@Plugin({
  name: "weather-bot",
  description: "天气查询插件",
  version: "1.0.0",
  author: "your-name",
  icon: "🌤️",
})
export default class WeatherBot {
  private config: Config = { ...DEFAULT_CONFIG };

  // 帮助命令
  @Handler("天气帮助")
  async onHelp(ctx: EventContext): Promise<void> {
    await ctx.reply(
      `🌤️ 天气查询插件\n` +
      `使用方法:\n` +
      `  天气 [城市名] - 查询天气\n` +
      `  天气设置 apikey [key] - 设置 API Key\n` +
      `  天气帮助 - 显示此帮助`
    );
  }

  // 查询天气
  @Handler(/^天气(.+)?$/)
  async onWeather(ctx: EventContext): Promise<void> {
    // 提取城市名
    const text = ctx.event.payload.text ?? "";
    const match = text.match(/^天气(.+)?$/);
    const city = match?.[1]?.trim() || this.config.defaultCity;

    // 检查 API Key
    if (!this.config.apiKey) {
      await ctx.reply("❌ 未设置 API Key，请先运行：天气设置 apikey [你的key]");
      return;
    }

    // 查询天气（这里简化处理，实际项目中调用真实 API）
    await ctx.reply(`🌤️ ${city}：晴，25°C`);
  }

  // 设置配置
  @Handler(/^天气设置(.+)$/)
  async onSettings(ctx: EventContext): Promise<void> {
    const text = ctx.event.payload.text ?? "";
    const match = text.match(/^天气设置(.+)$/);
    const args = match?.[1]?.trim().split(/\s+/);

    if (!args?.length) {
      await ctx.reply(
        `⚙️ 天气设置\n` +
        `  天气设置 apikey [key] - 设置 API Key\n` +
        `  天气设置 默认城市 [城市名] - 设置默认城市`
      );
      return;
    }

    const [key, ...valueParts] = args;
    const value = valueParts.join(" ");

    switch (key) {
      case "apikey":
        this.config.apiKey = value;
        await ctx.reply("✅ API Key 已设置");
        break;
      case "默认城市":
        this.config.defaultCity = value;
        await ctx.reply(`✅ 默认城市已设置为: ${value}`);
        break;
      default:
        await ctx.reply(`❌ 未知设置项: ${key}`);
    }
  }

  onSetup(ctx: PluginSetupContext): void {
    // 注册 HTTP API
    ctx.route("GET", "/config", (_req, reply) => {
      reply.send({ ok: true, data: this.config });
    });

    ctx.route("POST", "/config", (req, reply) => {
      const body = req.body as Partial<Config>;
      if (body.apiKey) this.config.apiKey = body.apiKey;
      if (body.defaultCity) this.config.defaultCity = body.defaultCity;
      reply.send({ ok: true, data: this.config });
    });
  }
}
```

## 步骤 6：构建插件

```bash
npm run build
```

构建成功后，`dist` 目录下会生成 `index.js`。

## 步骤 7：重启 Dian

重启你的 Dian 服务，插件会自动加载。

## 步骤 8：测试

发送消息测试：

```
天气帮助
```

回复：
```
🌤️ 天气查询插件
使用方法:
  天气 [城市名] - 查询天气
  天气设置 apikey [key] - 设置 API Key
  天气帮助 - 显示此帮助
```

```
天气 北京
```

回复：
```
🌤️ 北京：晴，25°C
```

## 下一步

现在你已经会创建插件了，可以继续学习：

- [热重载](/advanced/hot-reload) — 边开发边测试，不用重启
- [PluginStore](/api/plugin-store) — 给插件添加数据库存储
- [Bot Scope](/advanced/bot-scope) — 控制插件在哪些机器人上运行
