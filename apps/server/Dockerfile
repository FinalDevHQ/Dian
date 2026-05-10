# ---- 构建阶段 ----
FROM node:22-alpine AS builder

WORKDIR /app

# 原生模块编译工具（better-sqlite3）
RUN apk add --no-cache python3 make g++

# ① 先只复制 package.json / package-lock.json，利用 Docker 层缓存
#    只要依赖声明没变，npm ci 这一层就会命中缓存，不需要重新安装
COPY package.json package-lock.json ./

COPY packages/package.json                   ./packages/package.json
COPY packages/config/package.json            ./packages/config/package.json
COPY packages/logger/package.json            ./packages/logger/package.json
COPY packages/module-runtime/package.json    ./packages/module-runtime/package.json
COPY packages/plugin-runtime/package.json    ./packages/plugin-runtime/package.json
COPY packages/sdk/package.json               ./packages/sdk/package.json
COPY packages/shared/package.json            ./packages/shared/package.json
COPY packages/storage/package.json           ./packages/storage/package.json
COPY apps/server/package.json                ./apps/server/package.json

# ② 安装依赖（此层可被缓存，改代码不影响）
RUN npm ci

# ③ 复制源码
COPY packages  ./packages
COPY apps/server ./apps/server

# ④ 编译
RUN npm run build -w packages
RUN npm run build -w apps/server

# ---- 运行阶段 ----
FROM node:22-alpine AS runtime

WORKDIR /app

# 直接从 builder 复制已编译的 node_modules（含原生二进制），无需重装编译工具
COPY --from=builder /app/package.json        ./
COPY --from=builder /app/node_modules        ./node_modules
COPY --from=builder /app/packages            ./packages
COPY --from=builder /app/apps/server/dist    ./apps/server/dist
COPY --from=builder /app/apps/server/package.json ./apps/server/package.json

# 运行时目录（通过 volume 挂载）
RUN mkdir -p config plugins data

EXPOSE 3000

CMD ["node", "apps/server/dist/main.js"]
