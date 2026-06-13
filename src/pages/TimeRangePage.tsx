import React, { useState } from 'react';
import { 
    Clock, 
    Tag, 
    CheckCircle2,
    Loader2,
    AlertCircle,
    Save
} from 'lucide-react';
import { ApiClient } from '../services/apiClient';
import { cn } from '../utils/cn';

const RANGOS_HORARIOS = [
    "08:00 - 10:00",
    "10:00 - 12:00",
    "12:00 - 14:00",
    "14:00 - 16:00",
    "16:00 - 18:00",
    "18:00 - 20:00"
];

export default function TimeRangePage() {
    const [ticket, setTicket] = useState('');
    const [selectedRango, setSelectedRango] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedRango) {
            setError('Por favor selecciona un rango horario');
            return;
        }

        setIsSubmitting(true);
        setError(null);
        
        try {
            await ApiClient.request('/tec/time-range', {
                method: 'PATCH',
                body: JSON.stringify({
                    ticket: ticket,
                    bloqueHorario: selectedRango
                })
            });
            setIsSuccess(true);
            setTicket('');
            setSelectedRango('');
            setTimeout(() => setIsSuccess(false), 5000);
        } catch (err: any) {
            setError(err.message || 'Error al actualizar el rango horario');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-slate-50">
            {/* Header */}
            <div className="bg-white p-6 shadow-sm border-b border-slate-200 sticky top-0 z-10">
                <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                    <Clock className="w-6 h-6 text-primary" />
                    Mi Disponibilidad
                </h1>
                <p className="text-sm text-slate-500 mt-1">Asigna el bloque horario a tus tickets</p>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4">
                {isSuccess && (
                    <div className="mb-4 bg-emerald-50 border border-emerald-100 p-4 rounded-2xl flex items-center gap-3 text-emerald-700 animate-in fade-in slide-in-from-top-2">
                        <CheckCircle2 className="w-5 h-5 shrink-0" />
                        <span className="text-sm font-medium">¡Rango actualizado correctamente!</span>
                    </div>
                )}

                {error && (
                    <div className="mb-4 bg-rose-50 border border-rose-100 p-4 rounded-2xl flex items-center gap-3 text-rose-700">
                        <AlertCircle className="w-5 h-5 shrink-0" />
                        <span className="text-sm font-medium">{error}</span>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 block px-1">
                            Número de Ticket
                        </label>
                        <div className="relative mb-6">
                            <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input 
                                required
                                type="text"
                                placeholder="Ingresa el número de ticket"
                                value={ticket}
                                onChange={(e) => setTicket(e.target.value)}
                                className="w-full pl-10 pr-4 py-3.5 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-primary/20"
                            />
                        </div>

                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3 block px-1">
                            Selecciona el Rango Horario
                        </label>
                        <div className="grid grid-cols-1 gap-2">
                            {RANGOS_HORARIOS.map((rango) => (
                                <button
                                    key={rango}
                                    type="button"
                                    onClick={() => setSelectedRango(rango)}
                                    className={cn(
                                        "flex items-center justify-between px-5 py-4 rounded-2xl border-2 transition-all text-sm font-bold",
                                        selectedRango === rango 
                                            ? "border-primary bg-primary/5 text-primary" 
                                            : "border-slate-100 bg-slate-50 text-slate-600 hover:border-slate-200"
                                    )}
                                >
                                    {rango}
                                    {selectedRango === rango && <CheckCircle2 className="w-5 h-5" />}
                                </button>
                            ))}
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
                            <Save className="w-5 h-5" />
                        )}
                        {isSubmitting ? 'Actualizando...' : 'Guardar Rango Horario'}
                    </button>
                </form>
            </div>
        </div>
    );
}
