import { Loader2 } from "lucide-react";
import { stageColor, riskColor, healthColor } from "../utils/format";

export function StatCard({ label, value, sub, icon: Icon, accent = "bg-brand-50 text-brand-700", onClick }) {
  return (
    <div onClick={onClick} className={`card p-5 ${onClick ? "cursor-pointer hover:shadow-lift transition" : ""}`}>
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs font-bold uppercase tracking-wide text-ink-700/60">{label}</div>
          <div className="text-2xl font-extrabold mt-1 text-ink-900">{value}</div>
          {sub && <div className="text-xs text-ink-700/50 mt-1">{sub}</div>}
        </div>
        {Icon && <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${accent}`}><Icon size={18} /></div>}
      </div>
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="flex items-center justify-between gap-4 mb-6">
      <div>
        <h1 className="text-xl font-extrabold text-ink-900">{title}</h1>
        {subtitle && <p className="text-sm text-ink-700/60 mt-0.5">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function StageBadge({ stage }) {
  return <span className={`badge ${stageColor(stage)}`}>{stage}</span>;
}

export function RiskBadge({ level }) {
  return <span className={`badge ${riskColor(level)}`}>{level || "—"} risk</span>;
}

export function HealthBadge({ status }) {
  return <span className={`badge ${healthColor(status)}`}>{status}</span>;
}

export function Panel({ title, actions, children, className = "" }) {
  return (
    <div className={`card ${className}`}>
      {(title || actions) && (
        <div className="flex items-center justify-between px-5 py-3 border-b border-ink-100">
          <div className="font-bold text-ink-900">{title}</div>
          {actions}
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  );
}

export function Loader({ label = "Loading…" }) {
  return (
    <div className="flex items-center justify-center py-20 text-ink-700/60 gap-2">
      <Loader2 size={18} className="animate-spin" /> {label}
    </div>
  );
}

export function Empty({ icon, title, sub }) {
  return (
    <div className="py-14 text-center">
      <div className="text-3xl mb-2">{icon || "🗂️"}</div>
      <div className="font-bold text-ink-900">{title || "Nothing here yet"}</div>
      {sub && <div className="text-sm text-ink-700/50 mt-1">{sub}</div>}
    </div>
  );
}

export function Modal({ open, onClose, title, children, wide }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div className={`card shadow-lift w-full ${wide ? "max-w-5xl" : "max-w-lg"} max-h-[90vh] overflow-auto`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-ink-100">
          <div className="font-bold text-ink-900">{title}</div>
          <button onClick={onClose} className="text-ink-700/50 hover:text-ink-900 text-lg leading-none">×</button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function MoneyDelta({ a, b, inverse }) {
  const diff = (inverse ? b : a) - (inverse ? a : b);
  if (diff === 0) return <span className="text-ink-700/50 text-sm">no change</span>;
  const good = inverse ? diff < 0 : diff > 0;
  return (
    <span className={`text-sm font-semibold ${good ? "text-profit" : "text-risk"}`}>
      {diff > 0 ? "↑ " : "↓ "}₹{Math.abs(diff).toLocaleString("en-IN")}
    </span>
  );
}

export function SectionLabel({ children }) {
  return <div className="text-xs font-bold uppercase tracking-wider text-ink-700/50 mb-1">{children}</div>;
}