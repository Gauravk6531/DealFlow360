import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";
import { fmtINR, fmtINRShort } from "../utils/format";
import { StatCard, PageHeader, Loader, RiskBadge, HealthBadge } from "../components/ui";
import { useAuth } from "../store/auth";
import { IndianRupee, FileText, TrendingUp, AlertTriangle, GitBranch, Handshake, BadgeCheck } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

const STAGE_COLORS = { Draft: "#cbd5e1", Sent: "#3b82f6", Negotiation: "#a855f7", Approval: "#d97706", Approved: "#14b8a6", Fulfillment: "#06b6d4", Billing: "#6366f1", Won: "#16a34a", Lost: "#dc2626" };

export default function DashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get("/dashboard").then((r) => setData(r.data)).catch(() => {});
  }, []);

  if (!data) return <Loader label="Crunching pipeline intelligence…" />;
  const s = data.stats;

  const stageCounts = Object.entries(data.byStage || {}).map(([name, count]) => ({ name, count }));
  const chartData = ["Draft", "Sent", "Negotiation", "Approval", "Approved", "Fulfillment", "Billing", "Won", "Lost"].filter((st) => (data.byStage || {})[st] !== undefined).map((st) => ({ name: st, count: data.byStage[st] }));

  return (
    <div>
      <PageHeader
        title={`Welcome back, ${user?.name?.split(" ")[0]} 👋`}
        subtitle="Live health of your revenue engine — auto-optimized, risk-gated, dealer-negotiated."
        actions={<Link to="/builder" className="btn-primary">+ New Quote</Link>}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Pipeline value" value={fmtINRShort(data.pipelineValue)} sub={`${s.pipelineCount} active deals`} icon={IndianRupee} accent="bg-brand-50 text-brand-700" />
        <StatCard label="Won revenue" value={fmtINRShort(s.revenue)} sub={`${s.wonCount} deals closed`} icon={TrendingUp} accent="bg-emerald-50 text-emerald-700" />
        <StatCard label="Conversion rate" value={`${s.conversionRate}%`} sub={`avg discount ${s.avgDiscount}%`} icon={FileText} accent="bg-purple-50 text-purple-700" />
        <StatCard label="At risk" value={s.atRiskCount} sub={`${s.pendingApprovals} approvals pending`} icon={AlertTriangle} accent="bg-amber-50 text-amber-700" />
      </div>

      <div className="grid lg:grid-cols-3 gap-5 mt-6">
        <div className="lg:col-span-2 card">
          <div className="px-5 py-3 border-b border-ink-100 flex items-center justify-between">
            <div className="font-bold text-ink-900 flex items-center gap-2"><GitBranch size={16} className="text-brand-600" /> Pipeline by stage</div>
          </div>
          <div className="p-5">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={28} />
                <Tooltip cursor={{ fill: "#f6f7fb" }} />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {chartData.map((e, i) => <Cell key={i} fill={STAGE_COLORS[e.name] || "#3563ff"} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <div className="px-5 py-3 border-b border-ink-100 font-bold text-ink-900 flex items-center gap-2"><AlertTriangle size={16} className="text-warn" /> Deals needing attention</div>
          <div className="divide-y divide-ink-100">
            {data.atRisk.length === 0 && <div className="p-5 text-sm text-ink-700/50">All deals looking healthy. 🎉</div>}
            {data.atRisk.slice(0, 6).map((q) => (
              <Link key={q._id} to={`/quotes/${q._id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-ink-50">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-ink-900 truncate">{q.customerId?.name}</div>
                  <div className="text-xs font-mono text-brand-700">{q.quoteNumber}</div>
                </div>
                <RiskBadge level={q.riskLevel} />
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-5 mt-6">
        <div className="card">
          <div className="px-5 py-3 border-b border-ink-100 font-bold text-ink-900 flex items-center gap-2"><Handshake size={16} className="text-brand-600" /> Recent negotiations</div>
          <div className="divide-y divide-ink-100">
            {data.recentNegotiations.length === 0 && <div className="p-5 text-sm text-ink-700/50">No negotiations yet.</div>}
            {data.recentNegotiations.map((n) => (
              <div key={n.id} className="px-5 py-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-brand-50 text-brand-700 flex items-center justify-center text-xs font-bold">R{n.round}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-ink-900">{n.customer}</div>
                  <div className="text-xs text-ink-700/50">{fmtINR(n.requested)} requested → {fmtINR(n.proposed)} offered</div>
                </div>
                <span className={`badge ${n.status === "Approved" || n.status === "Accepted" ? "bg-emerald-100 text-emerald-700" : n.status === "Counter Offered" ? "bg-amber-100 text-amber-700" : "bg-ink-100 text-ink-700"}`}>{n.status}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="px-5 py-3 border-b border-ink-100 font-bold text-ink-900 flex items-center gap-2"><TrendingUp size={16} className="text-brand-600" /> Best dealer this month</div>
          <div className="p-5">
            <div className="flex items-center justify-center gap-3 text-center mb-4">
              <BadgeCheck size={22} className="text-emerald-600" />
              <div>
                <div className="text-xl font-extrabold text-ink-900">Global Devices</div>
                <div className="text-sm text-ink-700/50">recommended for the current hero deal</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="bg-ink-50 rounded-xl py-3"><div className="text-lg font-extrabold text-ink-900">₹40,000</div><div className="text-[11px] text-ink-700/50">unit price · 98% reliability</div></div>
              <div className="bg-ink-50 rounded-xl py-3"><div className="text-lg font-extrabold text-ink-900">4d</div><div className="text-[11px] text-ink-700/50">delivery · 150 units ready</div></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}