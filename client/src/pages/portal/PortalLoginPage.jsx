import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useCustomerAuth } from "../../store/auth";
import { useToast } from "../../store/ui";
import { Handshake, BadgeCheck, Truck } from "lucide-react";

const DEMO = [
  { label: "Acme Corp", email: "acme@acme.com", password: "Acme@123" },
  { label: "Beta Industries", email: "beta@beta.com", password: "Beta@123" },
  { label: "Nova Labs", email: "nova@nova.com", password: "Nova@123" },
  { label: "Zenith Pharma", email: "zenith@zenith.com", password: "Zenith@123" },
];

export default function PortalLoginPage() {
  const { login } = useCustomerAuth();
  const toast = useToast();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    const r = await login(email, password);
    if (r.ok) { toast.push(`Welcome, ${r.customer.name}`); nav("/portal"); }
    else toast.push(r.message, "error");
  };

  return (
    <div className="min-h-screen bg-ink-900 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='8' fill='%233563ff'/%3E%3Cpath d='M8 17l5 5 11-12' stroke='white' stroke-width='3' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E" className="w-12 h-12 mx-auto mb-3" alt="" />
          <div className="text-2xl font-extrabold text-white">DealFlow360</div>
          <div className="text-sm text-white/50 mt-1">Customer negotiation portal</div>
        </div>
        <div className="bg-white rounded-2xl shadow-lift p-6">
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="label">Business email</label>
              <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@company.com" />
            </div>
            <div>
              <label className="label">Password</label>
              <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="••••••••" />
            </div>
            <button className="btn-primary w-full justify-center" type="submit">Sign in</button>
          </form>
          <div className="mt-5 border-t border-ink-100 pt-4">
            <div className="text-xs font-bold text-ink-700/50 mb-2">Demo companies — click to fill</div>
            <div className="grid grid-cols-2 gap-1.5">
              {DEMO.map((d) => (
                <button key={d.label} onClick={() => { setEmail(d.email); setPassword(d.password); }} className="text-xs px-2 py-1.5 rounded-lg bg-brand-50 text-brand-700 hover:bg-brand-100 text-left">
                  {d.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-center gap-4 mt-5 text-[11px] text-ink-700/50">
            <span className="flex items-center gap-1"><Handshake size={12} /> Negotiate deals</span>
            <span className="flex items-center gap-1"><BadgeCheck size={12} /> Accept counters</span>
            <span className="flex items-center gap-1"><Truck size={12} /> Track fulfilment</span>
          </div>
        </div>
        <div className="text-center mt-5 text-xs text-white/40">
          DealFlow360 team member? <Link to="/login" className="font-semibold text-accent-400 hover:underline">Internal console</Link>
        </div>
      </div>
    </div>
  );
}