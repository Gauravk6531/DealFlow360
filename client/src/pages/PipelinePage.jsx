import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";
import { fmtINR } from "../utils/format";
import { Loader, PageHeader } from "../components/ui";
import { deriveStage } from "./QuotesPage";
import { stageColor } from "../utils/format";

const STAGES = ["Draft", "Sent", "Negotiation", "Approval", "Approved", "Fulfillment", "Billing", "Won", "Lost"];

export default function PipelinePage() {
  const [quotes, setQuotes] = useState(null);

  useEffect(() => {
    api.get("/quotes").then((r) => setQuotes(r.data.quotes)).catch(() => setQuotes([]));
  }, []);

  if (!quotes) return <Loader />;

  const buckets = STAGES.map((st) => ({ stage: st, items: quotes.filter((q) => deriveStage(q) === st) }));

  return (
    <div>
      <PageHeader title="Sales pipeline" subtitle="Drag-free kanban — every deal stages itself automatically from risk, approval and fulfilment signals." />
      <div className="grid grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
        {buckets.map(({ stage, items }) => (
          <div key={stage} className="card bg-ink-50/60">
            <div className="px-4 py-3 flex items-center justify-between border-b border-ink-100">
              <span className={`badge ${stageColor(stage)}`}>{stage}</span>
              <span className="text-xs font-bold text-ink-700/50">{items.length}</span>
            </div>
            <div className="p-3 space-y-2 min-h-[90px]">
              {items.map((q) => (
                <Link key={q._id} to={`/quotes/${q._id}`} className="block bg-white card !shadow-none !border-ink-100 p-3 hover:shadow-lift transition">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-[11px] text-brand-700">{q.quoteNumber}</span>
                    <span className="text-xs font-semibold text-ink-900">{fmtINR(q.total)}</span>
                  </div>
                  <div className="text-sm font-semibold text-ink-900 truncate">{q.customerId?.name || "—"}</div>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className={`badge ${q.riskLevel === "High" ? "bg-red-100 text-red-700" : q.riskLevel === "Medium" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>{q.riskLevel || "Low"} risk</span>
                    {q.dealHealthStatus && q.dealHealthStatus !== "Healthy" && <span className="badge bg-red-100 text-red-700">{q.dealHealthStatus}</span>}
                  </div>
                </Link>
              ))}
              {items.length === 0 && <div className="text-xs text-ink-700/30 text-center py-6">empty</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}