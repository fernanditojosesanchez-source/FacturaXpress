import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Login() {
  const { login } = useAuth();
  const [usernameOrEmail, setUsernameOrEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await login.mutateAsync({ usernameOrEmail, password });
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div className="fixed inset-0 backdrop-blur-md bg-black/10 flex items-center justify-center">
      <Card
        className="w-full max-w-sm backdrop-blur-sm border border-white/70 bg-white/90 shadow-[0_24px_60px_rgba(42,32,20,0.14)]"
        style={{
          boxShadow:
            "0 24px 60px rgba(42, 32, 20, 0.14), inset 0 1px 0 rgba(255, 255, 255, 0.55)",
        }}
      >
        <CardHeader>
          <CardTitle>Iniciar Sesión</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium">Usuario o Email</label>
              <Input
                value={usernameOrEmail}
                onChange={(e) => setUsernameOrEmail(e.target.value)}
                placeholder="admin o email@ejemplo.com"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Contraseña</label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            {error && (
              <div className="text-red-600 text-sm">{error}</div>
            )}
            <Button type="submit" className="w-full" disabled={login.isPending}>
              {login.isPending ? "Accediendo..." : "Entrar"}
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              Usuario de prueba: admin / admin
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
