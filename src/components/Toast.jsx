import { Check } from "lucide-react";

export default function Toast({ message, icon: Icon = Check }) {
  if (!message) return null;
  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[130] pointer-events-none toast-in">
      <div className="flex items-center gap-2.5 bg-[#1a1a1a]/95 backdrop-blur border border-white/15 rounded-full pl-3 pr-6 py-3 shadow-[0_20px_60px_rgba(0,0,0,0.7)]">
        <span className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
          <Icon size={14} className="text-white" strokeWidth={3} />
        </span>
        <span className="text-[13px] text-white/90 whitespace-nowrap">{message}</span>
      </div>
    </div>
  );
}
