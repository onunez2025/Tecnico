import { createContext, useContext, useState, type ReactNode } from 'react';
import { AlertCircle, CheckCircle, Info, Trash2, XCircle } from 'lucide-react';
import { Modal } from '../components/common/Modal';
import { cn } from '../utils/cn';

type DialogType = 'info' | 'warning' | 'error' | 'success' | 'danger';

interface DialogOptions {
    title?: string;
    message: string;
    type?: DialogType;
    confirmText?: string;
    cancelText?: string;
    onConfirm?: () => void;
    onCancel?: () => void;
}

interface DialogContextType {
    confirm: (options: DialogOptions) => void;
    alert: (options: Omit<DialogOptions, 'onCancel' | 'cancelText'>) => void;
}

const DialogContext = createContext<DialogContextType | undefined>(undefined);

export function DialogProvider({ children }: { children: ReactNode }) {
    const [isOpen, setIsOpen] = useState(false);
    const [isAlert, setIsAlert] = useState(false);
    const [options, setOptions] = useState<DialogOptions | null>(null);

    const confirm = (opts: DialogOptions) => {
        setOptions({ 
            title: 'Confirmar Acción',
            type: 'warning', 
            confirmText: 'Confirmar', 
            cancelText: 'Cancelar', 
            ...opts 
        });
        setIsAlert(false);
        setIsOpen(true);
    };

    const alert = (opts: Omit<DialogOptions, 'onCancel' | 'cancelText'>) => {
        setOptions({ 
            title: 'Aviso',
            type: 'info', 
            confirmText: 'Aceptar', 
            ...opts 
        });
        setIsAlert(true);
        setIsOpen(true);
    };

    const handleClose = () => {
        setIsOpen(false);
        if (options?.onCancel) options.onCancel();
    };

    const handleConfirm = () => {
        setIsOpen(false);
        if (options?.onConfirm) options.onConfirm();
    };

    const renderIcon = () => {
        if (!options) return <Info className="w-6 h-6 text-blue-500" />;
        switch (options.type) {
            case 'danger': return <Trash2 className="w-6 h-6 text-red-600" />;
            case 'error': return <XCircle className="w-6 h-6 text-red-500" />;
            case 'warning': return <AlertCircle className="w-6 h-6 text-amber-500" />;
            case 'success': return <CheckCircle className="w-6 h-6 text-green-500" />;
            case 'info':
            default: return <Info className="w-6 h-6 text-blue-500" />;
        }
    };

    const getPrimaryButtonClass = () => {
        if (!options) return "bg-primary hover:bg-primary/90 text-primary-foreground";
        if (options.type === 'danger' || options.type === 'error') {
            return "bg-destructive hover:bg-destructive/90 text-destructive-foreground";
        }
        return "bg-primary hover:bg-primary/90 text-primary-foreground";
    };

    return (
        <DialogContext.Provider value={{ confirm, alert }}>
            {children}
            {options && (
                <Modal isOpen={isOpen} onClose={handleClose} title={options.title || 'Atención'} size="sm">
                    <div className="p-6">
                        <div className="flex items-start gap-4">
                            <div className="shrink-0 mt-0.5">
                                {renderIcon()}
                            </div>
                            <div className="text-sm text-foreground space-y-2 font-medium">
                                {options.message}
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 pt-6 mt-4 border-t border-border">
                            {!isAlert && (
                                <button
                                    type="button"
                                    onClick={handleClose}
                                    className="px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-accent rounded-md transition-colors"
                                >
                                    {options.cancelText}
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={handleConfirm}
                                className={cn(
                                    "px-4 py-2 text-sm font-medium rounded-md shadow-sm transition-colors",
                                    getPrimaryButtonClass()
                                )}
                            >
                                {options.confirmText}
                            </button>
                        </div>
                    </div>
                </Modal>
            )}
        </DialogContext.Provider>
    );
}

export function useDialog() {
    const context = useContext(DialogContext);
    if (context === undefined) {
        throw new Error('useDialog must be used within a DialogProvider');
    }
    return context;
}
