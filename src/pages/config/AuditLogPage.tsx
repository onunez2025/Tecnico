import React, { useState, useEffect } from 'react';
import { Terminal, ShieldAlert, Search, RefreshCcw, User, Clock, Activity, FileText, ChevronRight, Database, ChevronDown, CheckCircle2, AlertCircle } from 'lucide-react';
import { cn } from '../../utils/cn';
import { ApiClient } from '../../services/apiClient';

interface AuditLog {
    id: number;
    user_id: string;
    user_name: string;
    action: string;
    entity: string;
    entity_id: string;
    details: string;
    created_at: string;
}

export default function AuditLogPage() {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filterAction, setFilterAction] = useState('ALL');
    const [expandedLogId, setExpandedLogId] = useState<number | null>(null);

    const fetchLogs = async () => {
        setIsLoading(true);
        try {
            const data = await ApiClient.request<AuditLog[]>('/config/audit-logs');
            setLogs(data);
        } catch (error) {
            console.error('Error fetching audit logs:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchLogs();
    }, []);

    const filteredLogs = logs.filter(log => {
        const matchesSearch = 
            log.user_name?.toLowerCase().includes(search.toLowerCase()) ||
            log.entity?.toLowerCase().includes(search.toLowerCase()) ||
            log.action?.toLowerCase().includes(search.toLowerCase());
        
        const matchesAction = filterAction === 'ALL' || log.action === filterAction;
        
        return matchesSearch && matchesAction;
    });

    const toTitleCase = (str: string) => {
        return str.toLowerCase().split(/[_\s]/).map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    };

    const getActionBadge = (action: string) => {
        const isCritical = action.includes('DENEGADO') || action.includes('DELETE') || action.includes('ERROR');
        const isSuccess = action.includes('SUCCESS') || action.includes('LOGIN') || action.includes('CREATE');
        
        return (
            <span className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold tracking-tight shadow-sm border transition-all duration-300",
                isCritical 
                    ? "bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 border-rose-200/50 dark:border-rose-900/20 group-hover:bg-rose-100 dark:group-hover:bg-rose-950/50"
                    : isSuccess
                    ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border-emerald-200/50 dark:border-emerald-900/20 group-hover:bg-emerald-100 dark:group-hover:bg-emerald-950/50"
                    : "bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 border-blue-200/50 dark:border-blue-900/20 group-hover:bg-blue-100 dark:group-hover:bg-blue-950/50"
            )}>
                {isCritical ? <ShieldAlert className="w-3 h-3" /> : isSuccess ? <CheckCircle2 className="w-3 h-3" /> : <Activity className="w-3 h-3" />}
                {toTitleCase(action)}
            </span>
        );
    };

    return (
        <div className="flex flex-col h-full space-y-4 min-h-0 animate-in fade-in duration-500">
            {/* Header: SIATC Standard */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0 px-1">
                <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground font-medium">
                        <Terminal className="w-4 h-4" />
                        <span>Configuración</span>
                        <ChevronRight className="w-3 h-3 opacity-50" />
                        <span className="text-foreground">Trazabilidad de Seguridad</span>
                    </div>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground">Bitácora de Auditoría</h1>
                    <p className="text-sm text-muted-foreground">Monitoreo transaccional y registro de eventos críticos del motor de liquidaciones</p>
                </div>
                <button 
                    onClick={fetchLogs}
                    disabled={isLoading}
                    className={cn(
                        "inline-flex items-center justify-center gap-2.5 px-5 py-2.5 bg-primary text-primary-foreground rounded-2xl hover:bg-primary/90 transition-all active:scale-95 font-bold text-sm shadow-xl shadow-primary/20",
                        isLoading && "opacity-80 cursor-not-allowed"
                    )}
                >
                    <RefreshCcw className={cn("w-4 h-4 stroke-[2.5]", isLoading && "animate-spin")} />
                    Sincronizar Eventos
                </button>
            </div>

            {/* Content Container */}
            <div className="flex-1 min-h-0 flex flex-col bg-card rounded-[2rem] border border-border/50 shadow-xl shadow-slate-200/20 overflow-hidden backdrop-blur-sm">
                {/* Search / Filters Toolbar */}
                <div className="p-5 border-b border-border/50 bg-muted/20 flex flex-col sm:flex-row items-center gap-4">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Buscar por usuario, acción o entidad técnica..."
                            className="w-full pl-11 pr-4 py-3 bg-background border border-border rounded-2xl focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all text-sm font-bold placeholder:text-muted-foreground/30 shadow-inner"
                        />
                    </div>
                    <div className="relative w-full sm:w-72">
                        <Database className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-primary/60 pointer-events-none" />
                        <select
                            className="w-full h-[46px] pl-11 pr-4 bg-background border border-border rounded-2xl text-[11px] font-bold tracking-widest focus:ring-4 focus:ring-primary/10 outline-none cursor-pointer transition-all appearance-none shadow-inner"
                            value={filterAction}
                            onChange={(e) => setFilterAction(e.target.value)}
                        >
                            <option value="ALL">Logs: Todos los eventos</option>
                            <option value="ACCESO_DENEGADO">Crítico: Accesos denegados</option>
                            <option value="LOGIN_SUCCESS">Acceso: Inicios de sesión</option>
                            <option value="USER_UPDATE">Seguridad: Cambios de perfil</option>
                        </select>
                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    </div>
                </div>

                {/* Table Area */}
                <div className="flex-1 overflow-auto relative custom-scrollbar">
                    {isLoading ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-card/60 backdrop-blur-md z-50">
                            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                            <span className="text-sm font-bold text-muted-foreground mt-6 tracking-[0.2em] animate-pulse">Indexando Auditoría</span>
                        </div>
                    ) : (
                        <table className="w-full text-sm text-left border-collapse table-fixed min-w-[1000px]">
                            <thead className="sticky top-0 z-20 bg-muted/95 backdrop-blur-lg">
                                <tr className="border-b border-border/50">
                                    <th className="px-6 py-5 w-48 font-bold text-sm text-foreground tracking-tight">Fecha y Hora</th>
                                    <th className="px-6 py-5 w-60 font-bold text-sm text-foreground tracking-tight">Usuario Responsable</th>
                                    <th className="px-6 py-5 w-52 font-bold text-sm text-foreground tracking-tight">Operación</th>
                                    <th className="px-6 py-5 w-64 font-bold text-sm text-foreground tracking-tight">Ref. Entidad</th>
                                    <th className="px-6 py-5 font-bold text-sm text-foreground tracking-tight">Payload / Detalle Técnico</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/30">
                                {filteredLogs.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-32 text-center">
                                            <div className="flex flex-col items-center gap-4 opacity-30">
                                                <Activity className="w-16 h-16 text-muted-foreground" />
                                                <p className="text-xs font-bold tracking-widest text-muted-foreground">No se registran transacciones críticas</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    filteredLogs.map((log) => (
                                        <React.Fragment key={log.id}>
                                            <tr 
                                                className={cn(
                                                    "group hover:bg-muted/30 transition-all cursor-pointer",
                                                    expandedLogId === log.id && "bg-primary/[0.02]"
                                                )}
                                                onClick={() => setExpandedLogId(expandedLogId === log.id ? null : log.id)}
                                            >
                                                <td className="px-6 py-5 whitespace-nowrap">
                                                    <div className="flex flex-col">
                                                        <div className="flex items-center gap-2.5 text-foreground font-bold text-xs tracking-tight">
                                                            <Clock className="w-3.5 h-3.5 text-primary/60" />
                                                            {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </div>
                                                        <span className="text-[10px] text-muted-foreground font-medium ml-6">
                                                            {new Date(log.created_at).toLocaleDateString()}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-5">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0 border border-primary/10 shadow-inner group-hover:scale-110 transition-transform">
                                                            <User className="w-5 h-5 stroke-[2]" />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <div className="font-bold text-foreground text-[13px] truncate tracking-tight">{toTitleCase(log.user_name)}</div>
                                                            <div className="text-[9px] text-muted-foreground font-bold tracking-tighter opacity-70 flex items-center gap-1.5 mt-0.5 font-mono">
                                                                <Database className="w-2.5 h-2.5" /> ID: {log.user_id}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-5">
                                                    {getActionBadge(log.action)}
                                                </td>
                                                <td className="px-6 py-5">
                                                    <div className="flex items-center gap-3 min-w-0">
                                                        <div className="w-8 h-8 bg-muted rounded-xl flex items-center justify-center shrink-0 border border-border shadow-sm group-hover:bg-background transition-colors">
                                                            <FileText className="w-4 h-4 text-primary/60" />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <div className="text-[12px] font-bold text-foreground truncate tracking-tighter">{log.entity}</div>
                                                            {log.entity_id && (
                                                                <div className="text-[9px] text-muted-foreground font-bold tracking-widest mt-0.5 italic">Ref_{log.entity_id}</div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-5">
                                                    <div className="flex items-center justify-between gap-4">
                                                        <div className="max-w-[15rem] truncate text-[11px] text-muted-foreground font-bold bg-muted/40 px-3 py-2 rounded-xl border border-border/50 tracking-tighter" title={log.details}>
                                                            {log.details}
                                                        </div>
                                                        <ChevronDown className={cn(
                                                            "w-4 h-4 text-muted-foreground transition-transform duration-300",
                                                            expandedLogId === log.id && "rotate-180 text-primary"
                                                        )} />
                                                    </div>
                                                </td>
                                            </tr>
                                            {expandedLogId === log.id && (
                                                <tr className="bg-primary/[0.01] animate-in fade-in slide-in-from-top-2 duration-300">
                                                    <td colSpan={5} className="px-10 py-6 border-l-4 border-l-primary/40">
                                                        <div className="bg-slate-900 rounded-[1.5rem] p-6 shadow-2xl overflow-hidden relative group/code">
                                                            <div className="absolute top-4 right-6 flex items-center gap-2 text-[10px] font-bold text-slate-500 tracking-wider group-hover/code:text-primary transition-colors">
                                                                <Terminal className="w-4 h-4" />
                                                                Metadata Raw
                                                            </div>
                                                            <pre className="text-[12px] font-mono text-emerald-400 overflow-x-auto custom-scrollbar leading-relaxed">
                                                                {JSON.stringify({
                                                                    id: log.id,
                                                                    action: log.action,
                                                                    resource: log.entity,
                                                                    origin: 'LIQ_ENGINE_V3.4.1',
                                                                    meta: log.details,
                                                                    timestamp: log.created_at
                                                                }, null, 4)}
                                                            </pre>
                                                            <div className="mt-4 flex items-center gap-4">
                                                                <div className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-400 text-[9px] font-bold tracking-widest border border-slate-700/50">
                                                                    Status: Commit Secure
                                                                </div>
                                                                <div className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-400 text-[9px] font-bold tracking-widest border border-slate-700/50 flex items-center gap-2">
                                                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                                                                    Protected by SIATC
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    ))
                                )}
                            </tbody>
                        </table>
                    )}
                </div>
                
                {/* Footer Stats: SIATC Standard */}
                <div className="px-8 py-4 border-t border-border/50 bg-muted/40 flex items-center justify-between shrink-0">
                    <p className="text-[10px] font-black text-muted-foreground tracking-[0.2em] uppercase opacity-60">
                        Total de registros: <span className="text-foreground ml-1">{filteredLogs.length}</span>
                    </p>
                    <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-background rounded-lg border border-border shadow-inner">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[9px] font-black text-muted-foreground tracking-widest uppercase">Sincronizado</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
