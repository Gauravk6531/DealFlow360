import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../services/api";
import { fmtINR } from "../../utils/format";
import { Loader, Empty, PageHeader, StageBadge } from "../../components/ui";

export default function PortalQuotesPage() {
  const [quotes, setQuotes] = useState(null);

  useEffect(() => {
    api.get("/customer/quotes").then((r) => setQuotes(r.data.quotes)).catch(() => setQuotes([]));
  }, []);

  if (!quotes) return <Loader />;
  if (quotes.length === 0) return <><PageHeader title="My quotations" /><Empty icon="📄" title="No quotations yet" sub="Your sales partner will share quotations here." /></>;

  const stageOf = (q) => {
    if (q.lostAt) return "Lost";
    if (q.wonAt || q.confirmedAt) return "Won";
    if (q.approvalStatus === "Pending") return "Approval";
    if (q.approvalStatus === "Approved") return "Approved";
    if (q.negotiationStatus === "Counter Offered") return "Negotiation";
    if (q.negotiationStatus === "Negotiating") return "Negotiation";
    if (q.negotiationStatus === "Accepted") return "Approved";
    return "Sent";
  };

  return (
    <div>
      <PageHeader title="My quotations" subtitle="Review pricing, request better terms, accept counter-offers and confirm." />
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-ink-50">
              <tr>
                <th className="th">Quote</th>
                <th className="th">Date</th>
                <th className="th">Total</th>
                <th className="th">Savings</th>
                <th className="th">Status</th>
                <th className="th"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {quotes.map((q) => (
                <tr key={q._id} className="hover:bg-ink-50/60">
                  <td className="td font-mono text-brand-700">{q.quoteNumber}</td>
                  <td className="td">{new Date(q.createdAt).toLocaleDateString()}</td>
                  <td className="td font-semibold">{fmtINR(q.total)}</td>
                  <td className="td">{q.customerSavings > 0 ? <span className="badge bg-emerald-100 text-emerald-700">₹{q.customerSavings.toLocaleString("en-IN")}</span> : "—"}</td>
                  <td className="td"><StageBadge stage={stageOf(q)} /></td>
                  <td className="td text-right"><Link to={`/portal/quotes/${q._id}`} className="btn-ghost !py-1 text-xs">View</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}