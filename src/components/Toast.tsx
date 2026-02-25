'use client';

import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { FiInfo, FiCheck, FiDownload, FiAlertCircle } from 'react-icons/fi';

interface Toast {
    id: string;
    message: string;
    type: 'info' | 'success' | 'download' | 'warning';
}

interface ToastContextType {
    addToast: (message: string, type?: Toast['type']) => void;
}

const ToastContext = createContext<ToastContextType>({ addToast: () => {} });

export function useToast() {
    return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const addToast = useCallback((message: string, type: Toast['type'] = 'info') => {
        const id = `${Date.now()}-${Math.random()}`;
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 3000);
    }, []);

    const icons = {
        info: FiInfo,
        success: FiCheck,
        download: FiDownload,
        warning: FiAlertCircle,
    };

    const colors = {
        info: 'border-zinc-700 text-zinc-300',
        success: 'border-green-900/40 text-green-400',
        download: 'border-blue-900/40 text-blue-400',
        warning: 'border-amber-900/40 text-amber-400',
    };

    return (
        <ToastContext.Provider value={{ addToast }}>
            {children}
            {/* Toast container — bottom-right, non-blocking */}
            <div className="fixed bottom-4 right-4 z-[200] flex flex-col gap-2 pointer-events-none">
                {toasts.map(toast => {
                    const Icon = icons[toast.type];
                    return (
                        <div
                            key={toast.id}
                            className={`px-4 py-2.5 bg-zinc-950/95 backdrop-blur-sm border rounded-lg flex items-center gap-2.5 text-sm animate-slide-in-right shadow-lg max-w-sm ${colors[toast.type]}`}
                        >
                            <Icon size={14} className="shrink-0" />
                            <span>{toast.message}</span>
                        </div>
                    );
                })}
            </div>
            <style jsx global>{`
                @keyframes slide-in-right {
                    from { opacity: 0; transform: translateX(100%); }
                    to { opacity: 1; transform: translateX(0); }
                }
                .animate-slide-in-right {
                    animation: slide-in-right 0.2s ease-out;
                }
            `}</style>
        </ToastContext.Provider>
    );
}
