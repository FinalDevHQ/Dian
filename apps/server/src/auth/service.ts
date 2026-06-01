import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { randomBytes } from "node:crypto";
import type { AuthConfig } from "@myfinal/config";

export interface TokenPayload {
  role: "admin";
  iat: number;
  exp: number;
}

export class AuthService {
  private passwordHash: string;
  private jwtSecret: string;
  private tokenExpiresIn: number;

  constructor(config: AuthConfig, opts?: { onGenerateJwtSecret?: (secret: string) => void }) {
    // 优先级：DIAN_PASSWORD（明文）> DIAN_PASSWORD_HASH > settings.yaml > 空（禁用认证）
    if (process.env.DIAN_PASSWORD) {
      // 明文密码同步哈希，启动时立即生效，无竞态条件
      this.passwordHash = bcrypt.hashSync(process.env.DIAN_PASSWORD, 10);
      console.log("[Auth] 已从环境变量 DIAN_PASSWORD 设置密码");
    } else {
      this.passwordHash =
        process.env.DIAN_PASSWORD_HASH ?? config.passwordHash ?? "";
    }

    // JWT 密钥：优先环境变量，其次配置文件，最后自动生成并持久化
    if (process.env.DIAN_JWT_SECRET) {
      this.jwtSecret = process.env.DIAN_JWT_SECRET;
    } else if (config.jwtSecret) {
      this.jwtSecret = config.jwtSecret;
    } else {
      this.jwtSecret = randomBytes(32).toString("hex");
      // 持久化到配置文件，避免重启后所有 token 失效
      opts?.onGenerateJwtSecret?.(this.jwtSecret);
    }

    this.tokenExpiresIn = config.tokenExpiresIn ?? 86400;
  }

  /** 检查是否已配置密码 */
  isConfigured(): boolean {
    return this.passwordHash.length > 0;
  }

  /** 验证密码 */
  async verifyPassword(password: string): Promise<boolean> {
    if (!this.isConfigured()) return false;
    return bcrypt.compare(password, this.passwordHash);
  }

  /** 签发 JWT */
  signToken(): string {
    return jwt.sign({ role: "admin" }, this.jwtSecret, {
      expiresIn: this.tokenExpiresIn,
    });
  }

  /** 验证 JWT，返回 payload 或 null */
  verifyToken(token: string): TokenPayload | null {
    try {
      return jwt.verify(token, this.jwtSecret) as TokenPayload;
    } catch {
      return null;
    }
  }
}
