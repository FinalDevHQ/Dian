# Dian UI/UX 美化计划

> 项目：Vite 8 + React 19 + Tailwind CSS v4 + shadcn/ui v4
> 审查日期：2026-06-05

---

## P0 — 必须优先完成

### ❷ 主题配色优化

- [ ] 将 `--primary` 从纯灰调整为紫色系（violet-600）
- [ ] 更新 `--primary-foreground` 为白色
- [ ] 将 `--chart-1` ~ `--chart-5` 改为多彩配色（violet, sky, emerald, amber, rose）
- [ ] 验证所有 `bg-primary` / `text-primary` 组件的视觉效果

**文件**：`apps/web/src/index.css`

### ❹ 字号提升

- [ ] 正文文本底线从 `[11px]`/`[12px]` 提升到 `text-xs`(12px)/`text-sm`(14px)
- [ ] Dashboard 统计卡片 label `text-[11px]` → `text-xs`
- [ ] Dashboard 子信息 `text-[10px]` → `text-xs`
- [ ] Market 标签 `text-[10px]` → `text-xs`
- [ ] Market 版本号 `text-[11px]` → `text-xs`
- [ ] Plugins 列表元信息 `text-[10px]` → `text-xs`
- [ ] Logs 底部信息 `text-[11px]` → `text-xs`
- [ ] Analytics 底部提示 `text-xs` 保持不变（已达标）
- [ ] Config 底部提示 `text-[11px]` → `text-xs`
- [ ] Database 底部信息 `text-[10px]`/`text-[11px]` → `text-xs`
- [ ] 移动端确保正文 `font-size >= 16px` 防止 iOS 自动缩放

**文件**：`apps/web/src/pages/dashboard.tsx`, `market.tsx`, `plugins.tsx`, `logs.tsx`, `config-files.tsx`, `database.tsx`

---

## P1 — 重要改进

### ❶ 深色模式开关

- [ ] 新建 `useTheme` hook，管理 `dark` class + `localStorage` 持久化
- [ ] 尊重 `prefers-color-scheme` 作为初始默认值
- [ ] 在 Header（`app-layout.tsx`）退出按钮旁添加 Sun/Moon 切换按钮
- [ ] 确保所有 glassmorphic 卡片在深色模式下透明度/对比度正确
- [ ] 检查 `backdrop-blur` 在深色背景下的表现
- [ ] 修复 Analytics 页硬编码 `dark:` class 的一致性

**文件**：`apps/web/src/hooks/use-theme.ts`(新建), `apps/web/src/components/layout/app-layout.tsx`, `apps/web/src/index.css`

### ❸ 卡片风格统一

- [ ] 提取 `GlassCard` 工具组件或 `@utility glass-card` CSS class
- [ ] 统一样式：`rounded-2xl border-gray-200/50 bg-white/60 backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg`
- [ ] Dashboard 页：已达标，无需修改
- [ ] Analytics 页：概览卡片、趋势图卡片、群组/用户图表卡片 → 应用 glassmorphic
- [ ] Database 页：数据源/表/表结构/SQL 编辑器/结果卡片 → 应用 glassmorphic
- [ ] Config 页：文件列表/编辑器卡片 → 应用 glassmorphic
- [ ] Plugins 页：左侧列表/右侧详情卡片 → 应用 glassmorphic
- [ ] Logs 页：工具栏/事件流容器 → 应用 subtle glassmorphic
- [ ] Market 页：保持独特风格（已有渐变装饰条），仅微调统一 border-radius

**文件**：`apps/web/src/pages/analytics.tsx`, `database.tsx`, `config-files.tsx`, `plugins.tsx`, `logs.tsx`

### ❼ Login 页美化

- [ ] 添加 subtle gradient mesh 背景装饰
- [ ] 居中卡片改为 glassmorphic 风格（`bg-white/80 backdrop-blur`）
- [ ] 顶部添加品牌 Logo（渐变方块 + "D" 字母，复用 sidebar 样式）
- [ ] 添加 "OneBot Framework" 副标题
- [ ] 登录按钮使用品牌紫渐变色（`from-violet-500 to-indigo-500`）
- [ ] 添加 `prefers-reduced-motion` 检测

**文件**：`apps/web/src/pages/login.tsx`

---

## P2 — 细节打磨

### ❺ 日志页 Emoji → SVG 图标

- [ ] `face` 段：`😀` → `<Smile>` icon
- [ ] `record` 段：`🎤` → `<Mic>` icon
- [ ] `video` 段：`🎬` → `<Video>` icon
- [ ] `file` 段：`📎` → `<Paperclip>` icon
- [ ] `share` 段：`🔗` → `<Link>` icon
- [ ] 统一 icon size 为 `size-3` 或 `size-3.5`

**文件**：`apps/web/src/pages/logs.tsx`

### ❻ cursor-pointer 补全

- [ ] Market 标签筛选 pill 按钮
- [ ] Market 刷新按钮
- [ ] Analytics 时间范围选择器按钮
- [ ] Analytics 图表柱状图交互（已部分实现）
- [ ] Database 数据源/表选择列表项
- [ ] Config 文件列表项
- [ ] Plugins 列表项按钮（已用 `<button>`，检查 cursor）

**文件**：`apps/web/src/pages/market.tsx`, `analytics.tsx`, `database.tsx`, `config-files.tsx`, `plugins.tsx`

### ❽ Analytics 细节优化

- [ ] 机器人分布进度条：纯色 → 渐变（`from-amber-400 to-orange-400`）
- [ ] 图表 Cell 硬编码 `hsl()` → CSS 变量引用
- [ ] 同步群名横幅移除硬编码 `dark:` class（或等深色模式完成后统一）
- [ ] 概览卡片添加 icon 背景色块（参考 Dashboard 的 `OverviewStat`）

**文件**：`apps/web/src/pages/analytics.tsx`

### ❾ 响应式布局修复

- [ ] `plugins.tsx`：`< 768px` 时左右分栏改为上下堆叠
- [ ] `database.tsx`：同上处理
- [ ] `config-files.tsx`：同上处理
- [ ] Market 卡片：窄屏改为 `grid-cols-1 sm:grid-cols-2`
- [ ] 利用已有的 `useIsMobile()` hook 切换布局

**文件**：`apps/web/src/pages/plugins.tsx`, `database.tsx`, `config-files.tsx`, `market.tsx`

---

## P3 — 锦上添花

### ❿ 动画增强

- [ ] 页面切换添加 `fade-in` 微动画（150-200ms）
- [ ] 骨架屏从 `animate-pulse` 升级为 shimmer gradient 光效
- [ ] 数字更新添加 `tabular-nums` + 过渡效果
- [ ] 全局检查 `prefers-reduced-motion`，满足时禁用所有动画

**文件**：`apps/web/src/index.css`, `apps/web/src/components/ui/skeleton.tsx`, 各页面

### ⓫ 空状态增强

- [ ] 新建统一 `EmptyState` 组件（icon + 标题 + 描述 + 可选 action 按钮）
- [ ] Dashboard 无插件 → "前往市场安装" 引导
- [ ] Database 无数据源 → 配置引导
- [ ] Messages 无消息 → "等待事件流" 插图
- [ ] Plugins 无插件 → "上传或浏览市场" 引导
- [ ] Market 无搜索结果 → 更友好的提示

**文件**：`apps/web/src/components/empty-state.tsx`(新建), `apps/web/src/pages/*.tsx`

---

## 进度追踪

| 项 | 状态 | 备注 |
|----|------|------|
| ❷ 主题配色 | ✅ 已完成 | primary→violet, chart→多彩 |
| ❹ 字号提升 | ✅ 已完成 | 8个文件, 消除所有text-[10-13px] |
| ❶ 深色模式 | ⬜ 未开始 | |
| ❸ 卡片统一 | ⬜ 未开始 | |
| ❼ Login 美化 | ⬜ 未开始 | |
| ❺ Emoji→SVG | ⬜ 未开始 | |
| ❻ cursor-pointer | ⬜ 未开始 | |
| ❽ Analytics 细节 | ⬜ 未开始 | |
| ❾ 响应式布局 | ⬜ 未开始 | |
| ❿ 动画增强 | ⬜ 未开始 | |
| ⓫ 空状态增强 | ⬜ 未开始 | |
