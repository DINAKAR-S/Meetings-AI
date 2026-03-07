"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";

type ToastType = "success" | "error" | "info";

interface ToastMessage {
    id: string;
    message: string;
    type: ToastType;
}

interface ToastContextType {
    showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<ToastMessage[]>([]);

    const showToast = useCallback((message: string, type: ToastType = "success") => {
        const id = Math.random().toString(36).substring(2, 9);
        setToasts((prev) => [...prev, { id, message, type }]);

        // Auto remove after 3 seconds
        setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== id));
        }, 3000);
    }, []);

    const removeToast = useCallback((id: string) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}
            <div
                style={{
                    position: "fixed",
                    bottom: 24,
                    right: 24,
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                    zIndex: 9999,
                }}
            >
                {toasts.map((toast) => (
                    <div
                        key={toast.id}
                        style={{
                            minWidth: 250,
                            padding: "12px 16px",
                            backgroundColor: toast.type === "error" ? "var(--status-testing)" : "var(--color-emerald)",
                            color: "white",
                            borderRadius: "var(--radius-sm)",
                            boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            fontSize: 14,
                            fontWeight: 600,
                            animation: "slideIn 0.3s ease-out forwards",
                        }}
                    >
                        <span>{toast.message}</span>
                        <button
                            onClick={() => removeToast(toast.id)}
                            style={{
                                background: "transparent",
                                border: "none",
                                color: "white",
                                cursor: "pointer",
                                opacity: 0.8,
                                padding: 4,
                            }}
                        >
                            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
}

export function useToast() {
    const context = useContext(ToastContext);
    if (context === undefined) {
        throw new Error("useToast must be used within a ToastProvider");
    }
    return context;
}
