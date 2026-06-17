import React, { useState, useEffect, useMemo } from 'react';
import {
    Calendar as CalendarIcon,
    ChevronLeft,
    ChevronRight,
    Search,
    RefreshCw,
    MapPin,
    User as UserIcon,
    Clock,
    Phone,
    AlertCircle,
    CheckCircle2,
    XCircle,
    Navigation,
    Check,
    Tag,
    FileText,
    Sliders,
    Lock,
    Database,
    X
} from 'lucide-react';
import { ApiClient } from '../services/apiClient';
import { cn } from '../utils/cn';
import { useAuth } from '../hooks/useAuth';
import { AssignedTicket, TicketPago } from '../types';

export default function TicketsCalendarPage() {
    const { user } = useAuth();
    const isAdmin = user?.role_name?.toLowerCase() === 'administrador';

    // Dates state
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
    
    // Tickets state
    const [tickets, setTickets] = useState<AssignedTicket[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [refreshKey, setRefreshKey] = useState(0);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    // Selected ticket for Drawer
    const [activeTicket, setActiveTicket] = useState<AssignedTicket | null>(null);

    // Filter by Technician (For Admin use)
    const [techFilterCode, setTechFilterCode] = useState<string>('');

    // Calendar summary: días del mes con tickets { 'YYYY-MM-DD': count }
    const [ticketDates, setTicketDates] = useState<Record<string, number>>({});

    // Limit configurations & Assign Modal states
    const [limitTime, setLimitTime] = useState<string>('09:30');
    const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
    const [assignTicket, setAssignTicket] = useState<AssignedTicket | null>(null);

    // Form fields for modal
    const [rangoHorario, setRangoHorario] = useState('');
    const [ordenAtencion, setOrdenAtencion] = useState('');
    const [comentario, setComentario] = useState('');
    const [applyToAllClientTickets, setApplyToAllClientTickets] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [modalError, setModalError] = useState<string | null>(null);

    // Payment details states
    const [activeTicketPayments, setActiveTicketPayments] = useState<TicketPago[]>([]);
    const [isLoadingPayments, setIsLoadingPayments] = useState(false);

    // Informe técnico C4C
    const [isLoadingInforme, setIsLoadingInforme] = useState(false);
    const handleVerInforme = async (ticketId: string) => {
        setIsLoadingInforme(true);
        try {
            const blob = await ApiClient.download(`/tec/tickets/${ticketId}/informe`);
            const url = URL.createObjectURL(blob);
            window.open(url, '_blank');
            setTimeout(() => URL.revokeObjectURL(url), 60000);
        } catch (err: any) {
            alert(err?.message || 'No se pudo obtener el informe técnico desde C4C.');
        } finally {
            setIsLoadingInforme(false);
        }
    };

    // Payment form states
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [importePago, setImportePago] = useState('');
    const [canalPago, setCanalPago] = useState<'POS' | 'Link' | 'Transferencia' | 'Efectivo' | 'DEPÓSITO'>('POS');
    const [fechaTransaccion, setFechaTransaccion] = useState(new Date().toISOString().split('T')[0]);
    const [voucherPago, setVoucherPago] = useState('');
    const [lotePago, setLotePago] = useState('');
    const [codigoIzipay, setCodigoIzipay] = useState('');
    const [codigoAutorizacion, setCodigoAutorizacion] = useState('');
    const [codigoTransaccion, setCodigoTransaccion] = useState('');
    const [observacionPago, setObservacionPago] = useState('');
    const [adjuntoFile, setAdjuntoFile] = useState<File | null>(null);
    const [isSavingPayment, setIsSavingPayment] = useState(false);
    const [paymentError, setPaymentError] = useState<string | null>(null);

    // Fetch payments for ticket
    // [FIX FE-M10] Added paymentsError state to surface load failures in the UI
    const [paymentsError, setPaymentsError] = useState<string | null>(null);
    const fetchPaymentsForActiveTicket = async (ticketId: string) => {
        setIsLoadingPayments(true);
        setPaymentsError(null);
        try {
            const data = await ApiClient.request(`/tec/tickets/${ticketId}/pagos`) as TicketPago[];
            setActiveTicketPayments(data || []);
        } catch (err: unknown) {
            console.error('Error loading payments for ticket:', err);
            setPaymentsError('No se pudieron cargar los pagos. Intenta nuevamente.');
        } finally {
            setIsLoadingPayments(false);
        }
    };

    useEffect(() => {
        if (activeTicket?.id) {
            fetchPaymentsForActiveTicket(activeTicket.id);
        } else {
            setActiveTicketPayments([]);
        }
    }, [activeTicket?.id]);

    const openPaymentModal = () => {
        setImportePago('');
        setCanalPago('POS');
        setFechaTransaccion(new Date().toISOString().split('T')[0]);
        setVoucherPago('');
        setLotePago('');
        setCodigoIzipay('');
        setCodigoAutorizacion('');
        setCodigoTransaccion('');
        setObservacionPago('');
        setAdjuntoFile(null);
        setPaymentError(null);
        setIsPaymentModalOpen(true);
    };

    const handleSavePayment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!activeTicket) return;

        setIsSavingPayment(true);
        setPaymentError(null);

        try {
            const formData = new FormData();
            formData.append('fecha_transaccion', fechaTransaccion);
            formData.append('importe', importePago);
            formData.append('canal', canalPago);
            formData.append('observacion', observacionPago);
            
            if (canalPago === 'POS') {
                formData.append('voucher', voucherPago);
                formData.append('lote', lotePago);
                formData.append('codigo_izipay', codigoIzipay);
                formData.append('codigo_autorizacion', codigoAutorizacion);
            } else if (['Transferencia', 'Link', 'DEPÓSITO'].includes(canalPago)) {
                formData.append('voucher', codigoTransaccion);
                formData.append('codigo_autorizacion', codigoTransaccion);
            }

            if (adjuntoFile) {
                formData.append('adjunto', adjuntoFile);
            }

            await ApiClient.request(`/tec/tickets/${activeTicket.id}/pago`, {
                method: 'POST',
                body: formData
            });

            await fetchPaymentsForActiveTicket(activeTicket.id);
            setRefreshKey(k => k + 1);
            setIsPaymentModalOpen(false);
        } catch (err: any) {
            console.error("Error saving payment:", err);
            setPaymentError(err.message || "Ocurrió un error al registrar el pago.");
        } finally {
            setIsSavingPayment(false);
        }
    };

    // Fetch calendar summary for current month (dots on calendar days)
    useEffect(() => {
        const fetchCalendarSummary = async () => {
            const year = currentMonth.getFullYear();
            const month = String(currentMonth.getMonth() + 1).padStart(2, '0');
            try {
                let url = `/tec/tickets/calendar-summary?month=${year}-${month}`;
                if (isAdmin && techFilterCode.trim()) url += `&techCode=${encodeURIComponent(techFilterCode.trim())}`;
                const data = await ApiClient.request<Record<string, number>>(url);
                setTicketDates(data || {});
            } catch {
                // silent — dots are decorative, don't block UX on error
            }
        };
        fetchCalendarSummary();
    }, [currentMonth, techFilterCode, isAdmin, refreshKey]);

    // Fetch config limit
    useEffect(() => {
        const fetchLimitConfig = async () => {
            try {
                const res = await ApiClient.request('/config/rango-horario-limit') as { limit: string };
                if (res?.limit) {
                    setLimitTime(res.limit);
                }
            } catch (err) {
                console.error("Error fetching limit config:", err);
            }
        };
        fetchLimitConfig();
    }, [refreshKey]);

    const checkCanEdit = (ticket: AssignedTicket) => {
        if (isAdmin) return true;
        if (!ticket.FechaVisita) return false;

        const now = new Date();
        const localDateStr = now.toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
        const visitDateStr = new Date(ticket.FechaVisita).toLocaleDateString('en-CA', { timeZone: 'America/Lima' });

        if (visitDateStr < localDateStr) {
            return false;
        }

        if (visitDateStr > localDateStr) {
            return true;
        }

        // It is today! Check the limit time
        const localTimeStr = now.toLocaleTimeString('en-US', { timeZone: 'America/Lima', hour12: false });
        const [currHour, currMin] = localTimeStr.split(':').map(Number);
        const [limitHour, limitMin] = limitTime.split(':').map(Number);

        if (currHour > limitHour) return false;
        if (currHour === limitHour && currMin >= limitMin) return false;

        return true;
    };

    const openAssignModal = (ticket: AssignedTicket) => {
        setAssignTicket(ticket);
        setRangoHorario(ticket.RangoHorario || '');
        setOrdenAtencion(ticket.OrdenAtencion || '');
        setComentario(ticket.ComentarioHorario || '');
        setApplyToAllClientTickets(false);
        setModalError(null);
        setIsAssignModalOpen(true);
    };

    const handleSaveRangoHorario = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!assignTicket) return;

        setIsSubmitting(true);
        setModalError(null);

        try {
            await ApiClient.request('/tec/tickets/rango-horario', {
                method: 'POST',
                body: JSON.stringify({
                    ticketId: assignTicket.id,
                    rangoHorario,
                    ordenAtencion,
                    comentario,
                    applyToAllClientTickets
                })
            });

            setRefreshKey(k => k + 1);
            setIsAssignModalOpen(false);
            setAssignTicket(null);
        } catch (err: any) {
            console.error("Error saving rango horario:", err);
            setModalError(err.message || "Ocurrió un error al guardar el rango horario.");
        } finally {
            setIsSubmitting(false);
        }
    };

    // Fetch tickets when selected date, technician filter, or refreshKey changes
    useEffect(() => {
        const fetchTickets = async () => {
            setIsLoading(true);
            setErrorMsg(null);
            try {
                const year = selectedDate.getFullYear();
                const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
                const day = String(selectedDate.getDate()).padStart(2, '0');
                const formattedDate = `${year}-${month}-${day}`;

                let url = `/tec/tickets?date=${formattedDate}`;
                if (isAdmin && techFilterCode.trim()) {
                    url += `&techCode=${encodeURIComponent(techFilterCode.trim())}`;
                }

                const data = (await ApiClient.request(url)) as AssignedTicket[];
                setTickets(data);
                
                // If drawer is open, update activeTicket data if it was reloaded
                if (activeTicket) {
                    const updated = data.find((t: AssignedTicket) => t.id === activeTicket.id);
                    if (updated) {
                        setActiveTicket(updated);
                    }
                }
            } catch (err: any) {
                console.error("Error fetching tickets:", err);
                setErrorMsg(err.message || "Error al cargar los tickets de la base de datos.");
            } finally {
                setIsLoading(false);
            }
        };

        fetchTickets();
    }, [selectedDate, techFilterCode, refreshKey, isAdmin]);

    // Handle Month Navigation in Calendar
    const prevMonth = () => {
        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
    };

    const nextMonth = () => {
        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
    };



    // [FIX FE-M3] Memoize filteredTickets to avoid recomputing on every keystroke render
    const filteredTickets = useMemo(() => tickets.filter(ticket => {
        const query = searchQuery.toLowerCase().trim();
        if (!query) return true;
        return (
            ticket.id.toLowerCase().includes(query) ||
            (ticket.Cliente && ticket.Cliente.toLowerCase().includes(query)) ||
            (ticket.Distrito && ticket.Distrito.toLowerCase().includes(query)) ||
            (ticket.Servicio && ticket.Servicio.toLowerCase().includes(query)) ||
            (ticket.NombreTecnico && ticket.NombreTecnico.toLowerCase().includes(query)) ||
            (ticket.ApellidoTecnico && ticket.ApellidoTecnico.toLowerCase().includes(query))
        );
    }), [tickets, searchQuery]);

    // [FIX FE-M3] Memoize metrics and daysGrid
    const totalCount = tickets.length;
    const completedCount = useMemo(
        () => tickets.filter(t => t.VisitaRealizada === 'true' || t.Estado?.toLowerCase() === 'closed').length,
        [tickets]
    );
    const pendingCount = totalCount - completedCount;

    // [FIX FE-M3] Memoize calendar grid
    const daysGrid = useMemo(() => {
        const year = currentMonth.getFullYear();
        const month = currentMonth.getMonth();
        const firstDayOfMonth = new Date(year, month, 1);
        const lastDayOfMonth = new Date(year, month + 1, 0);
        const daysInMonth = lastDayOfMonth.getDate();
        const startDayOfWeek = firstDayOfMonth.getDay();
        const grid: (Date | null)[] = [];
        for (let i = 0; i < startDayOfWeek; i++) grid.push(null);
        for (let day = 1; day <= daysInMonth; day++) grid.push(new Date(year, month, day));
        return grid;
    }, [currentMonth]);

    const monthName = currentMonth.toLocaleString('es-PE', { month: 'long', year: 'numeric' });

    // Helper for formatting times
    const formatTime = (dateStr?: string) => {
        if (!dateStr) return '';
        try {
            const date = new Date(dateStr);
            return date.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: true });
        } catch {
            return '';
        }
    };

    // Helper to get status color badge
    const getStatusBadge = (ticket: AssignedTicket) => {
        const isRealizada = ticket.VisitaRealizada === 'true';
        const estado = ticket.Estado?.toLowerCase();

        if (isRealizada || estado === 'closed') {
            return (
                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-green-500/10 text-green-600 border border-green-500/20 flex items-center gap-1 shrink-0">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Realizado
                </span>
            );
        } else if (estado === 'cancelled' || estado === 'rechazado') {
            return (
                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-red-500/10 text-red-500 border border-red-500/20 flex items-center gap-1 shrink-0">
                    <XCircle className="w-3.5 h-3.5" />
                    Cancelado
                </span>
            );
        } else if (estado === 'observado' || ticket.SolicitaNuevaVisita === 'true') {
            return (
                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20 flex items-center gap-1 shrink-0">
                    <AlertCircle className="w-3.5 h-3.5" />
                    Observado
                </span>
            );
        } else {
            return (
                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-primary/10 text-primary border border-primary/20 flex items-center gap-1 shrink-0">
                    <Clock className="w-3.5 h-3.5" />
                    Programado
                </span>
            );
        }
    };

    return (
        <div className="flex h-full bg-background text-foreground relative overflow-hidden">
            {/* Calendar Sidebar (Left) */}
            <div className="w-80 bg-card border-r border-border flex flex-col shrink-0 p-5 hidden md:flex">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Calendario</h2>
                    <div className="flex gap-1">
                        <button
                            onClick={prevMonth}
                            className="min-w-[44px] min-h-[44px] flex items-center justify-center hover:bg-accent hover:text-accent-foreground rounded-lg transition-colors border border-border"
                            aria-label="Mes anterior"
                        >
                            <ChevronLeft className="w-4 h-4 text-foreground" />
                        </button>
                        <button
                            onClick={nextMonth}
                            className="min-w-[44px] min-h-[44px] flex items-center justify-center hover:bg-accent hover:text-accent-foreground rounded-lg transition-colors border border-border"
                            aria-label="Mes siguiente"
                        >
                            <ChevronRight className="w-4 h-4 text-foreground" />
                        </button>
                    </div>
                </div>

                <div className="text-center font-bold text-foreground text-sm mb-4 capitalize">
                    {monthName}
                </div>

                {/* Calendar Grid */}
                <div className="grid grid-cols-7 gap-1 text-center text-xs mb-2">
                    {['D', 'L', 'M', 'M', 'J', 'V', 'S'].map((day, idx) => (
                        <div key={idx} className="font-bold text-muted-foreground/60 py-1">{day}</div>
                    ))}
                    {daysGrid.map((date, idx) => {
                        if (!date) return <div key={`empty-${idx}`} className="py-2"></div>;

                        const isSelected = selectedDate.getDate() === date.getDate() &&
                                           selectedDate.getMonth() === date.getMonth() &&
                                           selectedDate.getFullYear() === date.getFullYear();

                        const isToday = new Date().getDate() === date.getDate() &&
                                        new Date().getMonth() === date.getMonth() &&
                                        new Date().getFullYear() === date.getFullYear();

                        const dateKey = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
                        const hasTickets = !!ticketDates[dateKey];

                        return (
                            <button
                                key={`day-${idx}`}
                                onClick={() => setSelectedDate(date)}
                                className={cn(
                                    "py-2 rounded-xl text-xs font-semibold transition-all relative flex flex-col items-center justify-center aspect-square",
                                    isSelected
                                        ? "bg-primary text-primary-foreground shadow-md shadow-primary/20 scale-105 font-bold"
                                        : "hover:bg-accent hover:text-accent-foreground text-foreground",
                                    isToday && !isSelected && "border border-primary/40 text-primary font-bold"
                                )}
                            >
                                {date.getDate()}
                                {hasTickets && !isToday && (
                                    <span className={cn(
                                        "w-1 h-1 rounded-full absolute bottom-1",
                                        isSelected ? "bg-primary-foreground" : "bg-primary"
                                    )} />
                                )}
                                {isToday && (
                                    <span className={cn(
                                        "w-1.5 h-1.5 rounded-full absolute bottom-1.5",
                                        isSelected ? "bg-primary-foreground" : "bg-primary"
                                    )} />
                                )}
                            </button>
                        );
                    })}
                </div>

                <button 
                    onClick={() => {
                        setSelectedDate(new Date());
                        setCurrentMonth(new Date());
                    }}
                    className="mt-6 w-full py-2 border border-border rounded-xl text-xs font-bold text-foreground hover:bg-muted transition-colors"
                >
                    Ir a Hoy
                </button>

                {isAdmin && (
                    <div className="mt-8 border-t border-border pt-6">
                        <div className="flex items-center gap-2 mb-3">
                            <Lock className="w-4 h-4 text-muted-foreground" />
                            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Filtro Administrativo</span>
                        </div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1">Código de Técnico</label>
                        <input
                            type="text"
                            placeholder="Ej. 3838"
                            value={techFilterCode}
                            onChange={(e) => setTechFilterCode(e.target.value)}
                            className="w-full px-3 py-2 text-xs border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                        />
                        {techFilterCode && (
                            <button 
                                onClick={() => setTechFilterCode('')}
                                className="mt-2 text-[10px] text-red-500 hover:underline font-bold"
                            >
                                Limpiar filtro
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Tickets Panel (Right) */}
            <div className="flex-1 flex flex-col h-full overflow-hidden bg-background">
                {/* Header Info */}
                <div className="bg-card border-b border-border p-4 flex flex-col gap-3">
                    <div className="flex justify-between items-start md:items-center flex-col md:flex-row gap-4">
                        <div>
                            <span className="text-xs font-bold text-primary uppercase tracking-wider">Mis Tickets Asignados</span>
                        </div>
                        
                        <div className="flex items-center gap-2 self-stretch md:self-auto">
                            {/* Mobile Datepicker */}
                            <div className="relative md:hidden flex-1">
                                <input 
                                    type="date" 
                                    value={selectedDate.toISOString().split('T')[0]}
                                    onChange={(e) => {
                                        if (e.target.value) {
                                            const parts = e.target.value.split('-');
                                            setSelectedDate(new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2])));
                                        }
                                    }}
                                    className="w-full px-3 py-2 border border-border rounded-xl text-sm font-semibold bg-background text-foreground focus:ring-2 focus:ring-primary/20"
                                />
                            </div>

                            <button 
                                onClick={() => setRefreshKey(k => k + 1)}
                                className="p-2 border border-border hover:bg-muted rounded-xl transition-colors shrink-0 text-foreground"
                                title="Recargar lista"
                            >
                                <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
                            </button>
                        </div>
                    </div>

                    {/* Summary Metrics Cards */}
                    <div className="grid grid-cols-3 gap-3">
                        <div className="bg-primary/10 border border-primary/20 rounded-2xl p-3 flex flex-col justify-between">
                            <span className="text-xs font-bold text-primary">Total</span>
                            <span className="text-2xl font-black text-foreground mt-1">{totalCount}</span>
                        </div>
                        <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-3 flex flex-col justify-between">
                            <span className="text-xs font-bold text-green-500">Realizados</span>
                            <span className="text-2xl font-black text-green-900 dark:text-green-200 mt-1">{completedCount}</span>
                        </div>
                        <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-3 flex flex-col justify-between">
                            <span className="text-xs font-bold text-amber-500">Pendientes</span>
                            <span className="text-2xl font-black text-amber-900 dark:text-amber-200 mt-1">{pendingCount}</span>
                        </div>
                    </div>

                    {/* Search and Filters */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60" />
                        <input 
                            type="text"
                            placeholder="Buscar por ticket, cliente, distrito o servicio..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 border border-border rounded-xl text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                        />
                    </div>

                    {/* Mobile Admin Filter */}
                    {isAdmin && (
                        <div className="md:hidden flex gap-2 items-center">
                            <label className="text-xs font-bold text-muted-foreground whitespace-nowrap">Código Técnico:</label>
                            <input
                                type="text"
                                placeholder="Ej. 3838"
                                value={techFilterCode}
                                onChange={(e) => setTechFilterCode(e.target.value)}
                                className="flex-1 px-3 py-1.5 text-xs border border-border rounded-lg bg-background text-foreground focus:outline-none"
                            />
                        </div>
                    )}
                </div>

                {/* Tickets list */}
                <div className="flex-1 overflow-y-auto p-3 space-y-3">
                    {isLoading ? (
                        <div className="flex justify-center py-20">
                            <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                        </div>
                    ) : errorMsg ? (
                        <div className="text-center py-12 bg-destructive/10 border border-destructive/20 rounded-3xl p-6 max-w-lg mx-auto">
                            <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-3" />
                            <h3 className="font-bold text-foreground text-lg">Error de Carga</h3>
                            <p className="text-sm text-muted-foreground mt-1">{errorMsg}</p>
                            <button 
                                onClick={() => setRefreshKey(k => k + 1)}
                                className="mt-4 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl text-xs font-bold transition-colors"
                            >
                                Intentar Nuevamente
                            </button>
                        </div>
                    ) : filteredTickets.length === 0 ? (
                        <div className="text-center py-16 bg-card rounded-3xl border border-dashed border-border p-8 max-w-lg mx-auto">
                            <div className="w-16 h-16 bg-muted/30 rounded-full flex items-center justify-center mx-auto mb-4">
                                <CalendarIcon className="w-8 h-8 text-muted-foreground/60" />
                            </div>
                            <h3 className="font-bold text-foreground text-lg">Sin tickets asignados</h3>
                            <p className="text-sm text-muted-foreground mt-1 font-medium">
                                No se encontraron tickets de servicio asignados para este técnico en la fecha seleccionada.
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                            {filteredTickets.map((ticket) => {
                                const isSelected = activeTicket?.id === ticket.id;
                                return (
                                    <div
                                        key={ticket.id}
                                        onClick={() => setActiveTicket(ticket)}
                                        className={cn(
                                            "bg-card rounded-xl p-3 shadow-sm border transition-all cursor-pointer flex flex-col justify-between group",
                                            isSelected
                                                ? "border-primary ring-2 ring-primary/10 shadow-md"
                                                : "border-border/50 hover:border-border hover:shadow-md dark:hover:shadow-none"
                                        )}
                                    >
                                        <div className="flex justify-between items-start gap-2 mb-2">
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-black text-foreground text-base group-hover:text-primary transition-colors">
                                                        #{ticket.id}
                                                    </span>
                                                    {getStatusBadge(ticket)}
                                                </div>
                                                <h3 className="font-bold text-foreground text-xs mt-1">
                                                    {ticket.Servicio || 'Servicio Técnico'}
                                                </h3>
                                                {ticket.Asunto && (
                                                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                                                        {ticket.Asunto}
                                                    </p>
                                                )}
                                            </div>
                                            <div className="bg-muted/40 group-hover:bg-primary/10 p-1.5 rounded-lg transition-colors shrink-0">
                                                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                                            </div>
                                        </div>

                                        <div className="space-y-1.5 pt-2 border-t border-border/50">
                                            <div className="flex items-start gap-2.5 text-xs">
                                                <UserIcon className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
                                                <span className="font-semibold text-foreground">{ticket.Cliente || 'Sin Cliente'}</span>
                                            </div>
                                            <div className="flex items-start gap-2.5 text-xs">
                                                <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
                                                <div>
                                                    <span className="font-bold text-foreground">{ticket.Distrito}</span>
                                                    <span className="text-muted-foreground block text-[11px] leading-tight mt-0.5">
                                                        {ticket.Calle} {ticket.NumeroCalle}
                                                    </span>
                                                </div>
                                            </div>
                                            {ticket.FechaVisita && (
                                                <div className="flex items-center gap-2.5 text-xs text-muted-foreground">
                                                    <Clock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                                                    <span>Visita: {formatTime(ticket.FechaVisita)}</span>
                                                </div>
                                            )}

                                            {ticket.RangoHorario && (
                                                <div className="flex items-center gap-2 mt-2 bg-primary/10 border border-primary/20 text-primary px-3 py-1.5 rounded-xl text-xs font-semibold max-w-max">
                                                    <Clock className="w-3.5 h-3.5" />
                                                    <span>{ticket.RangoHorario} {ticket.OrdenAtencion ? `(Orden: ${ticket.OrdenAtencion})` : ''}</span>
                                                </div>
                                            )}

                                            {!ticket.RangoHorario && checkCanEdit(ticket) && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        openAssignModal(ticket);
                                                    }}
                                                    className="mt-3 w-full py-2 bg-primary/10 hover:bg-primary/20 border border-primary/20 hover:border-primary/30 text-primary rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                                                >
                                                    <Clock className="w-3.5 h-3.5" />
                                                    Asignar Rango Horario
                                                </button>
                                            )}

                                            {!ticket.RangoHorario && !checkCanEdit(ticket) && (() => {
                                                const now = new Date();
                                                const localDateStr = now.toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
                                                const visitDateStr = ticket.FechaVisita ? new Date(ticket.FechaVisita).toLocaleDateString('en-CA', { timeZone: 'America/Lima' }) : '';
                                                if (visitDateStr === localDateStr) {
                                                    return (
                                                        <div className="mt-3 w-full py-2 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 opacity-80 cursor-not-allowed">
                                                            <Lock className="w-3.5 h-3.5" />
                                                            Bloqueado (Límite vencido)
                                                        </div>
                                                    );
                                                }
                                                return null;
                                            })()}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Slide-over Ticket Detail Drawer (Right panel overlay) */}
            {activeTicket && (
                <div className="absolute inset-0 z-50 flex justify-end">
                    {/* Overlay background */}
                    <div 
                        className="absolute inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity duration-300"
                        onClick={() => setActiveTicket(null)}
                    />
                    
                    {/* Drawer content */}
                    <div className="relative w-full max-w-lg h-full bg-card shadow-2xl flex flex-col animate-in fade-in slide-in-from-right duration-300">
                        {/* Header */}
                        <div className="p-6 border-b border-border flex items-center justify-between bg-muted/30">
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Detalles de Ticket</span>
                                    {getStatusBadge(activeTicket)}
                                </div>
                                <h2 className="text-xl font-black text-foreground mt-1">Ticket #{activeTicket.id}</h2>
                            </div>
                            <button
                                onClick={() => setActiveTicket(null)}
                                className="p-2 hover:bg-accent hover:text-accent-foreground rounded-xl transition-colors border border-border min-w-[44px] min-h-[44px] flex items-center justify-center"
                                aria-label="Cerrar detalle"
                            >
                                <X className="w-5 h-5 text-foreground" />
                            </button>
                        </div>

                        {/* Detail Body */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            {/* Section: Cliente */}
                            <div className="bg-muted/30 rounded-2xl p-4 border border-border/50">
                                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                                    <UserIcon className="w-3.5 h-3.5" />
                                    Cliente
                                </h3>
                                <div className="space-y-3">
                                    <div>
                                        <p className="text-sm font-bold text-foreground">{activeTicket.Cliente || 'No especificado'}</p>
                                        <p className="text-xs text-muted-foreground mt-0.5 font-medium">Código Cliente: {activeTicket.IdCliente || 'No especificado'}</p>
                                    </div>
                                    
                                    {activeTicket.Email && (
                                        <div>
                                            <p className="text-[10px] text-muted-foreground uppercase font-semibold">Correo Electrónico</p>
                                            <a href={`mailto:${activeTicket.Email}`} className="text-xs font-semibold text-primary hover:underline block break-all mt-0.5">
                                                {activeTicket.Email}
                                            </a>
                                        </div>
                                    )}

                                    {/* Phone Contact details */}
                                    {(activeTicket.Celular1 || activeTicket.Celular2 || activeTicket.Telefono1) && (
                                        <div className="pt-2 border-t border-border/50">
                                            <p className="text-[10px] text-muted-foreground uppercase font-semibold mb-2">Contacto Telefónico</p>
                                            <div className="flex flex-col gap-2">
                                                {activeTicket.Celular1 && (
                                                    <a 
                                                        href={`tel:${activeTicket.Celular1}`} 
                                                        className="flex items-center gap-2 text-xs font-bold text-foreground bg-card hover:bg-accent hover:text-accent-foreground border border-border p-2 rounded-xl transition-colors max-w-max"
                                                    >
                                                        <Phone className="w-3.5 h-3.5 text-primary" />
                                                        Llamar: {activeTicket.Celular1}
                                                    </a>
                                                )}
                                                {activeTicket.Celular2 && (
                                                    <a 
                                                        href={`tel:${activeTicket.Celular2}`} 
                                                        className="flex items-center gap-2 text-xs font-bold text-foreground bg-card hover:bg-accent hover:text-accent-foreground border border-border p-2 rounded-xl transition-colors max-w-max"
                                                    >
                                                        <Phone className="w-3.5 h-3.5 text-primary" />
                                                        Llamar Alt: {activeTicket.Celular2}
                                                    </a>
                                                )}
                                                {activeTicket.Telefono1 && (
                                                    <a 
                                                        href={`tel:${activeTicket.Telefono1}`} 
                                                        className="flex items-center gap-2 text-xs font-bold text-foreground bg-card hover:bg-accent hover:text-accent-foreground border border-border p-2 rounded-xl transition-colors max-w-max"
                                                    >
                                                        <Phone className="w-3.5 h-3.5 text-primary" />
                                                        Fijo: {activeTicket.Telefono1}
                                                    </a>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Section: Ubicación */}
                            <div className="bg-muted/30 rounded-2xl p-4 border border-border/50">
                                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                                    <MapPin className="w-3.5 h-3.5" />
                                    Dirección y Ruta
                                </h3>
                                <div className="space-y-3">
                                    <div>
                                        <p className="text-xs font-bold text-foreground">
                                            {activeTicket.Calle} {activeTicket.NumeroCalle}
                                        </p>
                                        <p className="text-xs font-semibold text-muted-foreground mt-1">
                                            {activeTicket.Distrito}, {activeTicket.Ciudad || 'Lima'}, {activeTicket.Pais}
                                        </p>
                                    </div>

                                    {activeTicket.Referencia && (
                                        <div className="bg-card p-2.5 rounded-xl border border-border/50 text-xs">
                                            <span className="font-bold text-muted-foreground block mb-0.5">Referencia:</span>
                                            <span className="text-foreground">{activeTicket.Referencia}</span>
                                        </div>
                                    )}

                                    {/* Google Maps navigation button */}
                                    {activeTicket.Latitud && activeTicket.Longitud && (
                                        <a
                                            href={`https://www.google.com/maps/search/?api=1&query=${activeTicket.Latitud},${activeTicket.Longitud}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-2 text-xs font-bold text-white bg-primary hover:bg-primary/95 p-2.5 rounded-xl transition-all max-w-max shadow-sm"
                                        >
                                            <Navigation className="w-3.5 h-3.5" />
                                            Ver Ruta en Google Maps
                                        </a>
                                    )}
                                </div>
                            </div>

                            {/* Section: Cobros y Pagos */}
                            <div className="bg-muted/30 rounded-2xl p-4 border border-border/50">
                                <div className="flex justify-between items-center mb-3">
                                    <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                                        <Database className="w-3.5 h-3.5" />
                                        Cobros del Cliente
                                    </h3>
                                    <button
                                        onClick={openPaymentModal}
                                        className="text-[10px] font-black text-primary hover:underline uppercase tracking-wider"
                                    >
                                        + Registrar Pago
                                    </button>
                                </div>

                                {isLoadingPayments ? (
                                    <div className="flex justify-center py-4">
                                        <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                                    </div>
                                ) : paymentsError ? (
                                    <div className="text-center py-4 bg-destructive/10 border border-destructive/20 rounded-xl text-xs text-destructive font-semibold flex flex-col items-center gap-2">
                                        <AlertCircle className="w-4 h-4" />
                                        {paymentsError}
                                        <button
                                            onClick={() => activeTicket && fetchPaymentsForActiveTicket(activeTicket.id)}
                                            className="text-primary hover:underline font-bold"
                                        >
                                            Reintentar
                                        </button>
                                    </div>
                                ) : activeTicketPayments.length === 0 ? (
                                    <div className="text-center py-4 bg-card rounded-xl border border-dashed border-border text-xs text-muted-foreground">
                                        No se han registrado pagos para este ticket.
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {activeTicketPayments.map((pago) => (
                                            <div key={pago.ID_transaccion} className="bg-card border border-border/60 rounded-xl p-3 text-xs space-y-1.5">
                                                <div className="flex justify-between items-center">
                                                    <span className="font-extrabold text-foreground">S/ {pago.Importe}</span>
                                                    <span className={cn(
                                                        "px-2 py-0.5 rounded text-[9px] font-bold tracking-tighter uppercase",
                                                        // [FIX UX-M2] Added all missing Estado badge styles
                                                        pago.Estado === 'NUEVO' && "bg-slate-500/10 text-slate-500",
                                                        pago.Estado === 'LIQUIDADO' && "bg-green-500/10 text-green-500",
                                                        pago.Estado === 'APROBADO' && "bg-emerald-500/10 text-emerald-500",
                                                        pago.Estado === 'REVISAR' && "bg-amber-500/10 text-amber-500",
                                                        pago.Estado === 'OBSERVADO' && "bg-orange-500/10 text-orange-500",
                                                        pago.Estado === 'RECHAZADO' && "bg-red-500/10 text-red-500",
                                                        pago.Estado === 'RECEPCIONADO' && "bg-sky-500/10 text-sky-500",
                                                        pago.Estado === 'LIQUIDADO_OBSERVADO' && "bg-purple-500/10 text-purple-500",
                                                        pago.Estado === 'PENDIENTE_APROBACION' && "bg-primary/10 text-primary"
                                                    )}>
                                                        {pago.Estado}
                                                    </span>
                                                </div>
                                                <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[10px] text-muted-foreground">
                                                    <div>Canal: <span className="font-bold text-foreground">{pago.Canal}</span></div>
                                                    <div>Fecha: <span className="font-semibold text-foreground">{new Date(pago.Fecha_transaccion).toLocaleDateString('es-PE')}</span></div>
                                                    {pago.Voucher && (
                                                        <div className="col-span-2">Ref/Voucher: <span className="font-mono text-foreground font-semibold">{pago.Voucher}</span></div>
                                                    )}
                                                </div>
                                                {pago.Observacion && (
                                                    <p className="text-[10px] text-muted-foreground italic leading-snug border-t border-border/30 pt-1.5 mt-1">
                                                        "{pago.Observacion}"
                                                    </p>
                                                )}
                                                {pago.Adjunto && (
                                                    <a 
                                                        href={pago.Adjunto} 
                                                        target="_blank" 
                                                        rel="noopener noreferrer" 
                                                        className="inline-flex items-center gap-1 text-[10px] font-bold text-primary hover:underline pt-1"
                                                    >
                                                        <FileText className="w-3.5 h-3.5" />
                                                        Ver Comprobante
                                                    </a>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Section: Informe Técnico */}
                            <div className="bg-muted/30 rounded-2xl p-4 border border-border/50">
                                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                                    <FileText className="w-3.5 h-3.5" />
                                    Informe Técnico
                                </h3>
                                <button
                                    onClick={() => handleVerInforme(activeTicket.id)}
                                    disabled={isLoadingInforme}
                                    className="w-full flex items-center justify-center gap-2 py-2.5 bg-primary/10 hover:bg-primary/20 border border-primary/20 text-primary rounded-xl text-xs font-bold transition-all disabled:opacity-50"
                                >
                                    {isLoadingInforme ? (
                                        <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Cargando informe...</>
                                    ) : (
                                        <><FileText className="w-3.5 h-3.5" /> Ver Informe Técnico (C4C)</>
                                    )}
                                </button>
                            </div>

                            {/* Section: Rango Horario */}
                            <div className="bg-muted/30 rounded-2xl p-4 border border-border/50">
                                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                                    <Clock className="w-3.5 h-3.5" />
                                    Horario Programado
                                </h3>
                                <div className="space-y-3">
                                    {activeTicket.RangoHorario ? (
                                        <div className="space-y-2">
                                            <div className="grid grid-cols-2 gap-4 text-xs">
                                                <div>
                                                    <span className="text-[10px] text-muted-foreground uppercase font-semibold">Rango Horario</span>
                                                    <p className="font-bold text-foreground">{activeTicket.RangoHorario}</p>
                                                </div>
                                                <div>
                                                    <span className="text-[10px] text-muted-foreground uppercase font-semibold">Orden de Atención</span>
                                                    <p className="font-bold text-foreground">{activeTicket.OrdenAtencion || 'No asignada'}</p>
                                                </div>
                                            </div>
                                            {activeTicket.ComentarioHorario && (
                                                <div className="text-xs">
                                                    <span className="text-[10px] text-muted-foreground uppercase font-semibold">Comentario de Horario</span>
                                                    <p className="font-medium text-foreground mt-1 bg-card p-2 rounded-xl border border-border/50">
                                                        {activeTicket.ComentarioHorario}
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <p className="text-xs text-muted-foreground font-medium">No se ha asignado un rango horario para este servicio.</p>
                                    )}

                                    {checkCanEdit(activeTicket) ? (
                                        <button
                                            onClick={() => openAssignModal(activeTicket)}
                                            className="w-full py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 mt-2"
                                        >
                                            <Clock className="w-3.5 h-3.5" />
                                            {activeTicket.RangoHorario ? 'Modificar Rango Horario' : 'Asignar Rango Horario'}
                                        </button>
                                    ) : (
                                        <div className="flex items-center gap-1.5 text-xs text-red-500 font-bold bg-red-500/10 border border-red-500/20 p-2.5 rounded-xl mt-2">
                                            <Lock className="w-3.5 h-3.5 shrink-0" />
                                            <span>Asignación bloqueada (Límite vencido o fecha pasada)</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Section: Servicio */}
                            <div className="bg-muted/30 rounded-2xl p-4 border border-border/50">
                                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                                    <FileText className="w-3.5 h-3.5" />
                                    Detalle del Servicio
                                </h3>
                                <div className="space-y-3 text-xs">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <span className="text-[10px] text-muted-foreground uppercase font-semibold">Servicio</span>
                                            <p className="font-bold text-foreground">{activeTicket.Servicio || 'No especificado'}</p>
                                        </div>
                                        <div>
                                            <span className="text-[10px] text-muted-foreground uppercase font-semibold">Código FSM</span>
                                            <p className="font-bold text-foreground">{activeTicket.LlamadaFSM || 'No especificado'}</p>
                                        </div>
                                    </div>
                                    
                                    {activeTicket.Asunto && (
                                        <div>
                                            <span className="text-[10px] text-muted-foreground uppercase font-semibold">Asunto</span>
                                            <p className="font-semibold text-foreground mt-0.5">{activeTicket.Asunto}</p>
                                        </div>
                                    )}

                                    {activeTicket.ComentarioProgramador && (
                                        <div>
                                            <span className="text-[10px] text-muted-foreground uppercase font-semibold">Comentario Programador</span>
                                            <p className="font-semibold text-amber-700 dark:text-amber-300 mt-0.5 whitespace-pre-line bg-amber-500/10 p-2.5 rounded-xl border border-amber-500/20">
                                                {activeTicket.ComentarioProgramador}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Section: Equipo */}
                            <div className="bg-muted/30 rounded-2xl p-4 border border-border/50">
                                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                                    <Tag className="w-3.5 h-3.5" />
                                    Equipo
                                </h3>
                                <div className="space-y-2 text-xs">
                                    <div>
                                        <span className="text-[10px] text-muted-foreground uppercase font-semibold">Nombre del Equipo</span>
                                        <p className="font-bold text-foreground">{activeTicket.NombreEquipo || 'Sin equipo registrado'}</p>
                                    </div>
                                    {activeTicket.CodigoExternoEquipo && (
                                        <div>
                                            <span className="text-[10px] text-muted-foreground uppercase font-semibold">Código Externo Equipo</span>
                                            <p className="font-semibold text-muted-foreground mt-0.5">{activeTicket.CodigoExternoEquipo}</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Section: Reporte del Técnico (Progreso) */}
                            <div className="bg-muted/30 rounded-2xl p-4 border border-border/50">
                                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                                    <Sliders className="w-3.5 h-3.5" />
                                    Reporte del Técnico
                                </h3>
                                <div className="space-y-4 text-xs">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-card p-2.5 rounded-xl border border-border/50 flex items-center gap-2">
                                            {activeTicket.VisitaRealizada === 'true' ? (
                                                <Check className="w-4 h-4 text-green-500 shrink-0" />
                                            ) : (
                                                <XCircle className="w-4 h-4 text-muted-foreground/40 shrink-0" />
                                            )}
                                            <div>
                                                <span className="text-[9px] text-muted-foreground uppercase font-semibold block">Visita Realizada</span>
                                                <span className="font-bold text-foreground">
                                                    {activeTicket.VisitaRealizada === 'true' ? 'SÍ' : 'NO'}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="bg-card p-2.5 rounded-xl border border-border/50 flex items-center gap-2">
                                            {activeTicket.TrabajoRealizado === 'true' ? (
                                                <Check className="w-4 h-4 text-green-500 shrink-0" />
                                            ) : (
                                                <XCircle className="w-4 h-4 text-muted-foreground/40 shrink-0" />
                                            )}
                                            <div>
                                                <span className="text-[9px] text-muted-foreground uppercase font-semibold block">Trabajo Realizado</span>
                                                <span className="font-bold text-foreground">
                                                    {activeTicket.TrabajoRealizado === 'true' ? 'SÍ' : 'NO'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {activeTicket.SolicitaNuevaVisita === 'true' && (
                                        <div className="bg-amber-500/10 p-2.5 rounded-xl border border-amber-500/20 flex items-start gap-2">
                                            <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                                            <div>
                                                <span className="font-bold text-amber-700 dark:text-amber-300 block">Solicita Nueva Visita</span>
                                                {activeTicket.MotivoNuevaVisita && (
                                                    <p className="text-amber-600 dark:text-amber-400 mt-0.5 font-medium">{activeTicket.MotivoNuevaVisita}</p>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {activeTicket.ComentarioTecnico && (
                                        <div>
                                            <span className="text-[10px] text-muted-foreground uppercase font-semibold">Comentario del Técnico</span>
                                            <p className="font-semibold text-foreground mt-1 whitespace-pre-line bg-card p-3 rounded-xl border border-border/50">
                                                {activeTicket.ComentarioTecnico}
                                            </p>
                                        </div>
                                    )}

                                    {activeTicket.CheckOut && (
                                        <div>
                                            <span className="text-[10px] text-muted-foreground uppercase font-semibold">Hora de Cierre (Check Out)</span>
                                            <p className="font-bold text-foreground mt-0.5">
                                                {new Date(activeTicket.CheckOut).toLocaleDateString('es-PE')} - {formatTime(activeTicket.CheckOut)}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Asignación de Rango Horario */}
            {isAssignModalOpen && assignTicket && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <div 
                        className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
                        onClick={() => !isSubmitting && setIsAssignModalOpen(false)}
                    />
                    
                    {/* Modal Content */}
                    <div className="relative bg-card border border-border rounded-3xl w-full max-w-md p-6 shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col gap-4">
                        <div className="flex justify-between items-start">
                            <div>
                                <span className="text-xs font-bold text-primary uppercase tracking-wider">Planificación Horaria</span>
                                <h3 className="text-lg font-black text-foreground mt-1">Ticket #{assignTicket.id}</h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsAssignModalOpen(false)}
                                disabled={isSubmitting}
                                className="p-1.5 hover:bg-accent rounded-lg border border-border text-foreground hover:text-accent-foreground transition-colors shrink-0"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="text-xs border-b border-border/50 pb-3 space-y-1">
                            <p className="font-bold text-foreground">Cliente: <span className="font-medium text-muted-foreground">{assignTicket.Cliente}</span></p>
                            <p className="font-bold text-foreground">Dirección: <span className="font-medium text-muted-foreground">{assignTicket.Calle} {assignTicket.NumeroCalle}, {assignTicket.Distrito}</span></p>
                        </div>

                        {modalError && (
                            <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-3 rounded-xl text-xs font-bold flex items-center gap-2">
                                <AlertCircle className="w-4 h-4 shrink-0" />
                                <span>{modalError}</span>
                            </div>
                        )}

                        <form onSubmit={handleSaveRangoHorario} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Rango Horario</label>
                                <select
                                    value={rangoHorario}
                                    onChange={(e) => setRangoHorario(e.target.value)}
                                    required
                                    className="w-full px-3 py-2 text-sm border border-border rounded-xl bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                                >
                                    <option value="">Seleccione un rango...</option>
                                    <option value="07:00 am - 10:00 am">07:00 am - 10:00 am</option>
                                    <option value="09:00 am - 12:00 pm">09:00 am - 12:00 pm</option>
                                    <option value="12:00 pm - 03:00 pm">12:00 pm - 03:00 pm</option>
                                    <option value="02:00 pm - 05:00 pm">02:00 pm - 05:00 pm</option>
                                    <option value="04:00 pm - 07:00 pm">04:00 pm - 07:00 pm</option>
                                </select>
                            </div>

                            <div className="grid grid-cols-1 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Orden de Atención</label>
                                    <select
                                        value={ordenAtencion}
                                        onChange={(e) => setOrdenAtencion(e.target.value)}
                                        className="w-full px-3 py-2 text-sm border border-border rounded-xl bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                                    >
                                        <option value="">Sin orden específica</option>
                                        <option value="1">1 (Primero)</option>
                                        <option value="2">2 (Segundo)</option>
                                        <option value="3">3 (Tercero)</option>
                                        <option value="4">4 (Cuarto)</option>
                                        <option value="5">5 (Quinto)</option>
                                        <option value="6">6 (Sexto)</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Comentario / Observación</label>
                                <textarea
                                    value={comentario}
                                    onChange={(e) => setComentario(e.target.value)}
                                    placeholder="Comentario sobre la programación horaria..."
                                    rows={3}
                                    className="w-full px-3 py-2 text-sm border border-border rounded-xl bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                                />
                            </div>

                            {/* Bulk assignment check */}
                            {tickets.filter(t => t.IdCliente === assignTicket.IdCliente && t.id !== assignTicket.id).length > 0 && (
                                <div className="bg-primary/5 border border-primary/10 p-3 rounded-2xl flex items-start gap-2.5">
                                    <input
                                        type="checkbox"
                                        id="bulkCheck"
                                        checked={applyToAllClientTickets}
                                        onChange={(e) => setApplyToAllClientTickets(e.target.checked)}
                                        className="mt-0.5 rounded border-border text-primary focus:ring-primary/20 cursor-pointer"
                                    />
                                    <label htmlFor="bulkCheck" className="text-xs font-semibold text-foreground cursor-pointer select-none">
                                        Asignar este mismo rango de hora a todos los tickets de este cliente para el día de hoy ({tickets.filter(t => t.IdCliente === assignTicket.IdCliente).length} servicios)
                                    </label>
                                </div>
                            )}

                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setIsAssignModalOpen(false)}
                                    disabled={isSubmitting}
                                    className="flex-1 py-2 border border-border hover:bg-muted text-foreground text-xs font-bold rounded-xl transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="flex-1 py-2 bg-primary hover:bg-primary/95 text-primary-foreground text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5 shadow-md shadow-primary/10"
                                >
                                    {isSubmitting ? (
                                        <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin"></div>
                                    ) : (
                                        <>
                                            <Check className="w-4 h-4" />
                                            Guardar
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal de Registro de Pago de Cliente */}
            {isPaymentModalOpen && activeTicket && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <div 
                        className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
                        onClick={() => !isSavingPayment && setIsPaymentModalOpen(false)}
                    />
                    
                    {/* Modal Content */}
                    <div className="relative bg-card border border-border rounded-3xl w-full max-w-md p-6 shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col gap-4 max-h-[90vh] overflow-y-auto custom-scrollbar">
                        <div className="flex justify-between items-start">
                            <div>
                                <span className="text-xs font-bold text-primary uppercase tracking-wider">Transacción de Cobro</span>
                                <h3 className="text-lg font-black text-foreground mt-1">Registrar Pago - Ticket #{activeTicket.id}</h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsPaymentModalOpen(false)}
                                disabled={isSavingPayment}
                                className="p-1.5 hover:bg-accent rounded-lg border border-border text-foreground hover:text-accent-foreground transition-colors shrink-0"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {paymentError && (
                            <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-3 rounded-xl text-xs font-bold flex items-center gap-2">
                                <AlertCircle className="w-4 h-4 shrink-0" />
                                <span>{paymentError}</span>
                            </div>
                        )}

                        <form onSubmit={handleSavePayment} className="space-y-4">
                            {/* Importe */}
                            <div>
                                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Importe Cobrado (S/)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0.01"
                                    required
                                    placeholder="0.00"
                                    value={importePago}
                                    onChange={(e) => setImportePago(e.target.value)}
                                    className="w-full px-3 py-2 text-sm border border-border rounded-xl bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 font-bold"
                                />
                            </div>

                            {/* Canal */}
                            <div>
                                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Canal de Pago</label>
                                <select
                                    value={canalPago}
                                    onChange={(e) => setCanalPago(e.target.value as any)}
                                    required
                                    className="w-full px-3 py-2 text-sm border border-border rounded-xl bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                                >
                                    <option value="POS">Tarjeta (POS)</option>
                                    <option value="Transferencia">Transferencia Bancaria</option>
                                    <option value="Link">Pago por Link</option>
                                    <option value="DEPÓSITO">Depósito</option>
                                    <option value="Efectivo">Efectivo</option>
                                </select>
                            </div>

                            {/* Fecha de Pago */}
                            <div>
                                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Fecha de Transacción</label>
                                <input
                                    type="date"
                                    required
                                    value={fechaTransaccion}
                                    onChange={(e) => setFechaTransaccion(e.target.value)}
                                    className="w-full px-3 py-2 text-sm border border-border rounded-xl bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 font-semibold"
                                />
                            </div>

                            {/* Condicionales POS */}
                            {canalPago === 'POS' && (
                                <div className="space-y-4 bg-muted/40 p-4 rounded-2xl border border-border/40">
                                    <div className="text-xs font-bold text-primary mb-1 uppercase tracking-widest">Datos Izipay / POS</div>
                                    
                                    <div>
                                        <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Código de Autorización</label>
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            required
                                            placeholder="Ej: 123456"
                                            value={codigoAutorizacion}
                                            onChange={(e) => setCodigoAutorizacion(e.target.value)}
                                            className="w-full px-3 py-1.5 text-xs border border-border rounded-lg bg-background text-foreground focus:outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Número de Voucher / Operación</label>
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            required
                                            placeholder="Ej: 000311"
                                            value={voucherPago}
                                            onChange={(e) => setVoucherPago(e.target.value)}
                                            className="w-full px-3 py-1.5 text-xs border border-border rounded-lg bg-background text-foreground focus:outline-none"
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Lote</label>
                                            <input
                                                type="text"
                                                inputMode="numeric"
                                                required
                                                placeholder="Ej: 843"
                                                value={lotePago}
                                                onChange={(e) => setLotePago(e.target.value)}
                                                className="w-full px-3 py-1.5 text-xs border border-border rounded-lg bg-background text-foreground focus:outline-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Serie POS (Terminal)</label>
                                            <input
                                                type="text"
                                                inputMode="numeric"
                                                required
                                                placeholder="Ej: 5051490"
                                                value={codigoIzipay}
                                                onChange={(e) => setCodigoIzipay(e.target.value)}
                                                className="w-full px-3 py-1.5 text-xs border border-border rounded-lg bg-background text-foreground focus:outline-none"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Condicionales Transferencia / Link / Deposito */}
                            {['Transferencia', 'Link', 'DEPÓSITO'].includes(canalPago) && (
                                <div className="space-y-4 bg-muted/40 p-4 rounded-2xl border border-border/40">
                                    <div className="text-xs font-bold text-primary mb-1 uppercase tracking-widest">Datos Bancarios / Link</div>
                                    
                                    <div>
                                        <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Número de Transacción / Operación</label>
                                        <input
                                            type="text"
                                            required
                                            placeholder="Ej: TX987654321"
                                            value={codigoTransaccion}
                                            onChange={(e) => setCodigoTransaccion(e.target.value)}
                                            className="w-full px-3 py-1.5 text-xs border border-border rounded-lg bg-background text-foreground focus:outline-none font-mono"
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Foto / Adjunto (Obligatorio si no es Efectivo) */}
                            {canalPago !== 'Efectivo' && (
                                <div>
                                    <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Foto del Voucher / Recibo</label>
                                    <input
                                        type="file"
                                        accept="image/*,application/pdf"
                                        required
                                        onChange={(e) => setAdjuntoFile(e.target.files?.[0] || null)}
                                        className="w-full text-xs text-muted-foreground border border-border rounded-xl bg-background p-2.5 outline-none cursor-pointer file:mr-4 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-[11px] file:font-black file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                                    />
                                    <p className="text-[10px] text-muted-foreground mt-1">Sube una imagen o PDF nítido de la transacción bancaria.</p>
                                </div>
                            )}

                            {/* Observacion */}
                            <div>
                                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Comentarios</label>
                                <textarea
                                    value={observacionPago}
                                    onChange={(e) => setObservacionPago(e.target.value)}
                                    placeholder="Detalles adicionales o aclaraciones..."
                                    rows={2}
                                    className="w-full px-3 py-2 text-sm border border-border rounded-xl bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                                />
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setIsPaymentModalOpen(false)}
                                    disabled={isSavingPayment}
                                    className="flex-1 py-2.5 border border-border hover:bg-muted text-foreground text-xs font-bold rounded-xl transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSavingPayment}
                                    className="flex-1 py-2.5 bg-primary hover:bg-primary/95 text-primary-foreground text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5 shadow-md shadow-primary/10"
                                >
                                    {isSavingPayment ? (
                                        <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin"></div>
                                    ) : (
                                        <>
                                            <Check className="w-4 h-4" />
                                            Confirmar Pago
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
