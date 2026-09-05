import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import api from "../services/api";
import { fmtINR, stageColor } from "../utils/format";
import { Loader, Empty, PageHeader, RiskBadge, HealthBadge } from "../components/ui";
import { Plus } from "lucide-react";

const STAGES = ["All", "Draft", "Sent", "Negotiation", "Approval", "Approved", "Fulfillment", "Billing", "Won", "Lost"];

export function deriveStage(q) {
  if (q.lostAt) return "Lost";
  if (q.wonAt) return "Won";
  if (q.confirmedAt) return q.invoiceIssued ? "Billing" : "Fulfillment";
  if (q.approvalStatus === "Pending") return "Approval";
  if (q.negotiationStatus === "Negotiating" || q.negotiationStatus === "Counter Offered") return "Negotiation";
  if (q.approvalStatus === "Approved") return "Approved";
  if (q.submittedAt) return "Sent";
  return "Draft";
}

export default function QuotesPage() {
  const [quotes, setQuotes] = useState(null);
  const [params, setParams] = useSearchParams();
  const stage = params.get("stage") || "All";

  useEffect(() => {
    api.get("/quotes").then((r) => setQuotes(r.data.quotes)).catch(() => setQuotes([]));
  }, []);

  if (!quotes) return <Loader />;

  const filtered = stage === "All" ? quotes : quotes.filter((q) => deriveStage(q) === stage);
  const counts = quotes.reduce((a, q) => { const s = deriveStage(q); a[s] = (a[s] || 0) + 1; return a; }, {});

  return (
    <div>
      <PageHeader title="Quotations" subtitle={`${quotes.length} total · ${counts.Won || 0} won`} actions={<Link to="/builder" className="btn-primary"><Plus size={15} /> New Quote</Link>} />

      <div className="flex flex-wrap gap-1.5 mb-5">
        {STAGES.map((st) => (
          <button key={st} onClick={() => setParams(st === "All" ? {} : { stage: st })}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition ${stage === st ? "bg-ink-900 text-white" : "bg-white text-ink-700/60 border border-ink-100 hover:bg-ink-50"}`}>
            {st}{st !== "All" && counts[st] ? <span className="ml-1 opacity-60">({counts[st]})</span> : null}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? <div className="card"><Empty icon="🧾" title="No quotations here yet" sub="Create a new quote from the builder to get started." /></div> : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-ink-50">
                <tr>
                  <th className="th">Quote</th>
                  <th className="th">Customer</th>
                  <th className="th">Stage</th>
                  <th className="th">Total</th>
                  <th className="th">Discount</th>
                  <th className="th">Risk</th>
                  <th className="th">Negotiation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {filtered.map((q) => {
                  const st = deriveStage(q);
                  return (
                    <tr key={q._id} className="hover:bg-ink-50/60 cursor-pointer" onClick={() => window.location.assign(`/quotes/${q._id}`)}>
                      <td className="td">
                        <div className="font-mono text-xs text-brand-700">{q.quoteNumber}</div>
                        <div className="text-[11px] text-ink-700/40">v{q.version} · {new Date(q.createdAt).toLocaleDateString()}</div>
                      </td>
                      <td className="td">
                        <div className="font-semibold text-ink-900">{q.customerId?.name || "—"}</div>
                        <div className="text-[11px] text-ink-700/40">{q.customerId?.customerTier} tier</div>
                      </td>
                      <td className="td"><span className={`badge ${stageColor(st)}`}>{st}</span></td>
                      <td className="td font-semibold">{fmtINR(q.total)}</td>
                      <td className="td text-xs">{q.weightedDiscountPct?.toFixed(1)}%</td>
                      <td className="td"><RiskBadge level={q.riskLevel} /></td>
                      <td className="td text-xs text-ink-700/60">{q.negotiationStatus !== "None" ? <span className={`badge ${q.negotiationStatus === "Accepted" ? "bg-emerald-100 text-emerald-700" : "bg-purple-100 text-purple-700"}`}>{q.negotiationStatus}</span> : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}