import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { randomBytes } from "node:crypto";
import type { AuthConfig } from "@dian/config";

export interface TokenPayload {
  role: "admin";
  iat: number;
  exp: number;
}

export class AuthService {
  private passwordHash: string;
  private jwtSecret: string;
  private tokenExpiresIn: number;

  constructor(config: AuthConfig) {
    // 密码哈希：优先环境变量，其次配置文件
    this.passwordHash =
      process.env.DIAN_PASSWORD_HASH ?? config.passwordHash ?? "";

    // JWT 密钥：优先环境变量，其次配置文件，最后自动生成
    this.jwtSecret =
      process.env.DIAN_JWT_SECRET ??
      config.jwtSecret ??
      randomBytes(32).toString("hex");

    this.tokenExpiresIn = config.tokenExpiresIn ?? 86400;

    // 如果设置了明文环境变量，自动哈希并提示
    if (process.env.DIAN_PASSWORD && !this.passwordHash) {
      bcrypt.hash(process.env.DIAN_PASSWORD, 10).then((hash) => {
        this.passwordHash = hash;
        console.log(
          "[Auth] 已从 DIAN_PASSWORD 生成密码哈希，建议写入 settings.yaml:\n" +
            `  passwordHash: "${hash}"`
        );
      });
    }
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
