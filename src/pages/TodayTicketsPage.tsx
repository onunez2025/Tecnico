import React, { useState, useEffect } from 'react';
import {
    CalendarDays,
    Search,
    RefreshCw,
    MapPin,
    User,
    Clock,
    Phone,
    ChevronRight,
    AlertCircle
} from 'lucide-react';
import { ApiClient } from '../services/apiClient';
import { cn } from '../utils/cn';

interface Ticket {
    id: string;
    Estado: string;
    FechaVisita: string;
    Cliente: string;
    Distrito: string;
    Direccion: string;
    BloqueHorario: string;
    Asunto: string;
    Contacto: string;
}

export default function TodayTicketsPage() {
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [refreshKey, setRefreshKey] = useState(0);

    useEffect(() => {
        const fetchTickets = async () => {
            setIsLoading(true);
            try {
                const data = await ApiClient.request<Ticket[]>('/tec/today-tickets');
                setTickets(data);
            } catch (error) {
                console.error("Error fetching today's tickets:", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchTickets();
    }, [refreshKey]);

    const filteredTickets = tickets.filter(t =>
        t.id.toLowerCase().includes(search.toLowerCase()) ||
        t.Cliente.toLowerCase().includes(search.toLowerCase()) ||
        t.Distrito.toLowerCase().includes(search.toLowerCase())
    );

    const formatTime = (dateStr: string) => {
        if (!dateStr) return '--:--';
        const date = new Date(dateStr);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div className="flex flex-col h-full bg-background text-foreground">
            {/* Header Area */}
            <div className="bg-card p-6 shadow-sm border-b border-border sticky top-0 z-10">
                <div className="flex justify-between items-center mb-4">
                    <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                        <CalendarDays className="w-6 h-6 text-primary" />
                        Tickets de Hoy
                    </h1>
                    <button
                        onClick={() => setRefreshKey(k => k + 1)}
                        className="p-2 hover:bg-muted rounded-full transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                        disabled={isLoading}
                    >
                        <RefreshCw className={cn("w-5 h-5 text-muted-foreground", isLoading && "animate-spin")} />
                    </button>
                </div>

                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder="Buscar por ticket, cliente o distrito..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-9 pr-4 py-2.5 bg-muted border-none rounded-xl text-sm text-foreground focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground"
                    />
                </div>
            </div>

            {/* List Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {isLoading ? (
                    <div className="flex justify-center p-12">
                        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                    </div>
                ) : filteredTickets.length === 0 ? (
                    <div className="text-center p-12 bg-card rounded-3xl border border-dashed border-border">
                        <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                            <AlertCircle className="w-8 h-8 text-muted-foreground" />
                        </div>
                        <p className="font-bold text-foreground">No hay tickets para hoy</p>
                        <p className="text-sm text-muted-foreground mt-1">Disfruta de tu tiempo libre o revisa más tarde.</p>
                    </div>
                ) : (
                    filteredTickets.map((ticket) => (
                        <div
                            key={ticket.id}
                            className="bg-card rounded-2xl p-4 shadow-sm border border-border/50 hover:border-primary/30 transition-all group"
                        >
                            <div className="flex justify-between items-start mb-3">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-foreground text-lg">{ticket.id}</span>
                                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-primary/10 text-primary border border-primary/20 uppercase">
                                            {ticket.Estado}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                                        <Clock className="w-3 h-3" />
                                        <span>Bloque: {ticket.BloqueHorario || 'Pendiente'}</span>
                                    </div>
                                </div>
                                <div className="bg-primary/5 p-2 rounded-xl group-hover:bg-primary/10 transition-colors min-w-[40px] min-h-[40px] flex items-center justify-center">
                                    <ChevronRight className="w-5 h-5 text-primary" />
                                </div>
                            </div>

                            <div className="space-y-2.5">
                                <div className="flex items-start gap-3">
                                    <User className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-sm font-bold text-foreground leading-none">{ticket.Cliente}</p>
                                        <p className="text-xs text-muted-foreground mt-1">{ticket.Asunto}</p>
                                    </div>
                                </div>

                                <div className="flex items-start gap-3">
                                    <MapPin className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-xs font-medium text-foreground">{ticket.Distrito}</p>
                                        <p className="text-xs text-muted-foreground">{ticket.Direccion}</p>
                                    </div>
                                </div>

                                {ticket.Contacto && (
                                    <div className="flex items-center gap-3 pt-2 border-t border-border/30">
                                        <Phone className="w-4 h-4 text-muted-foreground" />
                                        <a href={`tel:${ticket.Contacto}`} className="text-xs font-bold text-primary hover:underline">
                                            {ticket.Contacto}
                                        </a>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
