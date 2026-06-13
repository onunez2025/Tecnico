import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { cn } from '../../utils/cn';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    subtitle?: string;
    children: React.ReactNode;
    size?: 'sm' | 'md' | 'lg' | 'xl';
    hideCloseButton?: boolean;
}

export function Modal({ isOpen, onClose, title, subtitle, children, size = 'md', hideCloseButton = false }: ModalProps) {
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => { document.body.style.overflow = ''; };
    }, [isOpen]);

    if (!isOpen) return null;

    const sizeClasses = {
        sm: 'max-w-md',
        md: 'max-w-lg',
        lg: 'max-w-2xl',
        xl: 'max-w-4xl',
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="fixed inset-0" onClick={onClose} />
            <div className={cn(
                "relative w-full mx-4 bg-card text-foreground rounded-md shadow-lg border border-border animate-in zoom-in-95 duration-200",
                sizeClasses[size]
            )}>
                <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                    <div className="flex flex-col">
                        <h2 className="text-lg font-bold leading-none tracking-tight">{title}</h2>
                        {subtitle && <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-[0.2em] mt-1.5">{subtitle}</p>}
                    </div>
                    {!hideCloseButton && (
                        <button
                            onClick={onClose}
                            className="rounded-sm opacity-70 transition-opacity hover:opacity-100 hover:bg-accent text-muted-foreground hover:text-foreground p-1"
                        >
                            <X className="h-4 w-4" />
                            <span className="sr-only">Close</span>
                        </button>
                    )}
                </div>
                <div className="p-5 max-h-[85vh] overflow-y-auto">
                    {children}
                </div>
            </div>
        </div>
    );
}
