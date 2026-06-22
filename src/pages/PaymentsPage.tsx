import React, { useState, useEffect } from 'react';
import {
    Search,
    Plus,
    RefreshCw,
    X,
    Activity,
    DollarSign,
    CheckCircle2,
    Clock,
    AlertCircle
} from 'lucide-react';
import { ApiClient } from '../services/apiClient';
import { Modal } from '../components/common/Modal';
import { useAuth } from '../hooks/useAuth';
import { useDialog } from '../context/DialogContext';
import type { TicketPago } from '../types';
import { cn } from '../utils/cn';

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

export default function PaymentsPage() {
    const { hasPermission } = useAuth();
    const { alert } = useDialog();
    const [payments, setPayments] = useState<EnrichedTicketPago[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    
    // Pagination and Filters
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const limit = 20;

    // Create Modal State
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

    // Ticket search states for create modal
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
                } catch (err) {
                    console.error("Error searching tickets:", err);
                } finally {
                    setIsSearchingTicket(false);
                }
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
            const queryParams = `page=${page}&limit=${limit}&search=${encodeURIComponent(search)}&status=all`;
            const dataRes = await ApiClient.request<{ data: any[]; total: number }>(`/tickets-pagos?${queryParams}`);
            setPayments(dataRes.data);
            setTotal(dataRes.total);
        } catch (err: any) {
            console.error("Error loading payments data:", err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { 
        fetchData();
    }, [page, search]);

    const handleAddTicket = (ticketId: string) => {
        const currentTickets = newPayment.ticket ? newPayment.ticket.split(',').map(t => t.trim()).filter(Boolean) : [];
        if (!currentTickets.includes(ticketId)) {
            setNewPayment(prev => ({
                ...prev,
                ticket: [...currentTickets, ticketId].join(', ')
            }));
            fetchTicketDataAsync(ticketId);
        }
        setTicketSearch('');
        setShowTicketDropdown(false);
    };

    const handleRemoveTicket = (ticketId: string) => {
        const currentTickets = newPayment.ticket.split(',').map(t => t.trim()).filter(Boolean);
        setNewPayment(prev => ({
            ...prev,
            ticket: currentTickets.filter(t => t !== ticketId).join(', ')
        }));
    };

    const fetchTicketDataAsync = async (ticketId: string) => {
        setIsFetchingTicket(true);
        try {
            const details = await ApiClient.request<{ sap?: { header?: { Total_documento?: number; Folio?: string } } }>(`/tickets-pagos/${ticketId}/details`);
            if (details && details.sap && details.sap.header) {
                setNewPayment(prev => ({
                    ...prev,
                    importe: String(details.sap!.header!.Total_documento || prev.importe || ''),
                    folio: details.sap!.header!.Folio || prev.folio,
                }));
            }
        } catch (err) {
            console.error("Error fetching ticket data:", err);
            // alert({ title: 'Error', message: 'No se pudo consultar el ticket en SAP.', type: 'error' });
        } finally {
            setIsFetchingTicket(false);
        }
    };

    const handleCreatePayment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newPayment.ticket) {
            alert({ title: 'Error', message: 'Debe agregar al menos un ticket.', type: 'error' });
            return;
        }
        setIsSaving(true);
        try {
            await ApiClient.request('/tickets-pagos', {
                method: 'POST',
                body: JSON.stringify(newPayment)
            });
            setShowCreateModal(false);
            setNewPayment({
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
            await fetchData();
            alert({ title: 'Éxito', message: 'Pago registrado correctamente', type: 'success' });
        } catch (err) {
            console.error("Error creating payment:", err);
            alert({ title: 'Error', message: 'Error al registrar pago: ' + (err instanceof Error ? err.message : 'Error desconocido'), type: 'error' });
        } finally {
            setIsSaving(false);
        }
    };

    const getStatusConfig = (status: string | undefined) => {
        switch (status) {
            case 'LIQUIDADO': return { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', icon: CheckCircle2, label: 'Liquidado' };
            case 'RECEPCIONADO': return { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', icon: CheckCircle2, label: 'Recepcionado' };
            case 'RECHAZADO': return { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', icon: X, label: 'Rechazado' };
            case 'PENDIENTE_APROBACION': return { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', icon: Clock, label: 'Pend. Aprobación' };
            case 'REVISAR': return { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', icon: AlertCircle, label: 'Revisar' };
            default: return { bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-200', icon: Activity, label: status || 'Pendiente' };
        }
    };

    return (
        <div className="flex-1 flex flex-col min-h-0 bg-slate-50/50 pb-20">
            {/* Header */}
            <div className="bg-white border-b border-border p-4 sticky top-0 z-10">
                <h1 className="text-xl font-bold text-slate-900">Mis Pagos</h1>
                <p className="text-sm text-slate-500 mb-3">Historial de registros y cobros</p>
                
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input 
                        type="text"
                        placeholder="Buscar por ticket o autorización..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-9 pr-4 py-2.5 bg-slate-100 border-none rounded-xl text-sm focus:ring-2 focus:ring-primary/20"
                    />
                </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-4 pb-20 space-y-3 lg:pb-4">
                {isLoading ? (
                    <div className="flex justify-center p-8">
                        <RefreshCw className="w-6 h-6 text-primary animate-spin" />
                    </div>
                ) : payments.length === 0 ? (
                    <div className="text-center p-8 text-slate-500 bg-white rounded-2xl border border-dashed border-slate-200">
                        <DollarSign className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                        <p className="font-medium">No se encontraron pagos</p>
                        <p className="text-sm">Registra un nuevo pago usando el botón (+)</p>
                    </div>
                ) : (
                    payments.map((payment, idx) => {
                        const statusConfig = getStatusConfig(payment.Estado);
                        const StatusIcon = statusConfig.icon;
                        const itemKey = payment.ID_transaccion || `ticket-${payment.Ticket}-${idx}`;

                        return (
                            <div key={itemKey} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex flex-col gap-3">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="font-bold text-slate-900">{payment.Ticket || 'Sin Ticket'}</span>
                                            <span className={cn("px-2 py-0.5 rounded-md text-[10px] font-bold border flex items-center gap-1", statusConfig.bg, statusConfig.text, statusConfig.border)}>
                                                <StatusIcon className="w-3 h-3" />
                                                {statusConfig.label}
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-500">{formatDate(payment.Fecha_transaccion)}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-bold text-lg text-primary">S/ {parseFloat(payment.Importe || '0').toFixed(2)}</p>
                                        <p className="text-[10px] font-medium text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded uppercase">{payment.Canal}</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl">
                                    {payment.Canal === 'POS' ? (
                                        <>
                                            <div>
                                                <span className="text-slate-400 block text-[10px] uppercase">Lote</span>
                                                <span className="font-medium">{payment.Lote || '-'}</span>
                                            </div>
                                            <div>
                                                <span className="text-slate-400 block text-[10px] uppercase">Voucher</span>
                                                <span className="font-medium">{payment.Voucher || '-'}</span>
                                            </div>
                                            <div>
                                                <span className="text-slate-400 block text-[10px] uppercase">Izipay</span>
                                                <span className="font-medium">{payment.Codigo_Izipay || '-'}</span>
                                            </div>
                                            <div>
                                                <span className="text-slate-400 block text-[10px] uppercase">Autorización</span>
                                                <span className="font-medium">{payment.CodigoAutorizacion || '-'}</span>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="col-span-2">
                                            <span className="text-slate-400 block text-[10px] uppercase">Cod. Operación</span>
                                            <span className="font-medium">{payment.Codigo_transaccion || payment.CodigoAutorizacion || '-'}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Pagination Controls */}
            {total > limit && (
                <div className="p-4 flex justify-between items-center bg-white border-t border-slate-100">
                    <button 
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg disabled:opacity-50"
                    >
                        Anterior
                    </button>
                    <span className="text-sm font-medium text-slate-500">
                        {page} de {Math.ceil(total / limit)}
                    </span>
                    <button 
                        onClick={() => setPage(p => p + 1)}
                        disabled={page >= Math.ceil(total / limit)}
                        className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg disabled:opacity-50"
                    >
                        Siguiente
                    </button>
                </div>
            )}

            {/* FAB */}
            {hasPermission('liq.payments.register' as any) && (
                <button
                    onClick={() => setShowCreateModal(true)}
                    className="fixed bottom-20 right-6 w-14 h-14 bg-primary text-primary-foreground rounded-full shadow-lg shadow-primary/30 flex items-center justify-center hover:scale-105 active:scale-95 transition-all z-20"
                >
                    <Plus className="w-6 h-6" />
                </button>
            )}

            {/* Create Payment Modal */}
            <Modal isOpen={showCreateModal} onClose={() => !isSaving && setShowCreateModal(false)} title="Registrar Pago">
                <form onSubmit={handleCreatePayment} className="space-y-4 p-1">
                    {/* Tickets */}
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1.5">Buscar Ticket</label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                inputMode="numeric"
                                value={ticketSearch}
                                onChange={(e) => setTicketSearch(e.target.value)}
                                className="w-full pl-9 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-primary/20"
                                placeholder="Escribe el ticket (ej. 24000123)"
                            />
                            {isSearchingTicket && (
                                <RefreshCw className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary animate-spin" />
                            )}
                            
                            {showTicketDropdown && ticketSuggestions.length > 0 && (
                                <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                                    {ticketSuggestions.map((t, idx) => (
                                        <div 
                                            key={idx}
                                            onClick={() => handleAddTicket(t.id)}
                                            className="px-4 py-3 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-0"
                                        >
                                            <div className="flex justify-between items-center">
                                                <span className="font-bold text-slate-900">{t.id}</span>
                                                {t.total && <span className="text-sm font-medium text-emerald-600">S/ {t.total}</span>}
                                            </div>
                                            <div className="text-xs text-slate-500 truncate mt-0.5">{t.cliente || 'Sin cliente'}</div>
                                        </div>
                                    ))}
                                </div>
                            )}
                            {showTicketDropdown && ticketSearch.length >= 3 && ticketSuggestions.length === 0 && !isSearchingTicket && (
                                <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg p-4 text-center text-sm text-slate-500">
                                    No se encontraron tickets en SAP
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Selected Tickets */}
                    {newPayment.ticket && (
                        <div className="flex flex-wrap gap-2">
                            {newPayment.ticket.split(',').map(t => t.trim()).filter(Boolean).map(t => (
                                <span key={t} className="inline-flex items-center gap-1 px-3 py-1.5 bg-primary/10 text-primary font-bold text-sm rounded-lg border border-primary/20">
                                    {t}
                                    <button type="button" onClick={() => handleRemoveTicket(t)} className="hover:text-red-500 p-0.5 rounded-full hover:bg-red-50">
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                </span>
                            ))}
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1.5">Monto (S/)</label>
                            <input
                                type="text"
                                inputMode="decimal"
                                required
                                value={newPayment.importe}
                                onChange={(e) => setNewPayment({ ...newPayment, importe: e.target.value })}
                                className="w-full px-3 py-3 bg-slate-50 border border-slate-200 rounded-xl text-lg font-bold text-primary focus:ring-2 focus:ring-primary/20"
                                placeholder="0.00"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1.5">Canal</label>
                            <select
                                required
                                value={newPayment.canal}
                                onChange={(e) => setNewPayment({ ...newPayment, canal: e.target.value })}
                                className="w-full px-3 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 font-bold"
                            >
                                <option value="POS">POS IZIPAY</option>
                                <option value="TRANSFERENCIA">TRANSFERENCIA</option>
                                <option value="DEPOSITO">DEPÓSITO</option>
                                <option value="EFECTIVO">EFECTIVO</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1.5">Fecha</label>
                        <input
                            type="date"
                            required
                            value={newPayment.fecha_transaccion}
                            onChange={(e) => setNewPayment({ ...newPayment, fecha_transaccion: e.target.value })}
                            className="w-full px-3 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-primary/20"
                        />
                    </div>

                    {newPayment.canal === 'POS' ? (
                        <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                            <div>
                                <label className="block text-xs font-bold text-slate-600 mb-1">Lote</label>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    value={newPayment.lote}
                                    onChange={(e) => setNewPayment({ ...newPayment, lote: e.target.value })}
                                    className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20"
                                    placeholder="Ej. 123"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-600 mb-1">Voucher</label>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    value={newPayment.voucher}
                                    onChange={(e) => setNewPayment({ ...newPayment, voucher: e.target.value })}
                                    className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20"
                                    placeholder="Ej. 456"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-600 mb-1">Cód. Izipay</label>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    value={newPayment.codigo_izipay}
                                    onChange={(e) => setNewPayment({ ...newPayment, codigo_izipay: e.target.value })}
                                    className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20"
                                    placeholder="Ej. 789"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-600 mb-1">Autorización</label>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    value={newPayment.codigo_autorizacion}
                                    onChange={(e) => setNewPayment({ ...newPayment, codigo_autorizacion: e.target.value })}
                                    className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20"
                                    placeholder="Obligatorio"
                                    required
                                />
                            </div>
                        </div>
                    ) : (
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1.5">Código de Operación</label>
                            <input
                                type="text"
                                inputMode="numeric"
                                value={newPayment.codigo_autorizacion}
                                onChange={(e) => setNewPayment({ ...newPayment, codigo_autorizacion: e.target.value })}
                                className="w-full px-3 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-primary/20"
                                placeholder="N° de operación bancaria"
                                required
                            />
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1.5">Observación (Opcional)</label>
                        <textarea
                            value={newPayment.observacion}
                            onChange={(e) => setNewPayment({ ...newPayment, observacion: e.target.value })}
                            className="w-full px-3 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 resize-none h-20"
                            placeholder="Notas adicionales..."
                        />
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={() => setShowCreateModal(false)}
                            className="flex-1 px-4 py-3 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={isSaving || isFetchingTicket}
                            className="flex-1 px-4 py-3 bg-primary text-primary-foreground font-bold rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {isSaving ? (
                                <><RefreshCw className="w-5 h-5 animate-spin" /> Guardando...</>
                            ) : (
                                'Guardar'
                            )}
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
