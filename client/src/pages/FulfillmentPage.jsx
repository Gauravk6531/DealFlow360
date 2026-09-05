import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api, { errMsg } from "../services/api";
import { fmtINR } from "../utils/format";
import { Loader, PageHeader, Modal, StageBadge } from "../components/ui";
import { useToast } from "../store/ui";
import { Truck } from "lucide-react";

export default function FulfillmentPage() {
  const toast = useToast();
  const [quotes, setQuotes] = useState(null);
  const [planQuote, setPlanQuote] = useState(null);
  const [plan, setPlan] = useState(null);

  const load = () => api.get("/quotes").then((r) => setQuotes(r.data.quotes)).catch(() => setQuotes([]));
  useEffect(() => { load(); }, []);

  if (!quotes) return <Loader />;
  const won = quotes.filter((q) => q.wonAt || q.confirmedAt);

  const runPlan = async (q) => {
    setPlanQuote(q);
    setPlan(null);
    try {
      const { data } = await api.post(`/quotes/${q._id}/fulfillment`, {});
      setPlan(data.plan);
    } catch (e) { toast.push(errMsg(e), "error"); }
  };

  return (
    <div>
      <PageHeader title="Fulfillment Planner" subtitle="Intelligent warehouse allocation across locations — single source preferred, backorders surfaced automatically." actions={<span className="badge bg-cyan-50 text-cyan-700 flex items-center gap-1"><Truck size={12} /> {won.length} won deals</span>} />

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-ink-50">
              <tr>
                <th className="th">Quote</th>
                <th className="th">Customer</th>
                <th className="th">Total</th>
                <th className="th">Fulfillment</th>
                <th className="th">Won</th>
                <th className="th"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {won.map((q) => (
                <tr key={q._id} className="hover:bg-ink-50/60">
                  <td className="td"><Link to={`/quotes/${q._id}`} className="font-mono text-xs text-brand-700 hover:underline">{q.quoteNumber}</Link></td>
                  <td className="td font-semibold text-ink-900">{q.customerId?.name}</td>
                  <td className="td font-semibold">{fmtINR(q.total)}</td>
                  <td className="td"><span className={`badge ${q.fulfillmentStatus === "Pending" ? "bg-ink-100 text-ink-700" : q.fulfillmentStatus === "Partial" ? "bg-warn/15 text-warn" : "bg-emerald-100 text-emerald-700"}`}>{q.fulfillmentStatus}</span></td>
                  <td className="td text-xs text-ink-700/50">{new Date(q.wonAt).toLocaleDateString()}</td>
                  <td className="td text-right"><button className="btn-secondary !py-1.5 text-xs" onClick={() => runPlan(q)}><Truck size={13} /> Plan</button></td>
                </tr>
              ))}
              {won.length === 0 && <tr><td colSpan={6} className="td text-center text-ink-700/50 py-10">Win a deal to see fulfillment planning here.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={!!planQuote} onClose={() => setPlanQuote(null)} title={`Fulfillment — ${planQuote?.quoteNumber}`} wide>
        {!plan ? <Loader label="Planning shipments…" /> : (
          <div>
            <div className="flex gap-3 mb-4">
              <div className="bg-ink-50 rounded-xl px-4 py-2 text-center"><div className="text-lg font-extrabold">{plan.shipments}</div><div className="text-[10px] uppercase font-bold text-ink-700/40">Shipments</div></div>
              <div className="bg-ink-50 rounded-xl px-4 py-2 text-center"><div className="text-lg font-extrabold">{plan.backorders}</div><div className="text-[10px] uppercase font-bold text-ink-700/40">Backorder</div></div>
              <div className="bg-ink-50 rounded-xl px-4 py-2 text-center"><div className="text-lg font-extrabold">{fmtINR(plan.totalShippingCost)}</div><div className="text-[10px] uppercase font-bold text-ink-700/40">Shipping</div></div>
              <div className="bg-ink-50 rounded-xl px-4 py-2 text-center"><div className="text-lg font-extrabold">{plan.status}</div><div className="text-[10px] uppercase font-bold text-ink-700/40">Status</div></div>
            </div>
            {(plan.lines || []).map((l) => (
              <div key={l.productId} className="border border-ink-100 rounded-lg p-4 mb-3">
                <div className="flex justify-between text-sm font-bold mb-2"><span>{l.productName}</span><span>Qty {l.quantity}</span></div>
                {(l.allocated || []).map((a, i) => (
                  <div key={i} className="flex justify-between text-sm text-ink-700/70 py-0.5"><span>{a.warehouseName} <span className="text-ink-700/40">· {a.location}</span></span><b>{a.quantity}</b></div>
                ))}
                {l.backorder > 0 ? <div className="text-sm text-warn font-semibold mt-1">⚠ {l.backorder} on backorder · ETA ≈ {l.deliveryEstimateDays}d</div> : <div className="text-xs text-emerald-700 font-semibold mt-1">✓ Fully allocated</div>}
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}