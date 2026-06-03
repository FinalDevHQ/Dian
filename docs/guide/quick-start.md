# 快速开始

本教程会带你从零创建第一个 Dian 插件。跟着做，5 分钟就能跑起来。

## 你需要什么

- **Node.js**：20 LTS 或更高
- 一个能用的 Dian 实例（已经跑起来了）

## 第一步：复制模板

Dian 自带了一个插件模板，直接复制一份就行：

```bash
# 进入 Dian 项目目录
cd 你的Dian目录

# 复制模板到 plugins 文件夹
cp -r my-plugin/Dian-plugin-template plugins/hello-plugin
```

复制完后，你的 `plugins` 文件夹里会多出一个 `hello-plugin` 目录。

## 第二步：改插件名字

打开 `plugins/hello-plugin/src/index.ts`，找到最上面的 `@Plugin` 部分：

```typescript
@Plugin({
  name: "hello-plugin",        // ← 改成你喜欢的名字（英文小写加横杠）
  description: "我的第一个插件", // ← 写个简单描述
  version: "1.0.0",
  author: "你的名字",
  icon: "👋",                 // ← 可以换成任何 emoji
})
```

## 第三步：改触发词和回复

继续往下看，找到 `onSetup` 方法里的 `ctx.command`：

```typescript
ctx.command({
  name: "你好",
  pattern: () => "你好",      // ← 用户发送什么消息会触发
  description: "打招呼",       // ← 帮助菜单里显示的说明
  category: "基础",
  handler: async (c: EventContext) => {
    await c.reply("你好！我是我的第一个插件！");  // ← 插件回复的内容
  },
});
```

你可以把 `"你好"` 改成任何你想要的触发词，比如 `"hello"`、`"打卡"` 等。

## 第四步：安装依赖并构建

```bash
# 进入插件目录
cd plugins/hello-plugin

# 安装依赖
npm install

# 构建插件
npm run build
```

构建成功后，`dist` 文件夹里会出现一个 `index.js` 文件，这就是插件本体。

## 第五步：重启 Dian

重启你的 Dian 服务，插件会自动加载。

## 第六步：测试

给机器人发一条消息：

```
你好
```

如果一切正常，你会收到回复：

```
你好！我是我的第一个插件！
```

🎉 恭喜！你的第一个插件跑起来了！

---

## 下一步

现在你已经有了一个能跑的插件，可以继续学习：

- [项目结构](/guide/project-structure) — 了解插件里每个文件是干嘛的
- [插件生命周期](/guide/plugin-lifecycle) — 了解插件是怎么加载和运行的
- [API 参考](/api/decorators) — 查看所有可用的装饰器和方法

---

## 遇到问题？

**插件没加载？**
- 检查 `plugins/hello-plugin/dist/index.js` 是否存在
- 重启 Dian 服务
- 查看终端输出有没有报错

**发消息没反应？**
- 确认触发词是不是你设置的那个（区分大小写）
- 检查机器人有没有在对应的群里
