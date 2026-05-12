import { createContext, useContext, useEffect, useState, useCallback } from "react";
import type { ReactNode } from "react";

const TOKEN_KEY = "dian_token";

interface AuthContextValue {
  token: string | null;
  isAuthenticated: boolean;
  needAuth: boolean;
  loading: boolean;
  login: (token: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem(TOKEN_KEY)
  );
  const [needAuth, setNeedAuth] = useState(true);
  const [loading, setLoading] = useState(true);

  // 检查是否需要认证，并在需要时验证已有 token
  useEffect(() => {
    const storedToken = localStorage.getItem(TOKEN_KEY);

    fetch("/api/auth/check")
      .then((res) => res.json())
      .then(async (data: { needAuth: boolean }) => {
        setNeedAuth(data.needAuth);

        // 如果需要认证且本地有 token，验证其有效性
        if (data.needAuth && storedToken) {
          try {
            const validateRes = await fetch("/api/auth/validate", {
              headers: { Authorization: `Bearer ${storedToken}` },
            });
            if (!validateRes.ok) {
              // token 无效或已过期，清除
              localStorage.removeItem(TOKEN_KEY);
              setToken(null);
            }
          } catch {
            // 验证请求失败，清除 token 以强制重新登录
            localStorage.removeItem(TOKEN_KEY);
            setToken(null);
          }
        }
      })
      .catch(() => {
        // 服务器不可达时保持需要认证（needAuth = true），不允许绕过登录
        setNeedAuth(true);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const login = useCallback((newToken: string) => {
    localStorage.setItem(TOKEN_KEY, newToken);
    setToken(newToken);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        token,
        isAuthenticated: !!token,
        needAuth,
        loading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
