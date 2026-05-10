# ---- 构建阶段 ----
FROM node:22-alpine AS builder

WORKDIR /app

# 安装依赖（--ignore-scripts 跳过原生模块编译，web 构建不需要）
COPY . .
RUN npm ci --ignore-scripts

# 构建 web
WORKDIR /app/apps/web
RUN npm run build

# ---- 运行阶段 ----
FROM nginx:1.27-alpine

COPY --from=builder /app/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
