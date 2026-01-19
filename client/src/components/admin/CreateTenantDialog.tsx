import { useState } from "react";
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
import { Loader2, Plus } from "lucide-react";

interface CreateTenantDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSubmit: (data: any) => void;
    isPending: boolean;
}

export function CreateTenantDialog({
    open,
    onOpenChange,
    onSubmit,
    isPending,
}: CreateTenantDialogProps) {
    const [data, setData] = useState({
        nombre: "",
        slug: "",
        tipo: "clinic",
        estado: "activo",
        contactoNombre: "",
        contactoEmail: "",
        contactoTelefono: "",
        planPago: "mensual",
        estadoPago: "activo",
        modules: {
            facturacion: true,
            inventario: false,
            reportes: true,
            contabilidad: false,
            multi_sucursal: false,
        },
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit(data);
    };

    const handleModuleToggle = (module: string) => {
        setData({
            ...data,
            modules: { ...data.modules, [module]: !data.modules[module as keyof typeof data.modules] },
        });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-black/60 border-white/10 text-white backdrop-blur-[50px] rounded-[2.5rem] shadow-[0_50px_100px_-20px_rgba(0,0,0,0.8)]">
                <DialogHeader className="space-y-4">
                    <div className="flex items-center space-x-4">
                        <div className="p-3 bg-blue-500/20 rounded-2xl border border-blue-500/30">
                            <Plus className="h-6 w-6 text-blue-400" />
                        </div>
                        <div>
                            <DialogTitle className="text-4xl font-black italic tracking-tighter">ALTA EMPRESA</DialogTitle>
                            <DialogDescription className="text-blue-400/60 font-black text-[10px] tracking-[0.3em] uppercase">
                                SaaS Onboarding // Core Engine
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-10">
                    {/* Información Básica */}
                    <div className="space-y-6">
                        <div className="flex items-center space-x-2 px-2">
                            <h3 className="text-[10px] font-black text-blue-400 uppercase tracking-[0.3em]">Sector 01 // Información Básica</h3>
                            <div className="h-px flex-1 bg-gradient-to-r from-blue-500/30 to-transparent" />
                        </div>

                        <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-white/40 ml-2">Nombre Comercial *</Label>
                                <Input
                                    value={data.nombre}
                                    onChange={(e) => setData({ ...data, nombre: e.target.value })}
                                    placeholder="Ej: Ferretería El Clavo"
                                    className="bg-white/[0.03] border-white/5 h-14 rounded-2xl focus:ring-blue-500/50 focus:border-blue-500/30 transition-all font-bold tracking-tight text-lg"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-white/40 ml-2">Slug Identificador *</Label>
                                <Input
                                    value={data.slug}
                                    onChange={(e) => setData({ ...data, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') })}
                                    placeholder="ej: ferreteria-el-clavo"
                                    className="bg-white/[0.03] border-white/5 h-14 rounded-2xl text-emerald-400 font-mono focus:ring-emerald-500/50 focus:border-emerald-500/30 transition-all"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-white/40 ml-2">Tipo de Negocio</Label>
                                <Select
                                    value={data.tipo}
                                    onValueChange={(val) => setData({ ...data, tipo: val })}
                                >
                                    <SelectTrigger className="bg-white/[0.03] border-white/5 h-14 rounded-2xl focus:ring-blue-500/50 transition-all font-bold">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="bg-slate-900/95 backdrop-blur-3xl border border-white/10 rounded-2xl p-2">
                                        <SelectItem value="clinic" className="rounded-xl focus:bg-white/10 cursor-pointer py-3 font-bold uppercase text-[10px] tracking-widest">Clínica Médica</SelectItem>
                                        <SelectItem value="hospital" className="rounded-xl focus:bg-white/10 cursor-pointer py-3 font-bold uppercase text-[10px] tracking-widest">Hospital</SelectItem>
                                        <SelectItem value="lab" className="rounded-xl focus:bg-white/10 cursor-pointer py-3 font-bold uppercase text-[10px] tracking-widest">Laboratorio</SelectItem>
                                        <SelectItem value="store" className="rounded-xl focus:bg-white/10 cursor-pointer py-3 font-bold uppercase text-[10px] tracking-widest">Comercio General</SelectItem>
                                        <SelectItem value="restaurant" className="rounded-xl focus:bg-white/10 cursor-pointer py-3 font-bold uppercase text-[10px] tracking-widest">Restaurante</SelectItem>
                                        <SelectItem value="other" className="rounded-xl focus:bg-white/10 cursor-pointer py-3 font-bold uppercase text-[10px] tracking-widest">Otro</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-white/40 ml-2">Estado Inicial</Label>
                                <Select
                                    value={data.estado}
                                    onValueChange={(val) => setData({ ...data, estado: val })}
                                >
                                    <SelectTrigger className="bg-white/[0.03] border-white/5 h-14 rounded-2xl focus:ring-blue-500/50 transition-all font-bold">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="bg-slate-900/95 backdrop-blur-3xl border border-white/10 rounded-2xl p-2">
                                        <SelectItem value="activo" className="rounded-xl focus:bg-emerald-500/20 focus:text-emerald-400 cursor-pointer py-3 font-bold uppercase text-[10px] tracking-widest">Activo</SelectItem>
                                        <SelectItem value="prueba" className="rounded-xl focus:bg-blue-500/20 focus:text-blue-400 cursor-pointer py-3 font-bold uppercase text-[10px] tracking-widest">Prueba (30 días)</SelectItem>
                                        <SelectItem value="suspendido" className="rounded-xl focus:bg-red-500/20 focus:text-red-400 cursor-pointer py-3 font-bold uppercase text-[10px] tracking-widest">Suspendido</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>

                    {/* Información de Contacto */}
                    <div className="space-y-6">
                        <div className="flex items-center space-x-2 px-2">
                            <h3 className="text-[10px] font-black text-purple-400 uppercase tracking-[0.3em]">Sector 02 // Contacto Principal</h3>
                            <div className="h-px flex-1 bg-gradient-to-r from-purple-500/30 to-transparent" />
                        </div>
                        <div className="grid grid-cols-3 gap-6">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-white/40 ml-2">Responsable</Label>
                                <Input
                                    value={data.contactoNombre}
                                    onChange={(e) => setData({ ...data, contactoNombre: e.target.value })}
                                    placeholder="Juan Pérez"
                                    className="bg-white/[0.03] border-white/5 h-14 rounded-2xl focus:ring-purple-500/50 focus:border-purple-500/30 transition-all font-bold"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-white/40 ml-2">Email</Label>
                                <Input
                                    type="email"
                                    value={data.contactoEmail}
                                    onChange={(e) => setData({ ...data, contactoEmail: e.target.value })}
                                    placeholder="admin@empresa.com"
                                    className="bg-white/[0.03] border-white/5 h-14 rounded-2xl focus:ring-purple-500/50 focus:border-purple-500/30 transition-all font-bold"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-white/40 ml-2">Teléfono</Label>
                                <Input
                                    value={data.contactoTelefono}
                                    onChange={(e) => setData({ ...data, contactoTelefono: e.target.value })}
                                    placeholder="+503 7123-4567"
                                    className="bg-white/[0.03] border-white/5 h-14 rounded-2xl focus:ring-purple-500/50 focus:border-purple-500/30 transition-all font-bold"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Módulos */}
                    <div className="space-y-6">
                        <div className="flex items-center space-x-2 px-2">
                            <h3 className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.3em]">Sector 03 // Arquitectura de Módulos</h3>
                            <div className="h-px flex-1 bg-gradient-to-r from-emerald-500/30 to-transparent" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            {[
                                { id: 'facturacion', label: 'Facturación Electrónica', color: 'blue' },
                                { id: 'inventario', label: 'Inventario', color: 'emerald' },
                                { id: 'reportes', label: 'Reportes y Analytics', color: 'purple' },
                                { id: 'contabilidad', label: 'Contabilidad', color: 'amber' },
                                { id: 'multi_sucursal', label: 'Multi-Sucursal', color: 'rose' },
                            ].map((mod) => (
                                <div
                                    key={mod.id}
                                    className={`flex items-center space-x-4 p-5 rounded-2xl border transition-all duration-500 cursor-pointer group relative overflow-hidden ${data.modules[mod.id as keyof typeof data.modules]
                                        ? `bg-${mod.color}-500/10 border-${mod.color}-500/30`
                                        : 'bg-white/[0.02] border-white/5 grayscale hover:grayscale-0 hover:bg-white/[0.05]'
                                        }`}
                                    onClick={() => handleModuleToggle(mod.id)}
                                >
                                    <div className={`p-2 rounded-xl transition-all duration-500 ${data.modules[mod.id as keyof typeof data.modules] ? `bg-${mod.color}-500/20` : 'bg-white/5'}`}>
                                        <input
                                            type="checkbox"
                                            id={`mod-${mod.id}`}
                                            checked={data.modules[mod.id as keyof typeof data.modules]}
                                            onChange={() => { }}
                                            className="hidden"
                                        />
                                        <div className={`h-4 w-4 rounded-sm border-2 transition-all ${data.modules[mod.id as keyof typeof data.modules] ? `bg-${mod.color}-500 border-${mod.color}-400` : 'border-white/20'}`} />
                                    </div>
                                    <label htmlFor={`mod-${mod.id}`} className={`font-black text-[10px] uppercase tracking-widest cursor-pointer transition-colors ${data.modules[mod.id as keyof typeof data.modules] ? 'text-white' : 'text-white/40'}`}>
                                        {mod.label}
                                    </label>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Pagos */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Plan de Facturación</Label>
                            <Select value={data.planPago} onValueChange={(val) => setData({ ...data, planPago: val })}>
                                <SelectTrigger className="bg-white/5 border-white/10"><SelectValue /></SelectTrigger>
                                <SelectContent className="bg-slate-800 border-white/20">
                                    <SelectItem value="mensual">Mensual ($49/mes)</SelectItem>
                                    <SelectItem value="trimestral">Trimestral ($120/3 meses)</SelectItem>
                                    <SelectItem value="anual">Anual ($450/año)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Estado de Pago</Label>
                            <Select value={data.estadoPago} onValueChange={(val) => setData({ ...data, estadoPago: val })}>
                                <SelectTrigger className="bg-white/5 border-white/10"><SelectValue /></SelectTrigger>
                                <SelectContent className="bg-slate-800 border-white/20">
                                    <SelectItem value="activo">Activo (Al día)</SelectItem>
                                    <SelectItem value="pendiente">Pendiente</SelectItem>
                                    <SelectItem value="vencido">Vencido</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <DialogFooter className="pt-10 border-t border-white/5">
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={() => onOpenChange(false)}
                            className="h-14 px-8 rounded-2xl font-black text-[10px] uppercase tracking-widest text-white/40 hover:text-white hover:bg-white/5 transition-all"
                        >
                            Cancelar
                        </Button>
                        <Button
                            type="submit"
                            disabled={isPending}
                            className="h-14 px-12 rounded-2xl bg-gradient-to-r from-blue-600 to-purple-600 hover:scale-105 active:scale-95 transition-all duration-500 font-black italic tracking-tighter text-xl shadow-[0_20px_40px_rgba(59,130,246,0.3)] border border-white/10"
                        >
                            {isPending && <Loader2 className="mr-3 h-6 w-6 animate-spin" />}
                            LANZAR EMPRESA
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
