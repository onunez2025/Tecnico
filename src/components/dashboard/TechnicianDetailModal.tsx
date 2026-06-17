import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, TrendingUp, BarChart3, Package, Layers } from 'lucide-react';
import { DashboardService } from '../../services/dashboardService';
import { cn } from '../../utils/cn';

interface TechnicianDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    techName: string;
}

export const TechnicianDetailModal: React.FC<TechnicianDetailModalProps> = ({ isOpen, onClose, techName }) => {
    const [metrics, setMetrics] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (isOpen && techName) {
            loadMetrics();
        }
    }, [isOpen, techName]);

    const loadMetrics = async () => {
        setIsLoading(true);
        try {
            const data = await DashboardService.getTechnicianMetrics(techName);
            setMetrics(data);
        } catch (error) {
            console.error("Error loading technician metrics:", error);
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-hidden">
                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="absolute inset-0 bg-background/80 backdrop-blur-md"
                />
                
                <motion.div 
                    initial={{ scale: 0.9, opacity: 0, x: 20 }}
                    animate={{ scale: 1, opacity: 1, x: 0 }}
                    exit={{ scale: 0.95, opacity: 0, x: 10 }}
                    className="relative w-full max-w-4xl bg-card border border-divider shadow-2xl rounded-3xl overflow-hidden flex flex-col max-h-[85vh]"
                >
                    {/* Header */}
                    <div className="p-6 border-b border-divider flex justify-between items-center bg-primary/5">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center text-primary-foreground shadow-lg shadow-primary/20">
                                <span className="text-sm font-bold text-center block leading-none">Tec<br/>{techName.substring(0, 2)}</span>
                            </div>
                            <div>
                                <h2 className="text-xl font-bold tracking-tight text-foreground">{techName}</h2>
                                <p className="text-[10px] text-muted-foreground font-bold opacity-60">Operador Mt Industrial | Rendimiento 2026</p>
                            </div>
                        </div>
                        <button 
                            onClick={onClose}
                            className="p-2 hover:bg-muted rounded-xl transition-colors text-muted-foreground hover:text-foreground shadow-sm"
                        >
                            <X className="w-6 h-6" />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-auto p-6 space-y-8 custom-scrollbar">
                        {isLoading ? (
                            <div className="h-64 flex flex-col items-center justify-center gap-4">
                                <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                                <span className="text-[10px] font-bold opacity-40">Consultando Métricas En Azure Sql...</span>
                            </div>
                        ) : (
                            <div className="space-y-8">
                                {/* Row 1: Tendencia Mensual */}
                                <div className="bg-muted/10 p-6 rounded-2xl border border-divider">
                                    <div className="flex items-center gap-2 mb-6 justify-between">
                                        <div className="flex items-center gap-2">
                                            <TrendingUp className="w-4 h-4 text-emerald-500" />
                                            <h3 className="text-xs font-bold opacity-70">Recaudación Mensual (S/)</h3>
                                        </div>
                                        <div className="text-[10px] font-bold text-primary px-2 py-0.5 bg-primary/10 rounded">Total: S/ {metrics?.monthly_trend?.reduce((a:any,c:any)=>a+c.total,0).toLocaleString()}</div>
                                    </div>
                                    <div className="h-[180px] flex items-end justify-between gap-1 px-4 border-b border-divider/40 pb-2">
                                        {Array.from({length: 12}, (_, i) => {
                                            const month = i + 1;
                                            const data = metrics?.monthly_trend?.find((m: any) => m.month === month);
                                            const val = data ? data.total : 0;
                                            const maxV = Math.max(...metrics.monthly_trend.map((d: any) => d.total)) || 100;
                                            const height = (val / maxV) * 100;
                                            
                                            return (
                                                <div key={month} className="flex-1 flex flex-col items-center gap-2 group">
                                                    <div className="w-full bg-primary/10 hover:bg-primary/40 rounded-t-lg transition-all relative overflow-visible" style={{ height: `${Math.max(height, 2)}%` }}>
                                                        {val > 0 && (
                                                            <div className="absolute -top-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-background px-2 py-0.5 border border-divider text-[8px] font-black rounded-md shadow-sm z-10 whitespace-nowrap">
                                                                S/ {val}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <span className={cn("text-[8px] font-bold", val > 0 ? "text-primary opacity-100" : "text-muted-foreground opacity-30")}>Mes {month}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    {/* Tipos de Servicio */}
                                    <div className="bg-muted/10 p-6 rounded-2xl border border-divider">
                                        <div className="flex items-center gap-2 mb-6">
                                            <BarChart3 className="w-4 h-4 text-primary" />
                                            <h3 className="text-xs font-bold opacity-70">Tipos De Servicio (Servicios/S/)</h3>
                                        </div>
                                        <div className="space-y-5">
                                            {metrics?.services?.map((s: any, i: number) => (
                                                <div key={i} className="flex flex-col gap-1.5">
                                                    <div className="flex justify-between items-end">
                                                        <span className="text-[10px] font-bold truncate max-w-[150px]">{s.label}</span>
                                                        <div className="text-right">
                                                            <span className="text-[9px] font-bold text-muted-foreground">{s.count} servicios</span>
                                                            <div className="text-[10px] font-bold text-primary">S/ {s.total.toLocaleString()}</div>
                                                        </div>
                                                    </div>
                                                    <div className="w-full h-1.5 bg-muted rounded-full">
                                                        <motion.div 
                                                            initial={{ width: 0 }}
                                                            animate={{ width: `${(s.total / Math.max(...metrics.services.map((d: any) => d.total))) * 100}%` }}
                                                            className="h-full bg-primary rounded-full"
                                                        />
                                                    </div>
                                                </div>
                                            ))}
                                            {(!metrics?.services || metrics.services.length === 0) && <p className="text-[10px] text-muted-foreground text-center py-4">Sin Datos De Servicios Registrados</p>}
                                        </div>
                                    </div>

                                    {/* Materiales Utlizados */}
                                    <div className="bg-muted/10 p-6 rounded-2xl border border-divider">
                                        <div className="flex items-center gap-2 mb-6">
                                            <Package className="w-4 h-4 text-amber-500" />
                                            <h3 className="text-xs font-bold opacity-70">Materiales Y Repuestos (S/)</h3>
                                        </div>
                                        <div className="space-y-5">
                                            {metrics?.materials?.map((m: any, i: number) => (
                                                <div key={i} className="flex flex-col gap-1.5">
                                                    <div className="flex justify-between items-end">
                                                        <span className="text-[10px] font-bold truncate max-w-[150px]">{m.label}</span>
                                                        <div className="text-right">
                                                            <span className="text-[9px] font-bold text-muted-foreground">{m.count} unidades</span>
                                                            <div className="text-[10px] font-bold text-amber-600">S/ {m.total.toLocaleString()}</div>
                                                        </div>
                                                    </div>
                                                    <div className="w-full h-1.5 bg-muted rounded-full">
                                                        <motion.div 
                                                            initial={{ width: 0 }}
                                                            animate={{ width: `${(m.total / (Math.max(...metrics.materials.map((d: any) => d.total)) || 1)) * 100}%` }}
                                                            className="h-full bg-amber-500 rounded-full"
                                                        />
                                                    </div>
                                                </div>
                                            ))}
                                            {(!metrics?.materials || metrics.materials.length === 0) && (
                                                <div className="text-center py-8 opacity-40 flex flex-col items-center gap-2">
                                                    <Layers className="w-6 h-6" />
                                                    <span className="text-[9px] font-bold">Sin Materiales Facturados En Sap</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="p-4 border-t border-divider bg-muted/20 flex justify-between items-center px-8">
                        <span className="text-[8px] font-bold text-muted-foreground">© 2026 Mt Industrial S.A.C - Sistema de Liquidaciones</span>
                        <div className="flex gap-4">
                            <div className="flex items-center gap-1.5 opacity-60">
                                <div className="w-2 h-2 rounded-full bg-primary"></div>
                                <span className="text-[8px] font-bold">Servicios</span>
                            </div>
                            <div className="flex items-center gap-1.5 opacity-60">
                                <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                                <span className="text-[8px] font-bold">Materiales</span>
                            </div>
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};
