import { create } from "zustand";
import api from "../services/api";

export const useData = create((set, get) => ({
  unread: 0,
  summary: null,
  refresh: async () => {
    try {
      const { data } = await api.get("/notifications");
      set({ unread: data.notifications.filter((n) => !n.read).length });
    } catch {
      /* ignore */
    }
  },
}));

export const useToast = create((set, get) => ({
  toasts: [],
  push: (msg, type = "success") => {
    const id = Date.now() + Math.random();
    set({ toasts: [...get().toasts, { id, msg, type }] });
    setTimeout(() => set({ toasts: get().toasts.filter((t) => t.id !== id) }), 3500);
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}));

export function Toaster() {
  const { toasts, dismiss } = useToast();
  return (
    <div className="fixed bottom-4 right-4 z-[100] space-y-2">
      {toasts.map((t) => (
        <div key={t.id} onClick={() => dismiss(t.id)} className={`cursor-pointer px-4 py-3 rounded-xl shadow-lift text-sm font-medium text-white ${t.type === "error" ? "bg-risk" : "bg-emerald-600"}`}>
          {t.msg}
        </div>
      ))}
    </div>
  );
}