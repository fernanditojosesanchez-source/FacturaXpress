import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, FileText, Loader2, TrendingUp, Users } from "lucide-react";

interface TenantCardsProps {
    metrics: any;
    isLoading: boolean;
}

export function TenantCards({ metrics, isLoading }: TenantCardsProps) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-fade-in" style={{ animationDelay: '0.1s' }}>
            {/* Total Empresas - Glass Blue */}
            <Card className="relative overflow-hidden bg-white/40 dark:bg-white/5 backdrop-blur-3xl rounded-[2.5rem] border border-white/60 dark:border-white/20 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] dark:shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)] transition-all duration-700 hover:-translate-y-2 group">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-transparent to-blue-600/5 opacity-60 group-hover:opacity-100 transition-opacity" />
                <div className="absolute -top-24 -right-24 w-48 h-48 bg-blue-500/10 dark:bg-blue-500/20 blur-3xl group-hover:bg-blue-500/40 transition-all duration-700" />

                <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-0 pt-8 px-8">
                    <CardTitle className="text-[10px] font-black italic text-blue-600 dark:text-blue-200 tracking-[0.3em] uppercase opacity-70">
                        METRICS // TOTAL
                    </CardTitle>
                    <div className="p-4 rounded-2xl bg-white/40 dark:bg-white/5 border border-white/60 dark:border-white/10 backdrop-blur-xl shadow-xl group-hover:scale-110 transition-transform duration-500">
                        <Building2 className="h-6 w-6 text-blue-600 dark:text-blue-400 drop-shadow-lg" />
                    </div>
                </CardHeader>
                <CardContent className="relative pt-6 px-8 pb-8">
                    <div className="text-6xl font-black tracking-tighter text-slate-800 dark:text-white drop-shadow-sm mb-2">
                        {isLoading ? <Loader2 className="h-10 w-10 animate-spin text-blue-500" /> : (metrics?.totalEmpresas || 0)}
                    </div>
                    <p className="text-xs text-blue-700 dark:text-blue-100/60 font-bold uppercase tracking-widest">Empresas Registradas</p>
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
                <CardContent className="relative pt-6 px-8 pb-8">
                    <div className="text-6xl font-black tracking-tighter text-slate-800 dark:text-white drop-shadow-sm mb-2">
                        {isLoading ? <Loader2 className="h-10 w-10 animate-spin text-emerald-500" /> : (metrics?.empresasActivas || 0)}
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
                <CardContent className="relative pt-6 px-8 pb-8">
                    <div className="text-6xl font-black tracking-tighter text-slate-800 dark:text-white drop-shadow-sm mb-2">
                        {isLoading ? <Loader2 className="h-10 w-10 animate-spin text-purple-500" /> : (metrics?.totalUsuarios || 0)}
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
                <CardContent className="relative pt-6 px-8 pb-8">
                    <div className="text-6xl font-black tracking-tighter text-slate-800 dark:text-white drop-shadow-sm mb-2">
                        {isLoading ? <Loader2 className="h-10 w-10 animate-spin text-amber-500" /> : (metrics?.totalFacturas || 0)}
                    </div>
                    <p className="text-xs text-amber-700 dark:text-amber-100/60 font-bold uppercase tracking-widest">Documentos Emitidos</p>
                </CardContent>
            </Card>
        </div>
    );
}
