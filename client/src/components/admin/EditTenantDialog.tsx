import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Edit, Loader2 } from "lucide-react";
import { Tenant } from "./TenantTable";

interface EditTenantDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    tenant: Tenant | null;
}

export function EditTenantDialog({
    open,
    onOpenChange,
    tenant,
}: EditTenantDialogProps) {
    const { toast } = useToast();
    const [data, setData] = useState({
        nombre: "",
        slug: "",
        tipo: "clinic",
        estado: "activo",
    });

    useEffect(() => {
        if (tenant) {
            setData({
                nombre: tenant.nombre || "",
                slug: tenant.slug || "",
                tipo: tenant.tipo || "clinic",
                estado: tenant.estado || "activo",
            });
        }
    }, [tenant]);

    const updateMutation = useMutation({
        mutationFn: async () => {
            if (!tenant) return;
            const res = await fetch(`/api/admin/tenants/${tenant.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
                credentials: "include",
            });
            if (!res.ok) throw new Error((await res.json()).message);
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["admin", "tenants"] });
            toast({
                title: "Actualizado",
                description: "Información de la empresa actualizada correctamente",
            });
            onOpenChange(false);
        },
        onError: (err: Error) => {
            toast({
                variant: "destructive",
                title: "Error",
                description: err.message,
            });
        },
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        updateMutation.mutate();
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-xl bg-black/60 border-white/10 text-white backdrop-blur-[50px] rounded-[2.5rem] shadow-[0_50px_100px_-20px_rgba(0,0,0,0.8)]">
                <DialogHeader className="space-y-4">
                    <div className="flex items-center space-x-4">
                        <div className="p-3 bg-emerald-500/20 rounded-2xl border border-emerald-500/30">
                            <Edit className="h-6 w-6 text-emerald-400" />
                        </div>
                        <div>
                            <DialogTitle className="text-4xl font-black italic tracking-tighter">EDITAR PERFIL</DialogTitle>
                            <DialogDescription className="text-emerald-400/60 font-black text-[10px] tracking-[0.3em] uppercase">
                                Profile Management // {tenant?.nombre}
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2 col-span-2">
                            <Label>Nombre Comercial</Label>
                            <Input
                                value={data.nombre}
                                onChange={(e) => setData({ ...data, nombre: e.target.value })}
                                className="bg-white/5 border-white/10"
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Slug (Identificador único)</Label>
                            <Input
                                value={data.slug}
                                onChange={(e) => setData({ ...data, slug: e.target.value.toLowerCase().replace(/\s+/g, "-") })}
                                className="bg-white/5 border-white/10"
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Tipo de Negocio</Label>
                            <Select
                                value={data.tipo}
                                onValueChange={(val) => setData({ ...data, tipo: val })}
                            >
                                <SelectTrigger className="bg-white/5 border-white/10">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-slate-800 border-white/20">
                                    <SelectItem value="clinic">Clínica Médica</SelectItem>
                                    <SelectItem value="hospital">Hospital</SelectItem>
                                    <SelectItem value="lab">Laboratorio</SelectItem>
                                    <SelectItem value="store">Comercio General</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className="text-slate-400">
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={updateMutation.isPending} className="bg-gradient-to-r from-blue-500 to-purple-600 font-bold">
                            {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Guardar Cambios
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
