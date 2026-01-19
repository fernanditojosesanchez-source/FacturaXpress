import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Lock, User, ShieldCheck, ArrowRight, Loader2 } from "lucide-react";
import { Label } from "@/components/ui/label";

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
    <div className="flex items-center justify-center min-h-[90vh] px-4">
      <div className="w-full max-w-md space-y-8 animate-fade-in-up">
        {/* Branding Hub */}
        <div className="text-center space-y-2">
          <div className="inline-flex p-4 rounded-3xl bg-white/40 backdrop-blur-3xl border border-white/60 shadow-[0_20px_40px_rgba(0,0,0,0.05)] mb-4">
            <ShieldCheck className="h-12 w-12 text-blue-600 drop-shadow-lg" strokeWidth={2.5} />
          </div>
          <h1 className="text-6xl font-black italic tracking-tighter text-slate-800 drop-shadow-sm">
            NEE<span className="text-blue-600">XUM</span>
          </h1>
          <p className="text-[10px] font-black text-blue-600/60 uppercase tracking-[0.2em] max-w-[280px] mx-auto leading-relaxed">
            Núcleo Empresarial de EXpedición Unificada y Mercantil
          </p>
          <div className="pt-2">
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.4em]">Digital Ecosystem // Auth Core</p>
          </div>
        </div>

        <Card
          className="relative overflow-hidden border border-white/60 bg-white/30 backdrop-blur-[40px] rounded-[3rem] shadow-[0_40px_100px_-20px_rgba(0,0,0,0.1)] group transition-all duration-700"
          style={{
            boxShadow: "0 40px 100px -20px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255, 255, 255, 0.8)"
          }}
        >
          {/* Accent decoration */}
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl group-hover:bg-blue-500/20 transition-all duration-700" />

          <CardHeader className="text-center pb-2">
            <CardTitle className="text-2xl font-black italic tracking-tight text-slate-800 uppercase">Bienvenido</CardTitle>
            <p className="text-xs text-slate-500 font-medium">Ingresa tus credenciales de acceso</p>
          </CardHeader>

          <CardContent>
            <form onSubmit={onSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-2">Usuario o Email</Label>
                <div className="relative group/input">
                  <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                    <User className="h-5 w-5 text-slate-400 group-focus-within/input:text-blue-500 transition-colors" />
                  </div>
                  <Input
                    value={usernameOrEmail}
                    onChange={(e) => setUsernameOrEmail(e.target.value)}
                    placeholder="admin"
                    className="pl-14 h-14 bg-white/20 border-white/40 rounded-2xl focus:ring-blue-500/50 focus:border-blue-500/30 transition-all font-bold tracking-tight text-lg shadow-inner"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-2">Contraseña Segura</Label>
                <div className="relative group/input">
                  <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-slate-400 group-focus-within/input:text-blue-500 transition-colors" />
                  </div>
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="pl-14 h-14 bg-white/20 border-white/40 rounded-2xl focus:ring-blue-500/50 focus:border-blue-500/30 transition-all font-mono text-xl tracking-[0.3em] shadow-inner"
                    required
                  />
                </div>
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-600 p-4 rounded-2xl text-sm font-bold animate-shake text-center">
                  ⚠️ {error}
                </div>
              )}

              <Button
                type="submit"
                className="w-full h-16 rounded-2xl bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 hover:scale-[1.02] active:scale-95 transition-all duration-500 font-black italic tracking-tighter text-xl shadow-[0_20px_40px_rgba(59,130,246,0.3)] border border-white/20"
                disabled={login.isPending}
              >
                {login.isPending ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : (
                  <span className="flex items-center justify-center">
                    ENTRAR AL SISTEMA <ArrowRight className="ml-3 h-6 w-6" />
                  </span>
                )}
              </Button>

              <div className="text-center pt-2">
                <p className="text-[10px] font-black italic text-slate-400 tracking-wider">
                  USUARIO DE PRUEBA: <span className="text-blue-500/60">admin / admin</span>
                </p>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Footer info */}
        <div className="text-center">
          <p className="text-[10px] text-slate-400 font-medium">© 2026 FS Digital // All Rights Reserved</p>
        </div>
      </div>
    </div>
  );
}
