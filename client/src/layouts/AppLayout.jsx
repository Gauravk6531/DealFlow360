import { Bell, Menu, X, Search, LayoutDashboard, FileText, GitBranch, BadgeCheck, Layers, Handshake, FlaskConical, Truck, Receipt, Activity, BarChart3, Users, Boxes, Store, Warehouse, Settings, Wrench, ChevronDown, Sparkles, LogOut } from "lucide-react";
import { NavLink, Outlet, Link, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { useAuth } from "../store/auth";
import { useData } from "../store/ui";
import api, { errMsg } from "../services/api";

export default function AppLayout() {
  const { user, logout } = useAuth();
  const { unread, refresh } = useData();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifs, setNotifs] = useState([]);

  useEffect(() => { refresh(); }, []);

  useEffect(() => {
    if (refresh) refresh();
    const t = setInterval(() => refresh(), 20000);
    return () => clearInterval(t);
  }, []);

  const loadNotifs = () => api.get("/notifications").then((r) => setNotifs(r.data.notifications)).catch(() => {});
  useEffect(() => { loadNotifs(); }, []);

  const navSections = [
    {
      title: "Operations",
      items: [
        { to: "/", label: "Dashboard", icon: LayoutDashboard },
        { to: "/quotes", label: "Quotations", icon: FileText },
        { to: "/pipeline", label: "Pipeline", icon: GitBranch },
        { to: "/approvals", label: "Approval Center", icon: BadgeCheck },
        { to: "/negotiations", label: "Negotiation Center", icon: Handshake },
      ],
    },
    {
      title: "Intelligence",
      items: [
        { to: "/builder", label: "Quote Builder", icon: Sparkles },
        { to: "/dealers/comparison", label: "Dealer Intelligence", icon: Store },
        { to: "/whatif", label: "What-If Simulator", icon: FlaskConical },
        { to: "/deal-health", label: "Deal Health", icon: Activity },
      ],
    },
    {
      title: "Operations Back",
      items: [
        { to: "/fulfillment", label: "Fulfillment", icon: Truck },
        { to: "/billing", label: "Billing", icon: Receipt },
        { to: "/reports", label: "Reports", icon: BarChart3 },
      ],
    },
  ];

  if (user?.role === "ADMIN" || user?.role === "SALES_MANAGER") {
    navSections.push({
      title: "Administration",
      items: [
        { to: "/admin/products", label: "Products", icon: Boxes },
        { to: "/admin/customers", label: "Customers", icon: Users },
        { to: "/admin/dealers", label: "Dealers", icon: Store },
        { to: "/admin/warehouses", label: "Warehouses", icon: Warehouse },
        { to: "/admin/settings", label: "Policies & Settings", icon: Settings },
        { to: "/admin/offers", label: "Dealer Offers", icon: Layers },
      ],
    });
  }

  const roleLabel = { SALES_REP: "Sales Rep", SALES_MANAGER: "Sales Manager", FINANCE: "Finance / Ops", ADMIN: "Admin" };

  return (
    <div className="min-h-screen flex bg-ink-50">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 bg-ink-900 text-white flex flex-col transform transition lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex items-center gap-2 px-5 h-16 border-b border-white/10">
          <img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='8' fill='%233563ff'/%3E%3Cpath d='M8 17l5 5 11-12' stroke='white' stroke-width='3' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E" className="w-8 h-8" alt="logo" />
          <div>
            <div className="font-extrabold leading-none">DealFlow360</div>
            <div className="text-[10px] text-white/50 mt-0.5">Autonomous Deal Optimization</div>
          </div>
          <button onClick={() => setOpen(false)} className="lg:hidden ml-auto text-white/60"><X size={18} /></button>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-5">
          {navSections.map((s) => (
            <div key={s.title}>
              <div className="px-3 mb-1 text-[10px] font-bold uppercase tracking-wider text-white/40">{s.title}</div>
              <div className="space-y-0.5">
                {s.items.map((it) => (
                  <NavLink key={it.to} to={it.to} end={it.to === "/"}
                    className={({ isActive }) => `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition ${isActive ? "bg-white/10 text-white" : "text-white/60 hover:bg-white/5 hover:text-white"}`}>
                    <it.icon size={16} /> {it.label}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="p-3 border-t border-white/10">
          <div className="flex items-center gap-3 px-2">
            <div className="w-9 h-9 rounded-full bg-brand-500 flex items-center justify-center font-bold text-sm">{user?.name?.[0]}</div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold truncate">{user?.name}</div>
              <div className="text-xs text-white/50">{roleLabel[user?.role] || user?.role}</div>
            </div>
            <button onClick={() => { logout(); nav("/login"); }} className="text-white/50 hover:text-white" title="Logout"><LogOut size={16} /></button>
          </div>
        </div>
      </aside>
      {open && <div className="fixed inset-0 bg-black/40 z-30 lg:hidden" onClick={() => setOpen(false)} />}

      {/* Main */}
      <div className="flex-1 lg:ml-64 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-ink-100 flex items-center gap-3 px-5 sticky top-0 z-20">
          <button onClick={() => setOpen(true)} className="lg:hidden text-ink-700"><Menu size={20} /></button>
          <div className="hidden md:flex items-center gap-2 flex-1 max-w-md bg-ink-50 border border-ink-100 rounded-lg px-3 py-1.5 text-ink-700/40">
            <Search size={15} /> <span className="text-sm">Search deals, quotes, customers…</span>
          </div>
          <div className="flex-1 md:hidden" />
          <Link to="/builder" className="btn-primary !px-3 !py-1.5 text-xs">+ New Quote</Link>

          <div className="relative">
            <button onClick={() => { loadNotifs(); setNotifOpen(!notifOpen); }} className="relative p-2 rounded-lg hover:bg-ink-50 text-ink-700">
              <Bell size={18} />
              {unread > 0 && <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-risk" />}
            </button>
            {notifOpen && (
              <div className="absolute right-0 mt-2 w-80 card shadow-lift p-2 max-h-96 overflow-y-auto z-50">
                <div className="px-2 py-1 text-xs font-bold uppercase text-ink-700/60">Notifications</div>
                {notifs.length === 0 && <div className="p-3 text-sm text-ink-700/50">No notifications</div>}
                {notifs.map((n) => (
                  <div key={n._id} className={`p-2 rounded-lg text-sm ${n.read ? "text-ink-700/70" : "bg-brand-50 text-ink-900"}`}>
                    <div className="font-semibold">{n.title}</div>
                    {n.message && <div className="text-xs text-ink-700/60 mt-0.5">{n.message}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </header>

        <main className="flex-1 p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}