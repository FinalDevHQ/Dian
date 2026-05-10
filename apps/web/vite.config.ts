import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, ""),
      },
      // 插件 UI 静态文件 + 插件自注册 API 路由，直连后端
      "/plugins": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
})