import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Edit,
    Eye,
    Key,
    Loader2,
    MoreHorizontal,
    Pause,
    Play,
    Trash2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type Tenant = {
    id: string;
    nombre: string;
    slug: string;
    tipo: string;
    estado: string;
    createdAt: string;
};

interface TenantTableProps {
    tenants: Tenant[] | undefined;
    isLoading: boolean;
    onViewDetails: (tenant: Tenant) => void;
    onEdit: (tenant: Tenant) => void;
    onCredentials: (tenant: Tenant) => void;
    onToggleStatus: (tenant: Tenant) => void;
    onDelete: (tenant: Tenant) => void;
}

export function TenantTable({
    tenants,
    isLoading,
    onViewDetails,
    onEdit,
    onCredentials,
    onToggleStatus,
    onDelete,
}: TenantTableProps) {
    return (
        <Card className="relative overflow-hidden bg-white/40 dark:bg-white/5 backdrop-blur-3xl rounded-[2.5rem] border border-white/60 dark:border-white/20 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] dark:shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)] transition-all duration-700 hover:-translate-y-2 group">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-600/5 pointer-events-none" />

            <CardHeader className="relative border-b border-white/5 px-8 py-8 flex flex-row items-center justify-between">
                <div>
                    <CardTitle className="text-3xl font-black text-slate-800 dark:text-white italic tracking-tighter">EMPRESAS</CardTitle>
                    <p className="text-[10px] font-bold text-blue-600 dark:text-blue-400 tracking-[0.4em] uppercase opacity-60">Directory // Core</p>
                </div>
            </CardHeader>
            <CardContent className="relative overflow-x-auto p-0">
                <Table>
                    <TableHeader>
                        <TableRow className="border-b border-white/10 hover:bg-transparent px-8">
                            <TableHead className="h-14 font-black text-slate-500 dark:text-white/40 text-[10px] uppercase tracking-[0.2em] pl-10">Nombre Comercial</TableHead>
                            <TableHead className="h-14 font-black text-slate-500 dark:text-white/40 text-[10px] uppercase tracking-[0.2em]">Identificador</TableHead>
                            <TableHead className="h-14 font-black text-slate-500 dark:text-white/40 text-[10px] uppercase tracking-[0.2em]">Nicho</TableHead>
                            <TableHead className="h-14 font-black text-slate-500 dark:text-white/40 text-[10px] uppercase tracking-[0.2em]">Estado</TableHead>
                            <TableHead className="h-14 font-black text-slate-500 dark:text-white/40 text-[10px] uppercase tracking-[0.2em]">Alta</TableHead>
                            <TableHead className="h-14 text-right font-black text-slate-500 dark:text-white/40 text-[10px] uppercase tracking-[0.2em] pr-10">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody className="relative z-10">
                        {isLoading ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center py-20">
                                    <Loader2 className="h-10 w-10 animate-spin mx-auto text-blue-500/50" />
                                </TableCell>
                            </TableRow>
                        ) : tenants?.map((tenant) => (
                            <TableRow key={tenant.id} className="border-b border-white/[0.05] hover:bg-white/[0.08] transition-all duration-300 group">
                                <TableCell className="pl-10">
                                    <div className="py-4">
                                        <p className="font-bold text-slate-800 dark:text-white text-lg tracking-tight group-hover:text-blue-500 transition-colors uppercase italic">{tenant.nombre}</p>
                                        <p className="text-[10px] text-slate-500 dark:text-white/30 font-mono mt-1">{tenant.id}</p>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <code className="text-[11px] bg-blue-500/10 text-blue-300 px-3 py-1 rounded-full border border-blue-500/20 font-mono">
                                        /{tenant.slug}
                                    </code>
                                </TableCell>
                                <TableCell>
                                    <span className="text-xs font-bold text-purple-300 bg-purple-500/10 px-3 py-1 rounded-full border border-purple-500/20 uppercase">
                                        {tenant.tipo}
                                    </span>
                                </TableCell>
                                <TableCell>
                                    <div className="flex items-center space-x-2">
                                        <div className={`h-2 w-2 rounded-full animate-pulse ${tenant.estado === 'activo' ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)]' : 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)]'}`} />
                                        <span className={`text-[10px] font-black uppercase tracking-widest ${tenant.estado === 'activo' ? 'text-emerald-400' : 'text-red-400'}`}>
                                            {tenant.estado}
                                        </span>
                                    </div>
                                </TableCell>
                                <TableCell className="text-white/40 font-mono text-xs">
                                    {new Date(tenant.createdAt).toLocaleDateString("es-ES")}
                                </TableCell>
                                <TableCell className="text-right pr-10">
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="sm" className="hover:bg-white/10 text-white/40 hover:text-white rounded-full h-10 w-10 p-0 transition-all">
                                                <MoreHorizontal className="h-5 w-5" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="bg-slate-900/90 backdrop-blur-2xl border border-white/10 rounded-2xl w-56 p-2 shadow-2xl">
                                            <DropdownMenuItem onClick={() => onViewDetails(tenant)} className="rounded-xl focus:bg-white/10 focus:text-white py-3 cursor-pointer">
                                                <Eye className="h-4 w-4 mr-3 text-blue-400" />
                                                <span className="font-bold text-xs uppercase tracking-wider">Ver Perfil</span>
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => onEdit(tenant)} className="rounded-xl focus:bg-white/10 focus:text-white py-3 cursor-pointer">
                                                <Edit className="h-4 w-4 mr-3 text-emerald-400" />
                                                <span className="font-bold text-xs uppercase tracking-wider">Modificar</span>
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => onCredentials(tenant)} className="rounded-xl focus:bg-white/10 focus:text-white py-3 cursor-pointer">
                                                <Key className="h-4 w-4 mr-3 text-amber-400" />
                                                <span className="font-bold text-xs uppercase tracking-wider">Hacienda</span>
                                            </DropdownMenuItem>
                                            <DropdownMenuSeparator className="bg-white/10 my-2" />
                                            <DropdownMenuItem onClick={() => onToggleStatus(tenant)} className="rounded-xl focus:bg-white/10 focus:text-white py-3 cursor-pointer">
                                                {tenant.estado === "activo" ? (
                                                    <>
                                                        <Pause className="h-4 w-4 mr-3 text-red-400" />
                                                        <span className="font-bold text-xs uppercase tracking-wider">Suspender</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <Play className="h-4 w-4 mr-3 text-emerald-400" />
                                                        <span className="font-bold text-xs uppercase tracking-wider">Activar</span>
                                                    </>
                                                )}
                                            </DropdownMenuItem>
                                            <DropdownMenuSeparator className="bg-white/10 my-2" />
                                            <DropdownMenuItem
                                                onClick={() => onDelete(tenant)}
                                                className="rounded-xl focus:bg-red-500/20 focus:text-red-400 text-red-500 py-3 cursor-pointer"
                                            >
                                                <Trash2 className="h-4 w-4 mr-3" />
                                                <span className="font-bold text-xs uppercase tracking-wider">Eliminar Core</span>
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
