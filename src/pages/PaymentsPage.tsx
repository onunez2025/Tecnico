import React, { useState, useEffect } from 'react';
import {
    Search,
    Plus,
    RefreshCw,
    X,
    DollarSign,
    CheckCircle2,
    Clock,
    AlertCircle,
    Users,
    User as UserIcon,
} from 'lucide-react';
import { ApiClient } from '../services/apiClient';
import { Modal } from '../components/common/Modal';
import { useAuth } from '../hooks/useAuth';
import { useDialog } from '../context/DialogContext';
import type { TicketPago } from '../types';
import { cn } from '../utils/cn';
import { SIATC_THEME } from '../utils/siatc-theme';

interface EnrichedTicketPago extends TicketPago {
    Tecnico?: string;
    Cliente?: string;
    Distrito?: string;
    Direccion?: string;
    FechaVisita?: string;
}

const formatDate = (date: any) => {
    if (!date) return '—';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('es-PE', { timeZone: 'UTC' });
};

const getStatusConfig = (status: string | undefined) => {
    switch (status) {
        case 'LIQUIDADO':           return { badge: cn(SIATC_THEME.STATES.BADGE_BASE, SIATC_THEME.STATES.SUCCESS),   icon: CheckCircle2, label: 'Liquidado' };
        case 'RECEPCIONADO':        return { badge: cn(SIATC_THEME.STATES.BADGE_BASE, SIATC_THEME.STATES.INFO),      icon: CheckCircle2, label: 'Recepcionado' };
        case 'RECHAZADO':           return { badge: cn(SIATC_THEME.STATES.BADGE_BASE, SIATC_THEME.STATES.ERROR),     icon: X,            label: 'Rechazado' };
        case 'PENDIENTE_APROBACION':return { badge: cn(SIATC_THEME.STATES.BADGE_BASE, SIATC_THEME.STATES.WARNING),   icon: Clock,        label: 'Pend. Aprobación' };
        case 'REVISAR':             return { badge: cn(SIATC_THEME.STATES.BADGE_BASE, SIATC_THEME.STATES.ERROR),     icon: AlertCircle,  label: 'Revisar' };
        default:                    return { badge: cn(SIATC_THEME.STATES.BADGE_BASE, SIATC_THEME.STATES.SECONDARY), icon: Clock,        label: status || 'Pendiente' };
    }
};

export default function PaymentsPage() {
    const { hasPermission, user } = useAuth();
    const { alert } = useDialog();
    const [payments, setPayments] = useState<EnrichedTicketPago[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const limit = 20;

    const canViewAll = hasPermission('tec.payments.view.all');
    const canRegister = hasPermission('tec.payments.register');

    // Modal de creación
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [newPayment, setNewPayment] = useState({
        ticket: '',
        fecha_transaccion: new Date().toISOString().split('T')[0],
        voucher: '',
        lote: '',
        codigo_izipay: '',
        codigo_autorizacion: '',
        folio: '',
        importe: '',
        canal: 'POS',
        observacion: ''
    });

    const [ticketSearch, setTicketSearch] = useState('');
    const [ticketSuggestions, setTicketSuggestions] = useState<any[]>([]);
    const [isSearchingTicket, setIsSearchingTicket] = useState(false);
    const [showTicketDropdown, setShowTicketDropdown] = useState(false);
    const [isFetchingTicket, setIsFetchingTicket] = useState(false);

    useEffect(() => {
        const timer = setTimeout(async () => {
            if (ticketSearch.trim().length >= 3) {
                setIsSearchingTicket(true);
                try {
                    const res = await ApiClient.request<any[]>(`/sap/tickets/search?q=${encodeURIComponent(ticketSearch)}`);
                    setTicketSuggestions(res);
                    setShowTicketDropdown(true);
                } catch { /* silent */ } finally { setIsSearchingTicket(false); }
            } else {
                setTicketSuggestions([]);
                setShowTicketDropdown(false);
            }
        }, 500);
        return () => clearTimeout(timer);
    }, [ticketSearch]);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const dataRes = await ApiClient.request<{ data: any[]; total: number }>(
                `/tickets-pagos?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}&status=all`
            );
            setPayments(dataRes.data);
            setTotal(dataRes.total);
        } catch { /* silent */ } finally { setIsLoading(false); }
    };

    useEffect(() => { fetchData(); }, [page, search]);

    const handleAddTicket = (ticketId: string) => {
        const current = newPayment.ticket ? newPayment.ticket.split(',').map(t => t.trim()).filter(Boolean) : [];
        if (!current.includes(ticketId)) {
            setNewPayment(prev => ({ ...prev, ticket: [...current, ticketId].join(', ') }));
            fetchTicketDataAsync(ticketId);
        }
        setTicketSearch('');
        setShowTicketDropdown(false);
    };

    const handleRemoveTicket = (ticketId: string) => {
        const current = newPayment.ticket.split(',').map(t => t.trim()).filter(Boolean);
        setNewPayment(prev => ({ ...prev, ticket: current.filter(t => t !== ticketId).join(', ') }));
    };

    const fetchTicketDataAsync = async (ticketId: string) => {
        setIsFetchingTicket(true);
        try {
            const details = await ApiClient.request<{ sap?: { header?: { Total_documento?: number; Folio?: string } } }>(`/tickets-pagos/${ticketId}/details`);
            if (details?.sap?.header) {
                setNewPayment(prev => ({
                    ...prev,
                    importe: String(details.sap!.header!.Total_documento || prev.importe || ''),
                    folio: details.sap!.header!.Folio || prev.folio,
                }));
            }
        } catch { /* silent */ } finally { setIsFetchingTicket(false); }
    };

    const handleCreatePayment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newPayment.ticket) {
            alert({ title: 'Error', message: 'Debe agregar al menos un ticket.', type: 'error' });
            return;
        }
        setIsSaving(true);
        try {
            await ApiClient.request('/tickets-pagos', { method: 'POST', body: JSON.stringify(newPayment) });
            setShowCreateModal(false);
            setNewPayment({ ticket: '', fecha_transaccion: new Date().toISOString().split('T')[0], voucher: '', lote: '', codigo_izipay: '', codigo_autorizacion: '', folio: '', importe: '', canal: 'POS', observacion: '' });
            await fetchData();
            alert({ title: 'Éxito', message: 'Pago registrado correctamente', type: 'success' });
        } catch (err) {
            alert({ title: 'Error', message: 'Error al registrar pago: ' + (err instanceof Error ? err.message : 'Error desconocido'), type: 'error' });
        } finally { setIsSaving(false); }
    };

    const inputClass = "w-full px-3 py-3 bg-cb-bg border border-cb-border rounded-cb-btn text-sm text-cb-text-primary focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all";

    return (
        <div className="flex-1 flex flex-col min-h-0 bg-cb-bg pb-20">

            {/* Header sticky */}
            <div className="bg-card border-b border-cb-border px-4 pt-4 pb-3 sticky top-0 z-10 shadow-cb-level-1">
                <div className="flex items-center gap-2 mb-0.5">
                    {canViewAll ? (
                        <Users className="w-5 h-5 text-primary shrink-0" />
                    ) : (
                        <DollarSign className="w-5 h-5 text-primary shrink-0" />
                    )}
                    <h1 className={SIATC_THEME.TYPOGRAPHY.PAGE_TITLE}>
                        {canViewAll ? 'Todos los Pagos' : 'Mis Pagos'}
                    </h1>
                </div>
                <p className="text-xs text-cb-text-secondary mb-3">
                    {canViewAll ? 'Historial completo de registros del equipo' : 'Historial de tus registros y cobros'}
                </p>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cb-neutral" />
                    <input
                        type="text"
                        placeholder="Buscar por ticket o autorización..."
                        value={search}
                        onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                        className="w-full pl-9 pr-4 py-2.5 bg-cb-bg border border-cb-border rounded-cb-btn text-sm text-cb-text-primary focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                    />
                </div>
            </div>

            {/* Lista */}
            <div className="flex-1 overflow-y-auto p-4 pb-20 space-y-3 lg:pb-4">
                {isLoading ? (
                    <div className="flex justify-center items-center p-12">
                        <RefreshCw className="w-6 h-6 text-primary animate-spin" />
                    </div>
                ) : payments.length === 0 ? (
                    <div className={cn(SIATC_THEME.COMPONENTS.CARD_CONTAINER, "flex flex-col items-center justify-center p-10 gap-3 border-dashed")}>
                        <DollarSign className="w-10 h-10 text-cb-neutral/40" />
                        <p className="font-bold text-cb-text-primary">No se encontraron pagos</p>
                        <p className="text-sm text-cb-text-secondary text-center">
                            {search ? 'Intenta con otra búsqueda.' : (canRegister ? 'Registra un nuevo pago usando el botón (+)' : 'No tienes pagos registrados aún.')}
                        </p>
                    </div>
                ) : (
                    payments.map((payment, idx) => {
                        const { badge, icon: StatusIcon, label } = getStatusConfig(payment.Estado);
                        const itemKey = payment.ID_transaccion || `ticket-${payment.Ticket}-${idx}`;
                        return (
                            <div key={itemKey} className={cn(SIATC_THEME.COMPONENTS.CARD_CONTAINER, "p-4 flex flex-col gap-3")}>
                                {/* Fila principal: ticket + monto */}
                                <div className="flex justify-between items-start gap-3">
                                    <div className="min-w-0">
                                        <div className="flex flex-wrap items-center gap-2 mb-1">
                                            <span className={SIATC_THEME.TYPOGRAPHY.SECTION_TITLE}>{payment.Ticket || 'Sin Ticket'}</span>
                                            <span className={badge}>
                                                <StatusIcon className="w-3 h-3" />
                                                {label}
                                            </span>
                                        </div>
                                        <p className="text-xs text-cb-text-secondary">{formatDate(payment.Fecha_transaccion)}</p>
                                        {canViewAll && payment.Tecnico && (
                                            <div className="flex items-center gap-1 mt-1">
                                                <UserIcon className="w-3 h-3 text-cb-neutral shrink-0" />
                                                <p className="text-xs text-cb-neutral truncate">{payment.Tecnico}</p>
                                            </div>
                                        )}
                                    </div>
                                    <div className="text-right shrink-0">
                                        <p className="font-bold text-lg text-primary tabular-nums">S/ {parseFloat(payment.Importe || '0').toFixed(2)}</p>
                                        <span className={cn(SIATC_THEME.STATES.BADGE_BASE, SIATC_THEME.STATES.SECONDARY, "mt-1")}>{payment.Canal}</span>
                                    </div>
                                </div>

                                {/* Detalles por canal */}
                                {payment.Canal === 'POS' ? (
                                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 bg-cb-bg border border-cb-border rounded-cb-btn p-3 text-xs">
                                        {[
                                            { label: 'Lote',        value: payment.Lote },
                                            { label: 'Voucher',     value: payment.Voucher },
                                            { label: 'Izipay',      value: payment.Codigo_Izipay },
                                            { label: 'Autorización',value: payment.CodigoAutorizacion },
                                        ].map(({ label: lbl, value }) => (
                                            <div key={lbl}>
                                                <span className="block text-[10px] font-bold uppercase tracking-wider text-cb-neutral mb-0.5">{lbl}</span>
                                                <span className="font-medium text-cb-text-primary">{value || '—'}</span>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="bg-cb-bg border border-cb-border rounded-cb-btn p-3 text-xs">
                                        <span className="block text-[10px] font-bold uppercase tracking-wider text-cb-neutral mb-0.5">Cod. Operación</span>
                                        <span className="font-medium text-cb-text-primary">{payment.Codigo_transaccion || payment.CodigoAutorizacion || '—'}</span>
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>

            {/* Paginación */}
            {total > limit && (
                <div className="px-4 py-3 flex justify-between items-center bg-card border-t border-cb-border shrink-0">
                    <button
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className={cn(SIATC_THEME.COMPONENTS.BUTTON_SECONDARY, "disabled:opacity-40")}
                    >
                        Anterior
                    </button>
                    <span className="text-xs font-bold text-cb-text-secondary tabular-nums">
                        {page} de {Math.ceil(total / limit)}
                        <span className="text-cb-neutral font-normal"> · {total} registros</span>
                    </span>
                    <button
                        onClick={() => setPage(p => p + 1)}
                        disabled={page >= Math.ceil(total / limit)}
                        className={cn(SIATC_THEME.COMPONENTS.BUTTON_SECONDARY, "disabled:opacity-40")}
                    >
                        Siguiente
                    </button>
                </div>
            )}

            {/* FAB registrar */}
            {canRegister && (
                <button
                    onClick={() => setShowCreateModal(true)}
                    className="fixed bottom-20 right-5 w-14 h-14 bg-primary text-primary-foreground rounded-full shadow-lg shadow-primary/30 flex items-center justify-center hover:scale-105 active:scale-95 transition-all z-20"
                    aria-label="Registrar pago"
                >
                    <Plus className="w-6 h-6" />
                </button>
            )}

            {/* Modal crear pago */}
            <Modal isOpen={showCreateModal} onClose={() => !isSaving && setShowCreateModal(false)} title="Registrar Pago">
                <form onSubmit={handleCreatePayment} className="space-y-4 p-1">
                    {/* Búsqueda de ticket */}
                    <div>
                        <label className="block text-sm font-bold text-cb-text-primary mb-1.5">Buscar Ticket</label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cb-neutral" />
                            <input
                                type="text"
                                inputMode="numeric"
                                value={ticketSearch}
                                onChange={(e) => setTicketSearch(e.target.value)}
                                className={cn(inputClass, "pl-9")}
                                placeholder="Escribe el ticket (ej. 24000123)"
                            />
                            {isSearchingTicket && <RefreshCw className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary animate-spin" />}
                            {showTicketDropdown && ticketSuggestions.length > 0 && (
                                <div className="absolute z-50 w-full mt-1 bg-card border border-cb-border rounded-cb-card shadow-cb-level-2 max-h-60 overflow-y-auto">
                                    {ticketSuggestions.map((t, i) => (
                                        <div key={i} onClick={() => handleAddTicket(t.id)} className="px-4 py-3 hover:bg-cb-bg cursor-pointer border-b border-cb-border last:border-0 flex justify-between items-center gap-2">
                                            <span className="font-bold text-cb-text-primary text-sm">{t.id}</span>
                                            <div className="text-right">
                                                {t.total && <span className="text-sm font-bold text-primary">S/ {t.total}</span>}
                                                <p className="text-xs text-cb-text-secondary truncate max-w-[140px]">{t.cliente || 'Sin cliente'}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                            {showTicketDropdown && ticketSearch.length >= 3 && ticketSuggestions.length === 0 && !isSearchingTicket && (
                                <div className="absolute z-50 w-full mt-1 bg-card border border-cb-border rounded-cb-card shadow-cb-level-2 p-4 text-center text-sm text-cb-text-secondary">No se encontraron tickets en SAP</div>
                            )}
                        </div>
                    </div>

                    {/* Tickets seleccionados */}
                    {newPayment.ticket && (
                        <div className="flex flex-wrap gap-2">
                            {newPayment.ticket.split(',').map(t => t.trim()).filter(Boolean).map(t => (
                                <span key={t} className="inline-flex items-center gap-1 px-3 py-1.5 bg-primary/10 text-primary font-bold text-sm rounded-cb-btn border border-primary/20">
                                    {t}
                                    <button type="button" onClick={() => handleRemoveTicket(t)} className="hover:text-red-500 p-0.5 rounded-full hover:bg-red-50 transition-colors">
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                </span>
                            ))}
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-sm font-bold text-cb-text-primary mb-1.5">Monto (S/)</label>
                            <input type="text" inputMode="decimal" required value={newPayment.importe} onChange={(e) => setNewPayment({ ...newPayment, importe: e.target.value })}
                                className={cn(inputClass, "text-lg font-bold text-primary")} placeholder="0.00" />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-cb-text-primary mb-1.5">Canal</label>
                            <select required value={newPayment.canal} onChange={(e) => setNewPayment({ ...newPayment, canal: e.target.value })}
                                className={cn(inputClass, "font-bold")}>
                                <option value="POS">POS IZIPAY</option>
                                <option value="TRANSFERENCIA">TRANSFERENCIA</option>
                                <option value="DEPOSITO">DEPÓSITO</option>
                                <option value="EFECTIVO">EFECTIVO</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-cb-text-primary mb-1.5">Fecha</label>
                        <input type="date" required value={newPayment.fecha_transaccion} onChange={(e) => setNewPayment({ ...newPayment, fecha_transaccion: e.target.value })} className={inputClass} />
                    </div>

                    {newPayment.canal === 'POS' ? (
                        <div className="grid grid-cols-2 gap-3 bg-cb-bg border border-cb-border p-3 rounded-cb-btn">
                            {[
                                { label: 'Lote',        key: 'lote',                  placeholder: 'Ej. 123' },
                                { label: 'Voucher',     key: 'voucher',               placeholder: 'Ej. 456' },
                                { label: 'Cód. Izipay', key: 'codigo_izipay',         placeholder: 'Ej. 789' },
                                { label: 'Autorización',key: 'codigo_autorizacion',   placeholder: 'Obligatorio', required: true },
                            ].map(({ label: lbl, key, placeholder, required: req }) => (
                                <div key={key}>
                                    <label className="block text-xs font-bold text-cb-text-secondary mb-1">{lbl}</label>
                                    <input type="text" inputMode="numeric" required={req} placeholder={placeholder}
                                        value={(newPayment as any)[key]}
                                        onChange={(e) => setNewPayment({ ...newPayment, [key]: e.target.value })}
                                        className="w-full px-3 py-2.5 bg-card border border-cb-border rounded-cb-btn text-sm text-cb-text-primary focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all" />
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div>
                            <label className="block text-sm font-bold text-cb-text-primary mb-1.5">Código de Operación</label>
                            <input type="text" inputMode="numeric" required value={newPayment.codigo_autorizacion}
                                onChange={(e) => setNewPayment({ ...newPayment, codigo_autorizacion: e.target.value })}
                                className={inputClass} placeholder="N° de operación bancaria" />
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-bold text-cb-text-primary mb-1.5">Observación (Opcional)</label>
                        <textarea value={newPayment.observacion} onChange={(e) => setNewPayment({ ...newPayment, observacion: e.target.value })}
                            className="w-full px-3 py-3 bg-cb-bg border border-cb-border rounded-cb-btn text-sm text-cb-text-primary focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all resize-none h-20"
                            placeholder="Notas adicionales..." />
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button type="button" onClick={() => setShowCreateModal(false)} className={cn(SIATC_THEME.COMPONENTS.BUTTON_SECONDARY, "flex-1 h-11")}>Cancelar</button>
                        <button type="submit" disabled={isSaving || isFetchingTicket} className={cn(SIATC_THEME.COMPONENTS.BUTTON_PRIMARY, "flex-1 h-11 disabled:opacity-50")}>
                            {isSaving ? <><RefreshCw className="w-4 h-4 animate-spin" /> Guardando...</> : 'Guardar'}
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
