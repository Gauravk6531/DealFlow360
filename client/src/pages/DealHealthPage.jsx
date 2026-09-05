import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";
import { fmtINR } from "../utils/format";
import { Loader, PageHeader, HealthBadge, RiskBadge } from "../components/ui";
import { HeartPulse, Clock, AlertTriangle, Percent } from "lucide-react";

export default function DealHealthPage() {
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get("/dashboard/deal-intelligence").then((r) => setData(r.data)).catch(() => setData(null));
  }, []);

  if (!data) return <Loader />;
  const c = data.counts;
  const { lists } = data;

  const renderList = (quotes, emptyMsg) => (
    <div className="divide-y divide-ink-100">
      {quotes.length === 0 ? <div className="p-4 text-sm text-ink-700/50">{emptyMsg}</div> : quotes.map((q) => (
        <Link key={q._id} to={`/quotes/${q._id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-ink-50">
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold truncate">{q.customerId?.name}</div>
            <div className="text-xs font-mono text-brand-700">{q.quoteNumber}</div>
          </div>
          <div className="text-sm font-semibold">{fmtINR(q.total)}</div>
          <RiskBadge level={q.riskLevel} />
        </Link>
      ))}
    </div>
  );

  return (
    <div>
      <PageHeader title="Deal Health Command Center" subtitle="Autonomous diagnostics — margin anomalies, stalled deals, discount violations and high-risk quotations." />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <div className="card p-4 text-center"><div className="text-2xl font-extrabold text-emerald-600">{c.healthy}</div><div className="text-xs font-bold uppercase text-ink-700/50">Healthy</div></div>
        <div className="card p-4 text-center"><div className="text-2xl font-extrabold text-amber-600">{c.atRisk + c.critical}</div><div className="text-xs font-bold uppercase text-ink-700/50">At risk / critical</div></div>
        <div className="card p-4 text-center"><div className="text-2xl font-extrabold text-warn">{c.stalled}</div><div className="text-xs font-bold uppercase text-ink-700/50">Stalled &gt;7d</div></div>
        <div className="card p-4 text-center"><div className="text-2xl font-extrabold text-risk">{c.marginAnomalies + c.discountAnomalies}</div><div className="text-xs font-bold uppercase text-ink-700/50">Anomalies</div></div>
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="card">
          <div className="px-5 py-3 border-b border-ink-100 font-bold flex items-center gap-2"><HeartPulse size={15} className="text-emerald-600" /> Healthy</div>
          {renderList(lists.healthy, "No flagged healthy deals listed, all clear.")}
        </div>
        <div className="card">
          <div className="px-5 py-3 border-b border-ink-100 font-bold flex items-center gap-2"><AlertTriangle size={15} className="text-amber-600" /> At risk</div>
          {renderList([...lists.atRisk, ...lists.critical], "Nothing at risk.")}
        </div>
        <div className="space-y-5">
          <div className="card">
            <div className="px-5 py-3 border-b border-ink-100 font-bold flex items-center gap-2"><Clock size={15} className="text-warn" /> Stalled quotes</div>
            <div className="divide-y divide-ink-100">
              {lists.stalled.length === 0 ? <div className="p-4 text-sm text-ink-700/50">No stalled deals.</div> : lists.stalled.slice(0, 6).map((q) => (
                <Link key={q._id} to={`/quotes/${q._id}`} className="flex items-center justify-between px-4 py-3 hover:bg-ink-50">
                  <div>
                    <div className="text-sm font-semibold">{q.customerId?.name}</div>
                    <div className="text-xs text-ink-700/50">{Math.round((Date.now() - new Date(q.updatedAt || q.createdAt)) / 86400000)}d inactive</div>
                  </div>
                  <span className="text-sm font-bold">{fmtINR(q.total)}</span>
                </Link>
              ))}
            </div>
          </div>
          <div className="card">
            <div className="px-5 py-3 border-b border-ink-100 font-bold flex items-center gap-2"><Percent size={15} className="text-risk" /> Anomalies</div>
            {renderList([...lists.marginAnomalies, ...lists.discountAnomalies], "No margin or discount anomalies.")}
          </div>
        </div>
      </div>
    </div>
  );
}