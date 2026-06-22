import React, { useState, useEffect } from 'react';
import { 
    Calendar, 
    RefreshCw, 
    Briefcase,
    Users,
    ChevronRight,
    Search,
    AlertCircle
} from 'lucide-react';
import { ApiClient } from '../services/apiClient';
import { cn } from '../utils/cn';

interface ScheduleItem {
    id: number;
    date: string;
    title: string;
    type: string;
}

export default function SchedulePage() {
    const [items, setItems] = useState<ScheduleItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [refreshKey, setRefreshKey] = useState(0);

    useEffect(() => {
        const fetchSchedule = async () => {
            setIsLoading(true);
            try {
                const data = await ApiClient.request<ScheduleItem[]>('/tec/schedule');
                setItems(data);
            } catch (error) {
                console.error("Error fetching schedule:", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchSchedule();
    }, [refreshKey]);

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('es-PE', { 
            weekday: 'long', 
            day: 'numeric', 
            month: 'long' 
        });
    };

    const filteredItems = items.filter(item => 
        item.title.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="flex flex-col h-full bg-slate-50">
            {/* Header */}
            <div className="bg-white p-6 shadow-sm border-b border-slate-200 sticky top-0 z-10">
                <div className="flex justify-between items-center mb-4">
                    <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                        <Calendar className="w-6 h-6 text-primary" />
                        Cronograma
                    </h1>
                    <button 
                        onClick={() => setRefreshKey(k => k + 1)}
                        className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                        disabled={isLoading}
                    >
                        <RefreshCw className={cn("w-5 h-5 text-slate-500", isLoading && "animate-spin")} />
                    </button>
                </div>

                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input 
                        type="text"
                        placeholder="Buscar talleres o reuniones..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-9 pr-4 py-2.5 bg-slate-100 border-none rounded-xl text-sm focus:ring-2 focus:ring-primary/20"
                    />
                </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-4 pb-20 space-y-4 lg:pb-4">
                {isLoading ? (
                    <div className="flex justify-center p-12">
                        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                    </div>
                ) : filteredItems.length === 0 ? (
                    <div className="text-center p-12 bg-white rounded-3xl border border-dashed border-slate-200">
                        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <AlertCircle className="w-8 h-8 text-slate-400" />
                        </div>
                        <p className="font-bold text-slate-900">Sin eventos próximos</p>
                        <p className="text-sm text-slate-500 mt-1">No tienes talleres o reuniones programadas.</p>
                    </div>
                ) : (
                    // Group by date or just list? For mobile, a list with date labels is good
                    filteredItems.map((item) => (
                        <div 
                            key={item.id} 
                            className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 hover:border-primary/30 transition-all group relative overflow-hidden"
                        >
                            {/* Accent Line */}
                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary/20 group-hover:bg-primary transition-colors" />
                            
                            <div className="pl-2">
                                <div className="flex justify-between items-start mb-2">
                                    <div className="flex items-center gap-2 text-xs font-bold text-primary uppercase tracking-wider">
                                        <Users className="w-3.5 h-3.5" />
                                        {item.type}
                                    </div>
                                    <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-0.5 rounded border border-slate-100 uppercase">
                                        Confirmado
                                    </span>
                                </div>
                                
                                <h3 className="font-bold text-slate-800 text-base mb-1 group-hover:text-primary transition-colors">
                                    {item.title}
                                </h3>
                                
                                <div className="flex items-center gap-3 mt-3 pt-3 border-t border-slate-50">
                                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                        <Calendar className="w-3.5 h-3.5" />
                                        <span className="capitalize">{formatDate(item.date)}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                        <Briefcase className="w-3.5 h-3.5" />
                                        <span>Presencial</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
