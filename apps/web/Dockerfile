# ---- 构建阶段 ----
FROM node:22-alpine AS builder

WORKDIR /app

# ① 先复制 package.json，缓存依赖安装层
COPY package.json package-lock.json ./
COPY apps/web/package.json ./apps/web/package.json
# workspace 中其他包的 package.json（npm workspaces 解析需要）
COPY packages/package.json                   ./packages/package.json
COPY packages/config/package.json            ./packages/config/package.json
COPY packages/logger/package.json            ./packages/logger/package.json
COPY packages/module-runtime/package.json    ./packages/module-runtime/package.json
COPY packages/plugin-runtime/package.json    ./packages/plugin-runtime/package.json
COPY packages/sdk/package.json               ./packages/sdk/package.json
COPY packages/shared/package.json            ./packages/shared/package.json
COPY packages/storage/package.json           ./packages/storage/package.json
COPY apps/server/package.json                ./apps/server/package.json

# ② 安装依赖（可缓存）
RUN npm ci --ignore-scripts

# ③ 复制源码
COPY apps/web ./apps/web

# ④ 构建
RUN npm run build -w apps/web

# ---- 运行阶段 ----
FROM nginx:1.27-alpine

COPY --from=builder /app/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
