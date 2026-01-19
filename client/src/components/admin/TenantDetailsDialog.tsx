import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Building2,
    Eye,
    Loader2,
} from "lucide-react";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tenant } from "./TenantTable";

interface TenantDetailsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    tenant: Tenant | null;
}

export function TenantDetailsDialog({
    open,
    onOpenChange,
    tenant,
}: TenantDetailsDialogProps) {
    if (!tenant) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl bg-black/60 border-white/10 text-white backdrop-blur-[50px] rounded-[2.5rem] shadow-[0_50px_100px_-20px_rgba(0,0,0,0.8)] p-0 overflow-hidden">
                <div className="absolute top-0 right-0 p-12 opacity-10">
                    <Building2 className="h-64 w-64 text-white" />
                </div>

                <DialogHeader className="p-8 pb-4 relative z-10 border-b border-white/5 bg-white/[0.02]">
                    <div className="flex items-center space-x-4 mb-2">
                        <div className="p-3 rounded-2xl bg-blue-500/20 border border-blue-500/30">
                            <Eye className="h-6 w-6 text-blue-400" />
                        </div>
                        <div>
                            <DialogTitle className="text-4xl font-black italic tracking-tighter uppercase">CORE PROFILE</DialogTitle>
                            <DialogDescription className="text-blue-400/60 font-black text-[10px] tracking-[0.3em] uppercase">
                                Technical Identity // {tenant.nombre}
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <div className="grid grid-cols-2 gap-8 p-10 relative z-10">
                    <div className="space-y-6">
                        <div className="space-y-1">
                            <Label className="text-blue-400 font-black text-[10px] uppercase tracking-[0.4em] opacity-60">Nombre Comercial</Label>
                            <p className="text-2xl font-black italic tracking-tight">{tenant.nombre}</p>
                        </div>
                        <div className="space-y-1">
                            <Label className="text-blue-400 font-black text-[10px] uppercase tracking-[0.4em] opacity-60">URL Identificador</Label>
                            <div className="flex items-center">
                                <span className="text-white/20 font-mono tracking-tighter text-lg mr-1 italic">/</span>
                                <p className="text-emerald-400 font-mono text-lg font-bold tracking-tighter">{tenant.slug}</p>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-blue-400 font-black text-[10px] uppercase tracking-[0.4em] opacity-60">Nicho Operativo</Label>
                            <div>
                                <Badge variant="outline" className="bg-blue-500/10 text-blue-200 border-blue-400/30 px-4 py-1.5 rounded-xl font-bold uppercase tracking-widest text-[10px]">{tenant.tipo}</Badge>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-blue-400 font-black text-[10px] uppercase tracking-[0.4em] opacity-60">Estado de Red</Label>
                            <div>
                                <Badge className="bg-emerald-500/20 text-emerald-200 border-emerald-400/30 px-4 py-1.5 rounded-xl font-bold uppercase tracking-widest text-[10px]">{tenant.estado}</Badge>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-6 pl-8 border-l border-white/5">
                        <div className="space-y-1">
                            <Label className="text-blue-400 font-black text-[10px] uppercase tracking-[0.4em] opacity-60">UUID Sistema</Label>
                            <p className="text-[10px] font-mono text-white/30 truncate select-all hover:text-white transition-colors cursor-pointer">{tenant.id}</p>
                        </div>
                        <div className="space-y-1">
                            <Label className="text-blue-400 font-black text-[10px] uppercase tracking-[0.4em] opacity-60">Fecha de Alta</Label>
                            <p className="font-bold text-white/80">{new Date(tenant.createdAt).toLocaleString("es-ES", { dateStyle: 'full' })}</p>
                        </div>
                        <div className="space-y-1">
                            <Label className="text-blue-400 font-black text-[10px] uppercase tracking-[0.4em] opacity-60">Canal de Contacto</Label>
                            <p className="font-bold text-white/80 select-all">{(tenant as any).contacto_email || "PENDIENTE_DE_REGISTRO"}</p>
                        </div>
                        <div className="space-y-1">
                            <Label className="text-blue-400 font-black text-[10px] uppercase tracking-[0.4em] opacity-60">Línea de Soporte</Label>
                            <p className="font-bold text-white/80">{(tenant as any).contacto_telefono || "SIN_PROVEEDOR"}</p>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
