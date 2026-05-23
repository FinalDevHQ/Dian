---
layout: home

hero:
  name: "Dian"
  text: "插件开发文档"
  tagline: 简单易用的插件系统，让你快速扩展 Dian 的功能
  actions:
    - theme: brand
      text: 5 分钟快速开始 →
      link: /guide/quick-start
    - theme: alt
      text: 查看示例
      link: /examples/hello-world
    - theme: alt
      text: API 参考
      link: /api/decorators

features:
  - title: 简单
    details: 使用装饰器声明式开发，几行代码就能创建一个插件
  - title: 快速
    details: 热重载支持，修改代码后立即生效，开发体验流畅
  - title: 类型安全
    details: 完整的 TypeScript 支持，IDE 自动补全，减少错误
  - title: 功能丰富
    details: 支持指令、HTTP API、Web UI、数据库存储等功能
  - title: 易于部署
    details: 插件是单个 JS 文件，复制到 plugins 目录就能用
  - title: 社区驱动
    details: 开源项目，欢迎贡献代码和插件
---

## 快速体验

```bash
# 复制插件模板
cp -r my-plugin/Dian-plugin-template plugins/my-plugin

# 安装依赖
cd plugins/my-plugin && npm install

# 构建插件
npm run build

# 重启 Dian，插件自动加载
```

## 想了解更多？

- [快速开始](/guide/quick-start) — 从零创建第一个插件
- [项目结构](/guide/project-structure) — 了解插件的文件结构
- [API 参考](/api/decorators) — 查看所有可用的 API
- [示例代码](/examples/hello-world) — 完整的插件示例
