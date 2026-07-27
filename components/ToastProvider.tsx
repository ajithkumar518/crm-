"use client";

import React, { createContext, useContext, useState, useCallback, useMemo } from "react";
import { CheckCircle, AlertCircle, AlertTriangle, Info, X } from "lucide-react";

export type ToastType = "success" | "error" | "warning" | "info";

export interface Toast {
  id: string;
  type: ToastType;
  message: string | React.ReactNode;
  title?: string;
  duration?: number;
}

interface ToastContextValue {
  toast: {
    success: (message: string | React.ReactNode, title?: string, duration?: number) => void;
    error: (message: string | React.ReactNode, title?: string, duration?: number) => void;
    warning: (message: string | React.ReactNode, title?: string, duration?: number) => void;
    info: (message: string | React.ReactNode, title?: string, duration?: number) => void;
  };
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((type: ToastType, message: string | React.ReactNode, title?: string, duration?: number) => {
    setToasts((prev) => {
      // Prevent duplicate stacking by checking if there's already an identical toast visible
      if (prev.some((t) => t.message === message && t.type === type && t.title === title)) {
        return prev;
      }

      const id = Math.random().toString(36).substr(2, 9);
      const newToast: Toast = { id, type, message, title, duration };

      // Auto-dismiss after duration (default 5 seconds)
      setTimeout(() => {
        removeToast(id);
      }, duration || 5000);

      return [...prev, newToast];
    });
  }, [removeToast]);

  const toastMethods = useMemo(() => ({
    success: (message: string | React.ReactNode, title?: string, duration?: number) => addToast("success", message, title, duration),
    error: (message: string | React.ReactNode, title?: string, duration?: number) => addToast("error", message, title, duration),
    warning: (message: string | React.ReactNode, title?: string, duration?: number) => addToast("warning", message, title, duration),
    info: (message: string | React.ReactNode, title?: string, duration?: number) => addToast("info", message, title, duration),
  }), [addToast]);

  return (
    <ToastContext.Provider value={{ toast: toastMethods }}>
      {children}
      
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-3 pointer-events-none w-full max-w-sm px-4 md:px-0">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto relative flex items-start gap-3 p-4 rounded-xl shadow-[0_15px_40px_-10px_rgba(0,0,0,0.6)] bg-[#0D2137] border border-slate-700/60 border-l-4 transition-all duration-300 animate-toast-slide-in ${
              toast.type === "success" ? "border-l-emerald-500" :
              toast.type === "error" ? "border-l-red-500" :
              toast.type === "warning" ? "border-l-amber-500" :
              "border-l-blue-500"
            }`}
          >
            <div className="shrink-0 mt-0.5">
              {toast.type === "success" && <CheckCircle className="w-5 h-5 text-emerald-400" />}
              {toast.type === "error" && <AlertCircle className="w-5 h-5 text-red-400" />}
              {toast.type === "warning" && <AlertTriangle className="w-5 h-5 text-amber-400" />}
              {toast.type === "info" && <Info className="w-5 h-5 text-blue-400" />}
            </div>
            
            <div className="flex-1 min-w-0 pr-6">
              {toast.title && (
                <h4 className="text-sm font-bold mb-0.5 text-white">
                  {toast.title}
                </h4>
              )}
              <div className="text-sm font-medium text-slate-300 leading-snug">
                {toast.message}
              </div>
            </div>
            
            <button
              onClick={() => removeToast(toast.id)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      <style>{`
        @keyframes toastSlideInRight {
          0% { transform: translateX(100%); opacity: 0; }
          100% { transform: translateX(0); opacity: 1; }
        }
        .animate-toast-slide-in {
          animation: toastSlideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context.toast;
}
