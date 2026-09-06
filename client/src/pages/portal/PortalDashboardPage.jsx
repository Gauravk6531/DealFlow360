import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../services/api";
import { fmtINR } from "../../utils/format";
import { StatCard, Loader, StageBadge, PageHeader } from "../../components/ui";
import { FileText, TrendingUp, PiggyBank, FolderOpen } from "lucide-react";

export default function PortalDashboardPage() {
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get("/customer/dashboard").then((r) => setData(r.data)).catch(() => setData({ stats: {}, recentQuotes: [] }));
  }, []);

  if (!data) return <Loader />;

  const s = data.stats || {};
  return (
    <div>
      <PageHeader title="Account overview" subtitle="Track your quotations, savings and everything we are negotiating for you." />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Open quotations" value={s.openQuotes} icon={FolderOpen} accent="bg-brand-50 text-brand-700" />
        <StatCard label="Potential value" value={fmtINR(s.totalValue)} icon={FileText} accent="bg-purple-50 text-purple-700" />
        <StatCard label="Confirmed value" value={fmtINR(s.acceptedValue)} icon={TrendingUp} accent="bg-emerald-50 text-emerald-700" />
        <StatCard label="Avg savings / quote" value={fmtINR(s.averageSavings)} icon={PiggyBank} accent="bg-amber-50 text-amber-700" />
      </div>

      <div className="card mt-6">
        <div className="px-5 py-3 border-b border-ink-100 font-bold text-ink-900">Recent quotations</div>
        <div className="divide-y divide-ink-100">
          {data.recentQuotes.length === 0 && <div className="p-6 text-sm text-ink-700/50">No quotations yet.</div>}
          {data.recentQuotes.map((q) => (
            <Link key={q._id} to={`/portal/quotes/${q._id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-ink-50 transition">
              <div className="font-mono text-sm text-brand-700">{q.quoteNumber}</div>
              <div className="flex-1 text-sm text-ink-700/60 hidden sm:block">Created {new Date(q.createdAt).toLocaleDateString()}</div>
              <div className="text-sm font-semibold">{fmtINR(q.total)}</div>
              {q.customerSavings > 0 && <div className="badge bg-emerald-100 text-emerald-700 text-xs">Save {fmtINR(q.customerSavings)}</div>}
              <StageBadge stage={q.lostAt ? "Lost" : q.wonAt || q.confirmedAt ? "Won" : q.approvalStatus === "Pending" ? "Approval" : q.approvalStatus === "Approved" || q.negotiationStatus === "Accepted" ? "Approved" : q.negotiationStatus === "Negotiating" || q.negotiationStatus === "Counter Offered" ? "Negotiation" : "Sent"} />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}