# Bot Scope

Bot Scope 用来控制一个插件在哪些机器人上生效。使用白名单机制，只有你明确授权的机器人才会触发这个插件。

## 为什么需要这个？

假设你有两个机器人：
- **Bot A**：客服机器人，只处理客服相关的事情
- **Bot B**：游戏机器人，只处理游戏相关的事情

如果没有 Bot Scope，所有插件会在两个机器人上都生效。有了 Bot Scope，你可以让客服插件只在 Bot A 上运行，游戏插件只在 Bot B 上运行。

## 怎么设置？

### 方法 1：通过 Web 控制台

1. 打开 Dian 的 Web 控制台
2. 找到你要设置的插件
3. 点击「Bot Scope」设置
4. 勾选要启用的机器人

### 方法 2：通过配置文件

编辑 `config/plugin-scope.json`：

```json
{
  "客服插件": ["bot-a"],
  "游戏插件": ["bot-b"],
  "通用插件": ["bot-a", "bot-b"]
}
```

**说明：**
- `客服插件` 只在 `bot-a` 上生效
- `游戏插件` 只在 `bot-b` 上生效
- `通用插件` 在两个机器人上都生效

### 方法 3：通过 API

```bash
# 设置插件的 Bot Scope
curl -X POST http://localhost:3000/api/plugins/我的插件/scope \
  -H "Content-Type: application/json" \
  -d '{"botIds": ["bot-a", "bot-b"]}'
```

## 注意事项

1. **空数组 = 禁用** — 如果 Bot Scope 是空数组 `[]`，插件对所有机器人都不生效
2. **未设置 = 禁用** — 如果插件没有设置 Bot Scope，同样对所有机器人都不生效
3. **必须明确授权** — 只有在白名单里的机器人才会触发插件

## 常见问题

### 插件没有响应？

1. 检查插件是否已启用
2. 检查 Bot Scope 是否包含当前机器人
3. 检查机器人 ID 是否正确
4. 查看终端输出有没有报错

### 怎么查看机器人的 ID？

```bash
# 查看所有机器人
curl http://localhost:3000/api/bots
```

### 怎么重置 Bot Scope？

删除 `config/plugin-scope.json`，或者通过 API 设置为空数组：

```bash
curl -X POST http://localhost:3000/api/plugins/我的插件/scope \
  -H "Content-Type: application/json" \
  -d '{"botIds": []}'
```

## 使用场景

### 场景 1：多机器人环境

```
Bot A（客服）
  ├─ 客服插件 ✅
  ├─ 欢迎插件 ✅
  └─ 游戏插件 ❌

Bot B（游戏）
  ├─ 客服插件 ❌
  ├─ 欢迎插件 ❌
  └─ 游戏插件 ✅
```

### 场景 2：测试环境

```
Test Bot（测试）
  ├─ 新功能插件 ✅
  └─ 生产插件 ❌

Prod Bot（生产）
  ├─ 新功能插件 ❌
  └─ 生产插件 ✅
```

## 下一步

现在你已经掌握了所有进阶功能，可以：
- 回到 [快速开始](/guide/quick-start) 创建你的第一个插件
- 查看 [API 参考](/api/decorators) 了解更多 API
