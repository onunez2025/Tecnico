import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ThreeDBar } from './ThreeDBar';
import { DashboardService } from '../../services/dashboardService';
import { ChevronLeft, Maximize2, Minimize2, ArrowLeft } from 'lucide-react';
import { cn } from '../../utils/cn';

interface CASPerformanceChartProps {
    className?: string;
}

export const CASPerformanceChart: React.FC<CASPerformanceChartProps> = ({ className }) => {
    const [data, setData] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [viewLevel, setViewLevel] = useState<'zones' | 'companies' | 'monthly'>('zones');
    const [selectedZone, setSelectedZone] = useState<string | null>(null);
    const [selectedCasId, setSelectedCasId] = useState<string | null>(null);
    const [selectedCasName, setSelectedCasName] = useState<string | null>(null);
    const [isFullscreen, setIsFullscreen] = useState(false);

    const COLORS = [
        '#6366f1', '#3b82f6', '#0ea5e9', '#10b981', '#84cc16', '#eab308', '#f59e0b', '#f97316'
    ];

    useEffect(() => {
        fetchData();
    }, [viewLevel, selectedZone, selectedCasId]);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const result = await DashboardService.getCasPerformance(selectedZone || undefined, selectedCasId || undefined);
            setData(result);
        } catch (error) {
            console.error("Error fetching performance data:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleBarClick = (item: any) => {
        if (viewLevel === 'zones') {
            setSelectedZone(item.name);
            setViewLevel('companies');
        } else if (viewLevel === 'companies') {
            setSelectedCasId(item.id_cas);
            setSelectedCasName(item.name);
            setViewLevel('monthly');
        }
    };

    const handleBack = () => {
        if (viewLevel === 'monthly') {
            setSelectedCasId(null);
            setSelectedCasName(null);
            setViewLevel('companies');
        } else if (viewLevel === 'companies') {
            setSelectedZone(null);
            setViewLevel('zones');
        }
    };

    if (isLoading) return (
        <div className="h-[400px] flex items-center justify-center bg-card rounded-2xl border border-divider shadow-md">
            <div className="flex flex-col items-center gap-3">
                <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                <span className="text-xs font-bold text-muted-foreground animate-pulse italic">Generando Gráficos 3D...</span>
            </div>
        </div>
    );

    const chartWidth = 1000;
    const chartHeight = 280;
    const barWidth = 60;
    const items = Array.isArray(data) ? data : [];
    const spacing = (chartWidth - (barWidth * items.length)) / (items.length + 1);
    const maxValue = items.length > 0 ? Math.max(...items.map((d: any) => Number(d.value || 0))) : 100;
    const totalValue = items.reduce((acc, d) => acc + Number(d.value || 0), 0);

    return (
        <div className={cn(
            "bg-card rounded-2xl border border-divider shadow-md transition-all flex flex-col relative group h-full",
            isFullscreen ? "fixed inset-4 z-[100] bg-background/95 backdrop-blur-xl shadow-2xl border-primary/20" : "p-6"
        )}>
            {isFullscreen && <div className="absolute inset-0 bg-primary/[0.02] pointer-events-none" />}

            <div className={cn("flex justify-between items-start mb-6 relative z-10", isFullscreen && "p-6 pb-0")}>
                <div className="flex flex-col">
                    <h3 className="text-sm font-bold flex items-center gap-2">
                        {viewLevel === 'zones' && 'Rendimiento Por Zonas'}
                        {viewLevel === 'companies' && `Empresas: ${selectedZone}`}
                        {viewLevel === 'monthly' && `Evolución Mensual: ${selectedCasName}`}
                    </h3>
                    <p className="text-[10px] text-muted-foreground font-bold mt-1 opacity-70">
                        Monto Liquidado S/ (2026)
                    </p>
                </div>
                
                <div className="flex items-center gap-2">
                    {viewLevel !== 'zones' && (
                        <button 
                            onClick={handleBack}
                            className="p-2.5 bg-card border border-divider rounded-xl text-primary hover:bg-primary/5 transition-all shadow-sm active:scale-95 group/back"
                            title="Volver"
                        >
                            <ArrowLeft className="w-5 h-5 group-hover/back:-translate-x-1 transition-transform" />
                        </button>
                    )}
                    <button 
                        onClick={() => setIsFullscreen(!isFullscreen)}
                        className="p-2.5 bg-card border border-divider rounded-xl text-muted-foreground hover:text-primary hover:border-primary/50 transition-all shadow-sm active:scale-95"
                    >
                        {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
                    </button>
                </div>
            </div>

            <div className={cn("w-full transition-all relative z-10 flex-1", isFullscreen ? "px-16 pb-20" : "h-[280px]")}>
                <svg viewBox={`0 0 ${chartWidth} ${chartHeight + 110}`} className="w-full h-full drop-shadow-2xl overflow-visible">
                    {items.map((item, i) => {
                        const val = Number(item?.value || 0);
                        const barHeight = (val / (maxValue || 1)) * (chartHeight * 0.6);
                        const x = spacing + (i * (barWidth + spacing));
                        const y = chartHeight - 50 - barHeight;
                        const percentage = totalValue > 0 ? ((val / totalValue) * 100).toFixed(1) : "0";
                        
                        return (
                            <ThreeDBar
                                key={`${item?.name || i}-${i}`}
                                x={x}
                                y={y}
                                width={barWidth}
                                height={barHeight}
                                color={COLORS[i % COLORS.length]}
                                value={val}
                                count={item?.count}
                                percentage={percentage}
                                label={item?.name || '---'}
                                delay={i * 0.1}
                                onClick={() => handleBarClick(item)}
                            />
                        );
                    })}

                    {items.map((item, i) => {
                        const xPos = spacing + (i * (barWidth + spacing)) + barWidth / 2;
                        const labelText = item?.name || '';
                        return (
                            <g key={`label-${i}`}>
                                <text
                                    x={xPos}
                                    y={chartHeight - 30}
                                    textAnchor={items.length > 6 ? "end" : "middle"}
                                    transform={items.length > 6 ? `rotate(-25, ${xPos}, ${chartHeight - 30})` : ""}
                                    className={cn(
                                        "font-bold fill-foreground/90",
                                        "text-[17px]"
                                    )}
                                >
                                    {labelText.length > 20 ? labelText.substring(0, 18) + '...' : labelText}
                                </text>
                            </g>
                        );
                    })}

                    <defs>
                        <linearGradient id="trendGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#6366f1" />
                            <stop offset="50%" stopColor="#c084fc" />
                            <stop offset="100%" stopColor="#f43f5e" />
                        </linearGradient>
                    </defs>
                </svg>
            </div>
            
        </div>
    );
};
