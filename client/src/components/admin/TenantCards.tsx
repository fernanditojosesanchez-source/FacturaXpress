import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Loader2, Plus, TrendingUp, Users } from "lucide-react";

interface TenantCardsProps {
    metrics: any;
    isLoading: boolean;
    onNewTenant: () => void;
}

export function TenantCards({ metrics, isLoading, onNewTenant }: TenantCardsProps) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-fade-in" style={{ animationDelay: '0.1s' }}>
            {/* Welcome & Action Card - Replaces Total Empresas */}
            <Card className="relative overflow-hidden bg-white/40 dark:bg-white/5 backdrop-blur-3xl rounded-[2.5rem] border border-white/60 dark:border-white/20 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] dark:shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)] transition-all duration-700 hover:-translate-y-2 group md:col-span-2 lg:col-span-1">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-transparent to-purple-600/5 opacity-60 group-hover:opacity-100 transition-opacity" />

                <CardContent className="relative h-full flex flex-col justify-between py-8 px-8 min-h-[180px]">
                    <div className="space-y-1">
                        <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight leading-none">
                            Panel de Control
                        </h2>
                        <p className="text-slate-500 dark:text-slate-400 text-xs font-medium tracking-tight">Ecosistema Fiscal NEEXUM</p>
                    </div>

                    <div className="flex items-center justify-between mt-4">
                        <div className="flex flex-col">
                            <span className="text-4xl font-black text-blue-600 dark:text-blue-400 leading-none">
                                {metrics?.totalEmpresas || 0}
                            </span>
                            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-widest mt-1">Empresas</span>
                        </div>

                        <Button
                            onClick={onNewTenant}
                            className="h-12 px-6 rounded-2xl bg-blue-600 text-white hover:bg-blue-700 transition-all font-bold text-sm shadow-lg shadow-blue-600/20"
                        >
                            <Plus className="h-4 w-4 mr-2" />
                            Nueva Empresa
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Empresas Activas - Glass Emerald */}
            <Card className="relative overflow-hidden bg-white/40 dark:bg-white/5 backdrop-blur-3xl rounded-[2.5rem] border border-white/60 dark:border-white/20 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] dark:shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)] transition-all duration-700 hover:-translate-y-2 group">
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-transparent to-emerald-600/5 opacity-60 group-hover:opacity-100 transition-opacity" />
                <div className="absolute -top-24 -right-24 w-48 h-48 bg-emerald-500/10 dark:bg-emerald-500/20 blur-3xl group-hover:bg-emerald-500/40 transition-all duration-700" />

                <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-0 pt-8 px-8">
                    <CardTitle className="text-[10px] font-black italic text-emerald-600 dark:text-emerald-200 tracking-[0.3em] uppercase opacity-70">
                        STATUS // LIVE
                    </CardTitle>
                    <div className="p-4 rounded-2xl bg-white/40 dark:bg-white/5 border border-white/60 dark:border-white/10 backdrop-blur-xl shadow-xl group-hover:scale-110 transition-transform duration-500">
                        <TrendingUp className="h-6 w-6 text-emerald-600 dark:text-emerald-400 drop-shadow-lg" />
                    </div>
                </CardHeader>
                <CardContent className="relative pt-4 px-8 pb-6">
                    <div className="text-5xl font-black tracking-tighter text-slate-800 dark:text-white drop-shadow-sm mb-1">
                        {isLoading ? <Loader2 className="h-8 w-8 animate-spin text-emerald-500" /> : (metrics?.empresasActivas || 0)}
                    </div>
                    <p className="text-xs text-emerald-700 dark:text-emerald-100/60 font-bold uppercase tracking-widest">En operación actual</p>
                </CardContent>
            </Card>

            {/* Total Usuarios - Glass Purple */}
            <Card className="relative overflow-hidden bg-white/40 dark:bg-white/5 backdrop-blur-3xl rounded-[2.5rem] border border-white/60 dark:border-white/20 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] dark:shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)] transition-all duration-700 hover:-translate-y-2 group">
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 via-transparent to-purple-600/5 opacity-60 group-hover:opacity-100 transition-opacity" />
                <div className="absolute -top-24 -right-24 w-48 h-48 bg-purple-500/10 dark:bg-purple-500/20 blur-3xl group-hover:bg-purple-500/40 transition-all duration-700" />

                <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-0 pt-8 px-8">
                    <CardTitle className="text-[10px] font-black italic text-purple-600 dark:text-purple-200 tracking-[0.3em] uppercase opacity-70">
                        USERS // ACTIVE
                    </CardTitle>
                    <div className="p-4 rounded-2xl bg-white/40 dark:bg-white/5 border border-white/60 dark:border-white/10 backdrop-blur-xl shadow-xl group-hover:scale-110 transition-transform duration-500">
                        <Users className="h-6 w-6 text-purple-600 dark:text-purple-400 drop-shadow-lg" />
                    </div>
                </CardHeader>
                <CardContent className="relative pt-4 px-8 pb-6">
                    <div className="text-5xl font-black tracking-tighter text-slate-800 dark:text-white drop-shadow-sm mb-1">
                        {isLoading ? <Loader2 className="h-8 w-8 animate-spin text-purple-500" /> : (metrics?.totalUsuarios || 0)}
                    </div>
                    <p className="text-xs text-purple-700 dark:text-purple-100/60 font-bold uppercase tracking-widest">Suscripciones Activas</p>
                </CardContent>
            </Card>

            {/* Total Facturas - Glass Amber */}
            <Card className="relative overflow-hidden bg-white/40 dark:bg-white/5 backdrop-blur-3xl rounded-[2.5rem] border border-white/60 dark:border-white/20 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] dark:shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)] transition-all duration-700 hover:-translate-y-2 group">
                <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 via-transparent to-amber-600/5 opacity-60 group-hover:opacity-100 transition-opacity" />
                <div className="absolute -top-24 -right-24 w-48 h-48 bg-amber-500/10 dark:bg-amber-500/20 blur-3xl group-hover:bg-amber-500/40 transition-all duration-700" />

                <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-0 pt-8 px-8">
                    <CardTitle className="text-[10px] font-black italic text-amber-600 dark:text-amber-200 tracking-[0.3em] uppercase opacity-70">
                        FISCAL // VOLUME
                    </CardTitle>
                    <div className="p-4 rounded-2xl bg-white/40 dark:bg-white/5 border border-white/60 dark:border-white/10 backdrop-blur-xl shadow-xl group-hover:scale-110 transition-transform duration-500">
                        <FileText className="h-6 w-6 text-amber-600 dark:text-amber-400 drop-shadow-lg" />
                    </div>
                </CardHeader>
                <CardContent className="relative pt-4 px-8 pb-6">
                    <div className="text-5xl font-black tracking-tighter text-slate-800 dark:text-white drop-shadow-sm mb-1">
                        {isLoading ? <Loader2 className="h-8 w-8 animate-spin text-amber-500" /> : (metrics?.totalFacturas || 0)}
                    </div>
                    <p className="text-xs text-amber-700 dark:text-amber-100/60 font-bold uppercase tracking-widest">Documentos Emitidos</p>
                </CardContent>
            </Card>
        </div>
    );
}
