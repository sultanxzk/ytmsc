import { createContext, useCallback, useContext, useState } from "react";
import { Check } from "lucide-react";

const ToastCtx = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const push = useCallback((message, icon = Check, color = "#10b981") => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev.slice(-2), { id, message, icon, color }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3200);
  }, []);

  return (
    <ToastCtx.Provider value={{ push }}>
      {children}
      <div className="fixed bottom-[84px] left-1/2 -translate-x-1/2 z-[130] pointer-events-none space-y-2 w-max max-w-[92vw]">
        {toasts.map((t) => {
          const Icon = t.icon;
          return (
            <div
              key={t.id}
              className="toast-in pointer-events-auto flex items-center gap-2.5 bg-[#1a1a1a]/95 backdrop-blur border border-white/10 rounded-full pl-3.5 pr-5 py-2.5 shadow-[0_16px_40px_rgba(0,0,0,0.6)]"
            >
              <span className="w-5 h-5 rounded-full flex items-center justify-center shrink-0" style={{ background: t.color }}>
                <Icon size={13} className="text-white" strokeWidth={3} />
              </span>
              <span className="text-[13px] leading-snug text-white/90">{t.message}</span>
            </div>
          );
        })}
      </div>
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);
