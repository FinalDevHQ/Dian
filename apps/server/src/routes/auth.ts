import type { FastifyInstance } from "fastify";
import type { AuthService } from "../auth/service.js";

export interface AuthRouteOptions {
  authService: AuthService;
}

export async function authRoutes(
  app: FastifyInstance,
  opts: AuthRouteOptions
) {
  const { authService } = opts;

  // POST /auth/login — 登录
  app.post<{ Body: { password: string } }>("/auth/login", async (request, reply) => {
    const { password } = request.body ?? {};

    if (!password || typeof password !== "string") {
      return reply.status(400).send({ error: "请输入密码" });
    }

    // 未配置密码时拒绝登录
    if (!authService.isConfigured()) {
      return reply.status(500).send({ error: "未配置密码，请在 settings.yaml 或环境变量中设置" });
    }

    const valid = await authService.verifyPassword(password);
    if (!valid) {
      return reply.status(401).send({ error: "密码错误" });
    }

    const token = authService.signToken();
    return { token };
  });

  // GET /auth/check — 检查是否需要登录（前端用）
  app.get("/auth/check", async () => {
    return { needAuth: authService.isConfigured() };
  });

  // GET /auth/validate — 验证当前 token 是否有效（需要认证）
  app.get("/auth/validate", async () => {
    // 能到这里说明中间件已通过验证
    return { valid: true };
  });
}
