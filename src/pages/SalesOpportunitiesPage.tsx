import React, { useState } from 'react';
import { 
    ShoppingBag, 
    Send, 
    Tag, 
    FileText, 
    MessageSquare,
    CheckCircle2,
    Loader2
} from 'lucide-react';
import { ApiClient } from '../services/apiClient';
import { cn } from '../utils/cn';

export default function SalesOpportunitiesPage() {
    const [formData, setFormData] = useState({
        ticket: '',
        pedido: '',
        observacion: '',
        comentarioTecnico: ''
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError(null);
        
        try {
            await ApiClient.request('/tec/sales', {
                method: 'POST',
                body: JSON.stringify(formData)
            });
            setIsSuccess(true);
            setFormData({ ticket: '', pedido: '', observacion: '', comentarioTecnico: '' });
            setTimeout(() => setIsSuccess(false), 5000);
        } catch (err: any) {
            setError(err.message || 'Error al registrar la venta');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-slate-50">
            {/* Header */}
            <div className="bg-white p-6 shadow-sm border-b border-slate-200 sticky top-0 z-10">
                <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                    <ShoppingBag className="w-6 h-6 text-primary" />
                    Nueva Oportunidad
                </h1>
                <p className="text-sm text-slate-500 mt-1">Registra productos ofrecidos al cliente</p>
            </div>

            {/* Form */}
            <div className="flex-1 overflow-y-auto p-4 pb-20 lg:pb-4">
                {isSuccess && (
                    <div className="mb-4 bg-emerald-50 border border-emerald-100 p-4 rounded-2xl flex items-center gap-3 text-emerald-700 animate-in fade-in slide-in-from-top-2">
                        <CheckCircle2 className="w-5 h-5 shrink-0" />
                        <span className="text-sm font-medium">¡Venta registrada con éxito!</span>
                    </div>
                )}

                {error && (
                    <div className="mb-4 bg-rose-50 border border-rose-100 p-4 rounded-2xl flex items-center gap-3 text-rose-700">
                        <MessageSquare className="w-5 h-5 shrink-0" />
                        <span className="text-sm font-medium">{error}</span>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 space-y-4">
                        <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 block px-1">
                                Ticket Relacionado
                            </label>
                            <div className="relative">
                                <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input 
                                    required
                                    type="text"
                                    placeholder="Ej: T-12345"
                                    value={formData.ticket}
                                    onChange={(e) => setFormData({...formData, ticket: e.target.value})}
                                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-primary/20"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 block px-1">
                                Número de Pedido (Opcional)
                            </label>
                            <div className="relative">
                                <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input 
                                    type="text"
                                    placeholder="Ej: P-6789"
                                    value={formData.pedido}
                                    onChange={(e) => setFormData({...formData, pedido: e.target.value})}
                                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-primary/20"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 block px-1">
                                Observaciones de Venta
                            </label>
                            <textarea 
                                required
                                rows={3}
                                placeholder="¿Qué productos o servicios se ofrecieron?"
                                value={formData.observacion}
                                onChange={(e) => setFormData({...formData, observacion: e.target.value})}
                                className="w-full px-4 py-3 bg-slate-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-primary/20 resize-none"
                            />
                        </div>

                        <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 block px-1">
                                Comentario Interno
                            </label>
                            <textarea 
                                rows={2}
                                placeholder="Notas adicionales para oficina..."
                                value={formData.comentarioTecnico}
                                onChange={(e) => setFormData({...formData, comentarioTecnico: e.target.value})}
                                className="w-full px-4 py-3 bg-slate-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-primary/20 resize-none"
                            />
                        </div>
                    </div>

                    <button 
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full bg-primary text-white py-4 rounded-3xl font-bold text-sm shadow-lg shadow-primary/20 flex items-center justify-center gap-2 hover:bg-primary-dark transition-all active:scale-[0.98] disabled:opacity-70"
                    >
                        {isSubmitting ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            <Send className="w-5 h-5" />
                        )}
                        {isSubmitting ? 'Registrando...' : 'Registrar Oportunidad'}
                    </button>
                </form>
            </div>
        </div>
    );
}
