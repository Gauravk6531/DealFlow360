import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";
import { fmtINR } from "../utils/format";
import { Loader, PageHeader } from "../components/ui";
import { Handshake } from "lucide-react";

const STATUS_STYLE = {
  Approved: "bg-emerald-100 text-emerald-700",
  Accepted: "bg-emerald-100 text-emerald-700",
  "Counter Offered": "bg-amber-100 text-amber-700",
  Escalated: "bg-red-100 text-red-700",
  Pending: "bg-ink-100 text-ink-700",
  Rejected: "bg-red-100 text-red-700",
};

export default function NegotiationCenterPage() {
  const [items, setItems] = useState(null);

  useEffect(() => {
    api.get("/negotiations").then((r) => setItems(r.data.negotiations)).catch(() => setItems([]));
  }, []);

  if (!items) return <Loader />;

  return (
    <div>
      <PageHeader title="Negotiation Center" subtitle="Every round of every deal — see exactly why a counter-offer was engineered, per dealer." actions={<span className="badge bg-brand-50 text-brand-700 flex items-center gap-1"><Handshake size={12} /> {items.length} rounds</span>} />

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-ink-50">
              <tr>
                <th className="th">Quote</th>
                <th className="th">Customer</th>
                <th className="th">Round</th>
                <th className="th">Original</th>
                <th className="th">Requested</th>
                <th className="th">Proposed</th>
                <th className="th">Savings</th>
                <th className="th">Dealer profit</th>
                <th className="th">Company profit</th>
                <th className="th">Decision</th>
                <th className="th">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {items.map((n) => (
                <tr key={n._id} className="hover:bg-ink-50/60">
                  <td className="td"><Link to={`/quotes/${n.quoteId?._id}`} className="font-mono text-xs text-brand-700 hover:underline">{n.quoteId?.quoteNumber || "—"}</Link></td>
                  <td className="td font-semibold text-ink-900">{n.customerId?.name || "—"}</td>
                  <td className="td badge bg-ink-100 text-ink-700">R{n.negotiationRound}</td>
                  <td className="td">{fmtINR(n.originalPrice)}</td>
                  <td className="td">{fmtINR(n.customerRequestedPrice)}</td>
                  <td className="td font-bold text-emerald-700">{fmtINR(n.proposedPrice)}</td>
                  <td className="td text-profit font-semibold">{fmtINR(n.customerSavings)}</td>
                  <td className="td">{fmtINR(n.dealerProfit)}</td>
                  <td className="td">{fmtINR(n.companyProfit)}</td>
                  <td className="td"><span className={`badge ${n.decision === "AUTO_ACCEPT" ? "bg-emerald-100 text-emerald-700" : n.decision === "COUNTER_OFFER" ? "bg-amber-100 text-amber-700" : n.decision === "ESCALATE" ? "bg-red-100 text-red-700" : "bg-ink-100 text-ink-700"}`}>{n.decision}</span></td>
                  <td className="td"><span className={`badge ${STATUS_STYLE[n.status] || "bg-ink-100 text-ink-700"}`}>{n.status}</span></td>
                </tr>
              ))}
              {items.length === 0 && <tr><td colSpan={11} className="td text-center text-ink-700/50 py-10">No negotiations yet. Ask a customer for a better price and watch this fill up.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}