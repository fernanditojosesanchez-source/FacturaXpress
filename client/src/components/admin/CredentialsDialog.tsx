import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { FileUp, Loader2, Lock, ShieldCheck } from "lucide-react";
import { Tenant } from "./TenantTable";

interface CredentialsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenant: Tenant | null;
}

export function CredentialsDialog({
  open,
  onOpenChange,
  tenant,
}: CredentialsDialogProps) {
  const { toast } = useToast();
  const [mhPass, setMhPass] = useState("");
  const [certPass, setCertPass] = useState("");
  const [p12File, setP12File] = useState<File | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!tenant) return;
      if (!p12File) throw new Error("Debes seleccionar un archivo .p12");

      // Convertir archivo a Base64
      const p12Base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(p12File);
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(",")[1]);
        };
        reader.onerror = (error) => reject(error);
      });

      const res = await fetch(`/api/admin/tenants/${tenant.id}/credentials`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mhUsuario: "", // Opcional por ahora
          mhPass,
          certificadoPass: certPass,
          certificadoP12: p12Base64,
          ambiente: "pruebas",
        }),
      });

      if (!res.ok) throw new Error((await res.json()).message);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Configurado", description: "Credenciales guardadas y encriptadas." });
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", title: "Error", description: err.message });
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setP12File(e.target.files[0]);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl bg-black/60 border-white/10 text-white backdrop-blur-[50px] rounded-[2.5rem] shadow-[0_50px_100px_-20px_rgba(0,0,0,0.8)]">
        <DialogHeader>
          <div className="flex items-center space-x-4 mb-4">
            <div className="p-4 rounded-2xl bg-amber-500/20 border border-amber-500/30 backdrop-blur-xl shadow-[0_0_20px_rgba(245,158,11,0.2)]">
              <ShieldCheck className="h-8 w-8 text-amber-500" />
            </div>
            <div>
              <DialogTitle className="text-4xl font-black italic tracking-tighter">API HACIENDA</DialogTitle>
              <DialogDescription className="text-amber-500/60 font-black text-[10px] tracking-[0.3em] uppercase">
                Security // DTE Transmission
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }} className="space-y-8 pt-4">
          <div className="space-y-6">
            <div className="space-y-3">
              <Label className="flex items-center text-[10px] font-black uppercase tracking-[0.2em] text-blue-400 opacity-80 pl-2">
                <Lock className="h-3 w-3 mr-2" />
                Contraseña API Hacienda
              </Label>
              <Input
                type="password"
                value={mhPass}
                onChange={(e) => setMhPass(e.target.value)}
                placeholder="TOKEN DE ACCESO MH"
                className="bg-white/5 border-white/10 h-14 rounded-2xl focus:ring-blue-500/50 focus:border-blue-500/50 transition-all font-mono text-center tracking-[0.3em]"
                required={false}
              />
            </div>

            <div className="p-10 border-2 border-dashed border-white/10 rounded-[2rem] bg-white/[0.02] hover:border-amber-500/50 hover:bg-amber-500/5 transition-all duration-500 group relative overflow-hidden text-center">
              <input
                type="file"
                id="cert-upload"
                className="hidden"
                accept=".p12,.pfx"
                onChange={handleFileChange}
              />
              <label htmlFor="cert-upload" className="flex flex-col items-center justify-center cursor-pointer space-y-4">
                <div className="p-5 rounded-full bg-white/[0.03] border border-white/10 group-hover:scale-110 transition-transform duration-500">
                  <FileUp className="h-10 w-10 text-white/20 group-hover:text-amber-400 transition-colors" />
                </div>
                <div>
                  <p className="font-black text-xl italic tracking-tight text-white/90 group-hover:text-white transition-colors">
                    {p12File ? p12File.name : "SUBIR CERTIFICADO"}
                  </p>
                  <p className="text-[10px] text-white/20 font-black uppercase tracking-[0.3em] mt-2 group-hover:text-amber-400/60 transition-colors">Formato .p12 / .pfx</p>
                </div>
              </label>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center text-xs font-bold uppercase tracking-widest text-blue-400">
                <Lock className="h-3 w-3 mr-1" />
                Contraseña del Certificado
              </Label>
              <Input
                type="password"
                value={certPass}
                onChange={(e) => setCertPass(e.target.value)}
                placeholder="PIN del archivo .p12"
                className="bg-white/5 border-white/10 h-12"
                required
              />
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className="text-slate-400">
              Cancelar
            </Button>
            <Button type="submit" disabled={!p12File || mutation.isPending} className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 font-bold px-8 shadow-lg shadow-amber-500/20">
              {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Guardar Configuración
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
