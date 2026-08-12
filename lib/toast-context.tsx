"use client";

import { CheckCircle2, X } from "lucide-react";
import { createContext, useCallback, useContext, useState } from "react";

interface ToastItem { id: number; message: string }
interface ToastContextValue { toast: (message: string) => void }

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const toast = useCallback((message: string) => {
    const id = Date.now();
    setItems((current) => [...current, { id, message }]);
    window.setTimeout(() => setItems((current) => current.filter((item) => item.id !== id)), 3200);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="toast-stack" aria-live="polite">
        {items.map((item) => (
          <div className="toast" key={item.id}>
            <CheckCircle2 size={18} />
            <span>{item.message}</span>
            <button aria-label="알림 닫기" onClick={() => setItems((current) => current.filter((toastItem) => toastItem.id !== item.id))}>
              <X size={15} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const value = useContext(ToastContext);
  if (!value) throw new Error("useToast must be used within ToastProvider");
  return value;
}
