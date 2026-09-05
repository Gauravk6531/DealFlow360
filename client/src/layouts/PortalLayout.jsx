import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { FileText, LayoutDashboard, LogOut, Handshake } from "lucide-react";
import { useCustomerAuth } from "../store/auth";

export default function PortalLayout() {
  const { customer, logout } = useCustomerAuth();
  const nav = useNavigate();

  return (
    <div className="min-h-screen bg-ink-50">
      <header className="bg-ink-900 text-white">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center gap-4">
          <div className="flex items-center gap-2">
            <img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='8' fill='%233563ff'/%3E%3Cpath d='M8 17l5 5 11-12' stroke='white' stroke-width='3' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E" className="w-8 h-8" alt="" />
            <div className="font-extrabold leading-none">DealFlow360</div>
            <span className="hidden sm:inline-block text-[10px] text-white/50 bg-white/10 rounded-full px-2 py-0.5 ml-1">Customer Portal</span>
          </div>
          <nav className="flex items-center gap-1 ml-auto">
            <NavLink to="/portal" end className={({ isActive }) => `flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium ${isActive ? "bg-white/10 text-white" : "text-white/60 hover:text-white"}`}>
              <LayoutDashboard size={15} /> Dashboard
            </NavLink>
            <NavLink to="/portal/quotes" className={({ isActive }) => `flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium ${isActive ? "bg-white/10 text-white" : "text-white/60 hover:text-white"}`}>
              <FileText size={15} /> My Quotations
            </NavLink>
          </nav>
        </div>
      </header>
      {customer && (
        <div className="bg-brand-700 text-white">
          <div className="max-w-6xl mx-auto px-6 py-2.5 flex items-center gap-3 text-sm">
            <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center font-bold">{customer.name?.[0]}</div>
            <div>
              <span className="font-semibold">{customer.name}</span>
              <span className="ml-2 text-white/60 text-xs">{customer.company} · {customer.customerTier} tier</span>
            </div>
            <button onClick={() => { logout(); nav("/portal/login"); }} className="ml-auto flex items-center gap-1.5 text-white/70 hover:text-white text-xs font-semibold">
              <LogOut size={13} /> Sign out
            </button>
          </div>
        </div>
      )}
      <main className="max-w-6xl mx-auto px-6 py-8">
        <Outlet />
      </main>
      <div className="max-w-6xl mx-auto px-6 pb-8 text-center text-xs text-ink-700/40 mt-8">
        <Handshake size={14} className="inline mr-1" /> DealFlow360 makes every deal mutually profitable.
      </div>
    </div>
  );
}