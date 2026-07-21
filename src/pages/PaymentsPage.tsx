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
import { useTranslation } from 'react-i18next';

interface EnrichedTicketPago extends TicketPago {
    Tecnico?: string;
}

const formatDate = (date: any) => {
    if (!date) return '—';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('es-PE', { timeZone: 'UTC' });
};

const getStatusConfig = (status: string | undefined) => {
    switch (status) {
        case 'LIQUIDADO':            return { badge: cn(SIATC_THEME.STATES.BADGE_BASE, SIATC_THEME.STATES.SUCCESS),   Icon: CheckCircle2, label: 'Liquidado' };
        case 'RECEPCIONADO':         return { badge: cn(SIATC_THEME.STATES.BADGE_BASE, SIATC_THEME.STATES.INFO),      Icon: CheckCircle2, label: 'Recepcionado' };
        case 'RECHAZADO':            return { badge: cn(SIATC_THEME.STATES.BADGE_BASE, SIATC_THEME.STATES.ERROR),     Icon: X,            label: 'Rechazado' };
        case 'PENDIENTE_APROBACION': return { badge: cn(SIATC_THEME.STATES.BADGE_BASE, SIATC_THEME.STATES.WARNING),   Icon: Clock,        label: 'Pend. Aprobación' };
        case 'REVISAR':              return { badge: cn(SIATC_THEME.STATES.BADGE_BASE, SIATC_THEME.STATES.ERROR),     Icon: AlertCircle,  label: 'Revisar' };
        default:                     return { badge: cn(SIATC_THEME.STATES.BADGE_BASE, SIATC_THEME.STATES.SECONDARY), Icon: Clock,        label: status || 'Pendiente' };
    }
};

export default function PaymentsPage() {
    const { t } = useTranslation();
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
            const res = await ApiClient.request<{ data: any[]; total: number }>(
                `/tickets-pagos?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}&status=all`
            );
            setPayments(res.data);
            setTotal(res.total);
        } catch { /* silent */ } finally { setIsLoading(false); }
    };

    useEffect(() => { fetchData(); }, [page, search]);

    const handleAddTicket = (ticketId: string) => {
        const current = newPayment.ticket ? newPayment.ticket.split(',').map(tkId => tkId.trim()).filter(Boolean) : [];
        if (!current.includes(ticketId)) {
            setNewPayment(prev => ({ ...prev, ticket: [...current, ticketId].join(', ') }));
            fetchTicketData(ticketId);
        }
        setTicketSearch('');
        setShowTicketDropdown(false);
    };

    const handleRemoveTicket = (ticketId: string) => {
        const current = newPayment.ticket.split(',').map(tkId => tkId.trim()).filter(Boolean);
        setNewPayment(prev => ({ ...prev, ticket: current.filter(tkId => tkId !== ticketId).join(', ') }));
    };

    const fetchTicketData = async (ticketId: string) => {
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
            alert({ title: 'Error', message: t('payments.errors.noTicket'), type: 'error' });
            return;
        }
        setIsSaving(true);
        try {
            await ApiClient.request('/tickets-pagos', { method: 'POST', body: JSON.stringify(newPayment) });
            setShowCreateModal(false);
            setNewPayment({ ticket: '', fecha_transaccion: new Date().toISOString().split('T')[0], voucher: '', lote: '', codigo_izipay: '', codigo_autorizacion: '', folio: '', importe: '', canal: 'POS', observacion: '' });
            await fetchData();
            alert({ title: 'Éxito', message: t('payments.success'), type: 'success' });
        } catch (err) {
            alert({ title: 'Error', message: t('payments.errors.registerFailed') + ': ' + (err instanceof Error ? err.message : ''), type: 'error' });
        } finally { setIsSaving(false); }
    };

    const inputClass = cn(SIATC_THEME.MOBILE.TOUCH_INPUT, "w-full px-3 bg-cb-bg border border-cb-border rounded-lg text-cb-text-primary focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all");

    return (
        <div className={SIATC_THEME.LAYOUT.PAGE_WRAPPER}>

            {/* Page Header — oculto en móvil (mismo criterio que Tickets): el tab
                inferior ya dice "Pagos", este título es chrome redundante que le
                resta alto a la lista en la pantalla que de verdad importa.
                Envuelto en un div aparte (no combinado en el mismo elemento que
                ya trae "flex" de HEADER_WRAPPER) para no pelear "hidden" vs "flex"
                en la misma clase. */}
            <div className="hidden sm:block">
                <div className={SIATC_THEME.LAYOUT.HEADER_WRAPPER}>
                    <div>
                        <div className="flex items-center gap-2">
                            {canViewAll
                                ? <Users className="w-5 h-5 text-primary shrink-0" />
                                : <DollarSign className="w-5 h-5 text-primary shrink-0" />
                            }
                            <h1 className={SIATC_THEME.TYPOGRAPHY.PAGE_TITLE}>
                                {canViewAll ? t('payments.title.all') : t('payments.title.mine')}
                            </h1>
                        </div>
                        <p className={SIATC_THEME.TYPOGRAPHY.PAGE_SUBTITLE}>
                            {canViewAll ? t('payments.subtitle.all') : t('payments.subtitle.mine')}
                        </p>
                    </div>
                    {canRegister && (
                        <button
                            onClick={() => setShowCreateModal(true)}
                            className={SIATC_THEME.COMPONENTS.BUTTON_PRIMARY}
                        >
                            <Plus className="w-4 h-4" />
                            {t('payments.register')}
                        </button>
                    )}
                </div>
            </div>

            {/* Main Content Container */}
            <div className={SIATC_THEME.LAYOUT.CONTENT_CONTAINER}>

                {/* Search Bar */}
                <div className={SIATC_THEME.LAYOUT.SEARCH_BAR_WRAPPER}>
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cb-neutral" />
                        <input
                            type="text"
                            placeholder={t('payments.searchPlaceholder')}
                            value={search}
                            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                            className={cn(SIATC_THEME.COMPONENTS.INPUT, SIATC_THEME.MOBILE.TOUCH_INPUT, 'pl-9')}
                        />
                    </div>
                    <span className="text-xs font-bold text-cb-neutral hidden sm:inline tabular-nums">
                        {t('payments.count', { count: total.toLocaleString() })}
                    </span>
                </div>

                {/* Scrollable Payment List */}
                <div className={SIATC_THEME.LAYOUT.CARD_GRID}>
                  <div className={isLoading || payments.length === 0 ? 'flex flex-col flex-1' : SIATC_THEME.LAYOUT.CARD_GRID_COLUMNS}>
                    {isLoading ? (
                        <div className="flex justify-center items-center flex-1 p-12">
                            <RefreshCw className="w-6 h-6 text-primary animate-spin" />
                        </div>
                    ) : payments.length === 0 ? (
                        <div className="flex flex-col items-center justify-center flex-1 gap-3 p-10 text-center">
                            <DollarSign className="w-10 h-10 text-cb-neutral/40" />
                            <p className="font-bold text-cb-text-primary">{t('payments.empty.noPayments')}</p>
                            <p className="text-sm text-cb-text-secondary">
                                {search
                                    ? t('payments.empty.noResults')
                                    : (canRegister ? t('payments.empty.registerHint') : t('payments.empty.noRegistry'))}
                            </p>
                        </div>
                    ) : (
                        payments.map((payment, idx) => {
                            const { badge, Icon, label } = getStatusConfig(payment.Estado);
                            const itemKey = payment.ID_transaccion || `pago-${payment.Ticket}-${idx}`;
                            return (
                                <div key={itemKey} className="bg-cb-bg border border-cb-border rounded-xl p-4 flex flex-col gap-3 shrink-0">

                                    {/* Fila principal: ticket + monto */}
                                    <div className="flex justify-between items-start gap-3">
                                        <div className="min-w-0 flex-1">
                                            <div className="flex flex-wrap items-center gap-2 mb-0.5">
                                                <span className={SIATC_THEME.TYPOGRAPHY.SECTION_TITLE}>
                                                    {payment.Ticket || t('payments.noTicket')}
                                                </span>
                                                <span className={badge}>
                                                    <Icon className="w-3 h-3" />
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
                                            <p className="font-bold text-lg text-primary tabular-nums">
                                                S/ {parseFloat(payment.Importe || '0').toFixed(2)}
                                            </p>
                                            <span className={cn(SIATC_THEME.STATES.BADGE_BASE, SIATC_THEME.STATES.SECONDARY, 'mt-1')}>
                                                {payment.Canal}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Detalles del pago */}
                                    {payment.Canal === 'POS' ? (
                                        <div className="grid grid-cols-2 gap-x-4 gap-y-2 bg-card border border-cb-border rounded-lg p-3 text-xs">
                                            {[
                                                { label: t('payments.detail.lote'),    value: payment.Lote },
                                                { label: t('payments.detail.voucher'), value: payment.Voucher },
                                                { label: t('payments.detail.izipay'),  value: payment.Codigo_Izipay },
                                                { label: t('payments.detail.auth'),    value: payment.CodigoAutorizacion },
                                            ].map(({ label: lbl, value }) => (
                                                <div key={lbl}>
                                                    <span className="block text-[10px] font-bold uppercase tracking-wider text-cb-neutral mb-0.5">{lbl}</span>
                                                    <span className="font-medium text-cb-text-primary">{value || '—'}</span>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="bg-card border border-cb-border rounded-lg p-3 text-xs">
                                            <span className="block text-[10px] font-bold uppercase tracking-wider text-cb-neutral mb-0.5">{t('payments.detail.opCode')}</span>
                                            <span className="font-medium text-cb-text-primary">
                                                {payment.Codigo_transaccion || payment.CodigoAutorizacion || '—'}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                  </div>
                </div>

                {/* Pagination Footer */}
                {total > limit && (
                    <div className={SIATC_THEME.TABLE.FOOTER}>
                        <button
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page === 1}
                            className={cn(SIATC_THEME.COMPONENTS.BUTTON_SECONDARY, 'disabled:opacity-40')}
                        >
                            {t('common.previous')}
                        </button>
                        <span className={SIATC_THEME.TYPOGRAPHY.FOOTER_STATS}>
                            {t('payments.pagination.page', { page, total: Math.ceil(total / limit) })}
                            <span className="opacity-60 font-normal normal-case tracking-normal ml-2">
                                · {t('payments.pagination.records', { count: total.toLocaleString() })}
                            </span>
                        </span>
                        <button
                            onClick={() => setPage(p => p + 1)}
                            disabled={page >= Math.ceil(total / limit)}
                            className={cn(SIATC_THEME.COMPONENTS.BUTTON_SECONDARY, 'disabled:opacity-40')}
                        >
                            {t('common.next')}
                        </button>
                    </div>
                )}
            </div>

            {/* Mobile FAB */}
            {canRegister && (
                <button
                    onClick={() => setShowCreateModal(true)}
                    className="fixed bottom-[calc(6rem+env(safe-area-inset-bottom))] right-5 w-14 h-14 bg-primary text-primary-foreground rounded-full shadow-lg shadow-primary/30 flex items-center justify-center hover:scale-105 active:scale-95 transition-all z-50 sm:hidden"
                    aria-label={t('payments.register')}
                >
                    <Plus className="w-6 h-6" />
                </button>
            )}

            {/* Modal crear pago */}
            <Modal isOpen={showCreateModal} onClose={() => !isSaving && setShowCreateModal(false)} title={t('payments.modal.title')}>
                <form onSubmit={handleCreatePayment} className="space-y-4 p-1">

                    <div>
                        <label className="block text-xs font-bold text-cb-neutral uppercase tracking-wider mb-1.5">{t('payments.modal.searchTicket')}</label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cb-neutral" />
                            <input
                                type="text"
                                inputMode="numeric"
                                value={ticketSearch}
                                onChange={(e) => setTicketSearch(e.target.value)}
                                className={cn(inputClass, 'pl-9')}
                                placeholder={t('payments.modal.searchPlaceholder')}
                            />
                            {isSearchingTicket && (
                                <RefreshCw className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary animate-spin" />
                            )}
                            {showTicketDropdown && ticketSuggestions.length > 0 && (
                                <div className="absolute z-50 w-full mt-1 bg-card border border-cb-border rounded-xl shadow-lg max-h-60 overflow-y-auto">
                                    {ticketSuggestions.map((sugg, i) => (
                                        <div
                                            key={i}
                                            onClick={() => handleAddTicket(sugg.id)}
                                            className="px-4 py-3 hover:bg-cb-bg cursor-pointer border-b border-cb-border last:border-0 flex justify-between items-center gap-2"
                                        >
                                            <span className="font-bold text-cb-text-primary text-sm">{sugg.id}</span>
                                            <div className="text-right">
                                                {sugg.total && <span className="text-sm font-bold text-primary">S/ {sugg.total}</span>}
                                                <p className="text-xs text-cb-text-secondary truncate max-w-[140px]">{sugg.cliente || t('payments.modal.noClient')}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                            {showTicketDropdown && ticketSearch.length >= 3 && ticketSuggestions.length === 0 && !isSearchingTicket && (
                                <div className="absolute z-50 w-full mt-1 bg-card border border-cb-border rounded-xl shadow-lg p-4 text-center text-sm text-cb-text-secondary">
                                    {t('payments.modal.noTickets')}
                                </div>
                            )}
                        </div>
                    </div>

                    {newPayment.ticket && (
                        <div className="flex flex-wrap gap-2">
                            {newPayment.ticket.split(',').map(tkId => tkId.trim()).filter(Boolean).map(tkId => (
                                <span key={tkId} className={cn(SIATC_THEME.STATES.BADGE_BASE, SIATC_THEME.STATES.PRIMARY, 'h-8 px-3 gap-2')}>
                                    {tkId}
                                    <button type="button" onClick={() => handleRemoveTicket(tkId)} className="hover:text-red-500 transition-colors p-2 -m-2 rounded-full">
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                </span>
                            ))}
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-bold text-cb-neutral uppercase tracking-wider mb-1.5">{t('payments.modal.fields.amount')}</label>
                            <input
                                type="text" inputMode="decimal" required
                                value={newPayment.importe}
                                onChange={(e) => setNewPayment({ ...newPayment, importe: e.target.value })}
                                className={cn(inputClass, 'text-lg font-bold text-primary')}
                                placeholder="0.00"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-cb-neutral uppercase tracking-wider mb-1.5">{t('payments.modal.fields.channel')}</label>
                            <select required value={newPayment.canal} onChange={(e) => setNewPayment({ ...newPayment, canal: e.target.value })} className={cn(inputClass, 'font-bold')}>
                                <option value="POS">POS IZIPAY</option>
                                <option value="TRANSFERENCIA">TRANSFERENCIA</option>
                                <option value="DEPOSITO">DEPÓSITO</option>
                                <option value="EFECTIVO">EFECTIVO</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-cb-neutral uppercase tracking-wider mb-1.5">{t('payments.modal.fields.date')}</label>
                        <input type="date" required value={newPayment.fecha_transaccion} onChange={(e) => setNewPayment({ ...newPayment, fecha_transaccion: e.target.value })} className={inputClass} />
                    </div>

                    {newPayment.canal === 'POS' ? (
                        <div className="grid grid-cols-2 gap-3 bg-cb-bg border border-cb-border p-3 rounded-xl">
                            {[
                                { label: t('payments.modal.fields.lote'),    key: 'lote',                placeholder: 'Ej. 123',     required: false },
                                { label: t('payments.modal.fields.voucher'), key: 'voucher',             placeholder: 'Ej. 456',     required: false },
                                { label: t('payments.modal.fields.izipay'),  key: 'codigo_izipay',       placeholder: 'Ej. 789',     required: false },
                                { label: t('payments.modal.fields.auth'),    key: 'codigo_autorizacion', placeholder: 'Obligatorio', required: true  },
                            ].map(({ label: lbl, key, placeholder, required: req }) => (
                                <div key={key}>
                                    <label className="block text-[10px] font-bold uppercase tracking-wider text-cb-neutral mb-1">{lbl}</label>
                                    <input
                                        type="text" inputMode="numeric" required={req} placeholder={placeholder}
                                        value={(newPayment as any)[key]}
                                        onChange={(e) => setNewPayment({ ...newPayment, [key]: e.target.value })}
                                        className={cn(SIATC_THEME.MOBILE.TOUCH_INPUT, "w-full px-3 bg-card border border-cb-border rounded-lg text-cb-text-primary focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all")}
                                    />
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div>
                            <label className="block text-xs font-bold text-cb-neutral uppercase tracking-wider mb-1.5">{t('payments.modal.fields.opCode')}</label>
                            <input type="text" inputMode="numeric" required value={newPayment.codigo_autorizacion}
                                onChange={(e) => setNewPayment({ ...newPayment, codigo_autorizacion: e.target.value })}
                                className={inputClass} placeholder={t('payments.modal.fields.opPlaceholder')} />
                        </div>
                    )}

                    <div>
                        <label className="block text-xs font-bold text-cb-neutral uppercase tracking-wider mb-1.5">{t('payments.modal.fields.observation')}</label>
                        <textarea
                            value={newPayment.observacion}
                            onChange={(e) => setNewPayment({ ...newPayment, observacion: e.target.value })}
                            className="w-full px-3 py-3 bg-cb-bg border border-cb-border rounded-lg text-sm text-cb-text-primary focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all resize-none h-20"
                            placeholder={t('payments.modal.fields.observationPlaceholder')}
                        />
                    </div>

                    <div className="flex gap-3 pt-1">
                        <button type="button" onClick={() => setShowCreateModal(false)} className={cn(SIATC_THEME.COMPONENTS.BUTTON_SECONDARY, 'flex-1 h-11')}>
                            {t('payments.modal.cancel')}
                        </button>
                        <button type="submit" disabled={isSaving || isFetchingTicket} className={cn(SIATC_THEME.COMPONENTS.BUTTON_PRIMARY, 'flex-1 h-11 disabled:opacity-50')}>
                            {isSaving ? <><RefreshCw className="w-4 h-4 animate-spin" /> {t('payments.modal.saving')}</> : t('payments.modal.save')}
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
