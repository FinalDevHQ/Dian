# ---- 构建阶段 ----
FROM node:22-alpine AS builder

WORKDIR /app

# better-sqlite3 需要原生编译工具
RUN apk add --no-cache python3 make g++

# 复制整个 monorepo（.dockerignore 已排除无用文件）
COPY . .

# 安装全部依赖（包含原生模块编译）
RUN npm ci

# 构建 packages/* 和 apps/server
RUN npm run build -w packages
RUN npm run build -w apps/server

# ---- 运行阶段 ----
FROM node:22-alpine AS runtime

WORKDIR /app

# 运行时同样需要 better-sqlite3 的原生库
RUN apk add --no-cache python3 make g++

# 复制 workspace 根文件（用于依赖解析）
COPY --from=builder /app/package.json /app/package-lock.json ./

# 复制所有包（含编译产物）
COPY --from=builder /app/packages ./packages

# 复制 server 编译产物
COPY --from=builder /app/apps/server/dist ./apps/server/dist
COPY --from=builder /app/apps/server/package.json ./apps/server/package.json

# 复制 node_modules（含编译好的原生模块）
COPY --from=builder /app/node_modules ./node_modules

# 运行时目录（通过 volume 挂载）
RUN mkdir -p config plugins data

EXPOSE 3000

CMD ["node", "apps/server/dist/main.js"]
