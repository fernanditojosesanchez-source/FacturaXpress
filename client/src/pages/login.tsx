import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Lock, User, ArrowRight, Loader2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { NeexumBackground } from "@/components/branding/NeexumBackground";

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
    <NeexumBackground>
      <div className="w-full max-w-[440px] space-y-1 animate-in fade-in slide-in-from-bottom-4 duration-1000">
        {/* Branding Container */}
        <div className="flex flex-col items-center justify-center text-center space-y-0 mb-2">
          <div className="transition-all duration-1000 hover:scale-[1.03]">
            <img
              src="/neexum_final_logo.png"
              alt="NEEXUM Logo"
              className="h-36 md:h-48 w-auto object-contain brightness-105 drop-shadow-[0_22px_44px_rgba(66,165,165,0.15)]"
            />
          </div>
          <p className="text-[10px] md:text-[12px] font-black text-[#42a5a5] uppercase tracking-[0.8em] opacity-90 -mt-1 pl-[0.8em]">
            Potencia Fiscal • Ecosistema Digital
          </p>
        </div>

        <Card className="border-white/60 bg-white/70 backdrop-blur-2xl rounded-[2.5rem] shadow-[0_32px_64px_-24px_rgba(0,0,0,0.06)] border overflow-hidden">
          <CardContent className="p-7 md:p-9">
            <div className="mb-4 text-center">
              <h2 className="text-2xl font-black text-slate-800 tracking-tight leading-none">Bienvenido</h2>
              <p className="text-[11px] font-medium text-slate-400 mt-1.5">Acceso Seguro al Núcleo de Facturación</p>
            </div>

            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-2.5">
                <Label className="text-[11px] font-black uppercase tracking-widest text-[#42a5a5] ml-1">Identificación</Label>
                <div className="relative group/input">
                  <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none">
                    <User className="h-6 w-6 text-slate-400 group-focus-within/input:text-[#42a5a5] transition-colors" />
                  </div>
                  <Input
                    value={usernameOrEmail}
                    onChange={(e) => setUsernameOrEmail(e.target.value)}
                    placeholder="Usuario o email"
                    className="pl-14 h-16 bg-white/50 border-slate-200 focus:ring-[#42a5a5]/30 focus:border-[#42a5a5]/30 transition-all font-medium text-slate-800 placeholder:text-slate-400 shadow-sm text-base"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2.5">
                <Label className="text-[11px] font-black uppercase tracking-widest text-[#42a5a5] ml-1">Contraseña Segura</Label>
                <div className="relative group/input">
                  <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none">
                    <Lock className="h-6 w-6 text-slate-400 group-focus-within/input:text-[#42a5a5] transition-colors" />
                  </div>
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="pl-14 h-16 bg-white/50 border-slate-200 focus:ring-[#42a5a5]/30 focus:border-[#42a5a5]/30 transition-all text-slate-800 placeholder:text-slate-400 shadow-sm text-base"
                    required
                  />
                </div>
              </div>

              {error && (
                <div className="p-4 rounded-2xl bg-red-500/5 border border-red-500/10 text-red-600 text-xs font-bold animate-shake">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                className="w-full h-[64px] rounded-2xl bg-[#0a2540] hover:bg-[#0a2540]/90 text-white transition-all duration-300 font-bold tracking-tight text-lg shadow-xl shadow-[#0a2540]/10 group"
                disabled={login.isPending}
              >
                {login.isPending ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : (
                  <span className="flex items-center justify-center">
                    INGRESAR <ArrowRight className="ml-2 h-6 w-6 group-hover:translate-x-1 transition-transform" />
                  </span>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Footer info */}
        <div className="text-center space-y-2">
          <p className="text-[11px] text-slate-400 font-bold uppercase tracking-[0.2em]">FS Digital // NEEXUM Core</p>
          <div className="flex justify-center gap-4 text-[11px] font-medium text-slate-300">
            <span>v3.0 DTE Ready</span>
            <span>•</span>
            <span>Secure Tunnel</span>
          </div>
        </div>
      </div>
    </NeexumBackground>
  );
}
