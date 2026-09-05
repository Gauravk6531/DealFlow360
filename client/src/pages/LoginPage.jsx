import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../store/auth";
import { useToast } from "../store/ui";
import { ShieldCheck, TrendingUp, FlaskConical, GitBranch } from "lucide-react";

const DEMO = [
  { role: "Sales Rep", email: "rep@dealflow360.com", password: "Rep@123" },
  { role: "Sales Manager", email: "manager@dealflow360.com", password: "Manager@123" },
  { role: "Finance", email: "finance@dealflow360.com", password: "Finance@123" },
  { role: "Admin", email: "admin@dealflow360.com", password: "Admin@123" },
];

export default function LoginPage() {
  const { login } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    const r = await login(email, password);
    if (r.ok) { toast.push(`Welcome back, ${r.user.name}`); nav("/"); }
    else toast.push(r.message, "error");
  };

  return (
    <div className="min-h-screen flex bg-ink-900">
      <div className="hidden lg:flex flex-1 flex-col justify-center px-16 text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "radial-gradient(circle at 20% 30%, #3563ff 0, transparent 40%), radial-gradient(circle at 80% 70%, #06b6d4 0, transparent 35%)" }} />
        <div className="relative">
          <div className="text-2xl font-extrabold mb-10">DealFlow360</div>
          <h1 className="text-4xl font-extrabold leading-tight max-w-lg">The Deal Engine that makes both sides win.</h1>
          <p className="text-white/60 mt-4 max-w-lg">Profit-aware multi-dealer negotiation that optimizes customer value, dealer profit and company margin — with risk-gated approvals, What-If simulation and hybrid billing.</p>
          <div className="flex gap-3 mt-8">
            <div className="flex items-center gap-2 bg-white/10 rounded-xl px-4 py-3 text-sm">
              <ShieldCheck size={16} className="text-accent-400" /> Risk-gated approvals
            </div>
            <div className="flex items-center gap-2 bg-white/10 rounded-xl px-4 py-3 text-sm">
              <TrendingUp size={16} className="text-accent-400" /> Dealer profit scoring
            </div>
            <div className="flex items-center gap-2 bg-white/10 rounded-xl px-4 py-3 text-sm">
              <FlaskConical size={16} className="text-accent-400" /> What-If simulator
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center bg-ink-50 p-6">
        <div className="w-full max-w-md">
          <div className="lg:hidden text-xl font-extrabold text-ink-900 mb-6">DealFlow360</div>
          <div className="card p-6">
            <h2 className="text-lg font-extrabold text-ink-900">Sign in to operations</h2>
            <p className="text-xs text-ink-700/50 mt-1 mb-5">Deal optimization console for reps, managers and finance.</p>
            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="label">Work email</label>
                <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@dealflow360.com" />
              </div>
              <div>
                <label className="label">Password</label>
                <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="••••••••" />
              </div>
              <button className="btn-primary w-full justify-center" type="submit">Sign in</button>
            </form>
            <div className="mt-5 border-t border-ink-100 pt-4">
              <div className="text-xs font-bold text-ink-700/50 mb-2">Demo accounts — click to fill</div>
              <div className="flex flex-wrap gap-1.5">
                {DEMO.map((d) => (
                  <button key={d.role} onClick={() => { setEmail(d.email); setPassword(d.password); }} className="text-xs px-2 py-1 rounded-full bg-brand-50 text-brand-700 hover:bg-brand-100">
                    {d.role}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="text-center mt-4 text-xs text-ink-700/50">
            Need an account? <Link to="/signup" className="font-semibold text-brand-700 hover:underline">Create one</Link>
            <span className="mx-2">·</span>
            <Link to="/portal/login" className="font-semibold text-brand-700 hover:underline">Customer portal</Link>
          </div>
        </div>
      </div>
    </div>
  );
}