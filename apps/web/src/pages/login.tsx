import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

interface LoginPageProps {
  onLogin: (token: string) => void;
}

export function LoginPage({ onLogin }: LoginPageProps) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "登录失败");
        return;
      }

      onLogin(data.token);
    } catch {
      setError("网络错误，请重试");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-background p-4 overflow-hidden">
      {/* 背景装饰 */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-1/4 -left-1/4 h-[600px] w-[600px] rounded-full bg-violet-400/10 blur-3xl dark:bg-violet-600/10" />
        <div className="absolute -bottom-1/4 -right-1/4 h-[500px] w-[500px] rounded-full bg-indigo-400/10 blur-3xl dark:bg-indigo-600/10" />
        <div className="absolute top-1/2 left-1/2 h-[400px] w-[400px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-pink-400/8 blur-3xl dark:bg-pink-600/8" />
      </div>

      <Card className="relative w-full max-w-sm overflow-hidden rounded-2xl border-gray-200/60 bg-white/80 backdrop-blur-md shadow-xl dark:border-gray-700/60 dark:bg-gray-900/80 dark:shadow-2xl">
        {/* 顶部渐变装饰条 */}
        <div className="h-1 w-full bg-gradient-to-r from-pink-400 via-violet-400 to-indigo-400" />

        <CardHeader className="text-center pt-8 pb-4">
          {/* 品牌 Logo */}
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-pink-400 via-violet-400 to-indigo-400 text-white shadow-lg shadow-violet-400/25">
            <span className="text-2xl font-bold">D</span>
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">Dian</CardTitle>
          <CardDescription className="text-sm">OneBot Framework · 管理面板</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">密码</Label>
              <Input
                id="password"
                type="password"
                placeholder="请输入密码"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
                disabled={loading}
                className="h-10 rounded-xl"
              />
            </div>

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            <Button
              type="submit"
              className="h-10 w-full rounded-xl bg-gradient-to-r from-violet-500 to-indigo-500 text-white shadow-sm shadow-violet-200/50 transition-all hover:from-violet-600 hover:to-indigo-600 hover:shadow-md dark:shadow-violet-900/25"
              disabled={loading}
            >
              {loading ? "登录中..." : "登录"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
