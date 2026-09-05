import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api, { errMsg } from "../services/api";
import { fmtINR } from "../utils/format";
import { Loader, PageHeader, Modal } from "../components/ui";
import { useToast } from "../store/ui";
import { Receipt } from "lucide-react";

export default function BillingPage() {
  const toast = useToast();
  const [quotes, setQuotes] = useState(null);
  const [billQuote, setBillQuote] = useState(null);
  const [bill, setBill] = useState(null);

  useEffect(() => { api.get("/quotes").then((r) => setQuotes(r.data.quotes)).catch(() => setQuotes([])); }, []);
  if (!quotes) return <Loader />;

  const won = quotes.filter((q) => q.wonAt || q.confirmedAt);

  const open = async (q) => {
    setBillQuote(q);
    setBill(null);
    try {
      const { data } = await api.get(`/quotes/${q._id}/billing`);
      setBill(data.billing);
    } catch (e) { toast.push(errMsg(e), "error"); }
  };

  return (
    <div>
      <PageHeader title="Hybrid Billing" subtitle="One invoice for hardware + software, plus recurring schedules with proration, cancellation and refund rules." actions={<span className="badge bg-indigo-50 text-indigo-700 flex items-center gap-1"><Receipt size={12} /> {won.length} billable</span>} />

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-ink-50">
              <tr>
                <th className="th">Quote</th>
                <th className="th">Customer</th>
                <th className="th">Total</th>
                <th className="th">Type</th>
                <th className="th"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {won.map((q) => (
                <tr key={q._id} className="hover:bg-ink-50/60">
                  <td className="td"><Link to={`/quotes/${q._id}`} className="font-mono text-xs text-brand-700 hover:underline">{q.quoteNumber}</Link></td>
                  <td className="td font-semibold">{q.customerId?.name}</td>
                  <td className="td font-semibold">{fmtINR(q.total)}</td>
                  <td className="td"><span className={`badge ${q.lines.some((l) => l.isSubscription) ? "bg-purple-100 text-purple-700" : "bg-ink-100 text-ink-700"}`}>{q.lines.some((l) => l.isSubscription) ? "HYBRID" : "ONE_TIME"}</span></td>
                  <td className="td text-right"><button className="btn-secondary !py-1.5 text-xs" onClick={() => open(q)}>Preview invoice</button></td>
                </tr>
              ))}
              {won.length === 0 && <tr><td colSpan={5} className="td text-center text-ink-700/50 py-10">No won deals to bill yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={!!billQuote} onClose={() => setBillQuote(null)} title={`Billing — ${billQuote?.quoteNumber}`} wide>
        {!bill ? <Loader label="Generating invoice…" /> : (
          <div>
            <div className="flex gap-3 mb-4 flex-wrap">
              <div className="bg-ink-50 rounded-xl px-4 py-2 text-center"><div className="text-lg font-extrabold">{bill.billingType}</div><div className="text-[10px] uppercase font-bold text-ink-700/40">Type</div></div>
              <div className="bg-ink-50 rounded-xl px-4 py-2 text-center"><div className="text-lg font-extrabold">{fmtINR(bill.oneTimeInvoice?.subtotal)}</div><div className="text-[10px] uppercase font-bold text-ink-700/40">One-time subtotal</div></div>
              <div className="bg-ink-50 rounded-xl px-4 py-2 text-center"><div className="text-lg font-extrabold">{fmtINR(bill.recurringMonthlyEquivalent)}</div><div className="text-[10px] uppercase font-bold text-ink-700/40">Monthly equiv</div></div>
              <div className="bg-ink-50 rounded-xl px-4 py-2 text-center"><div className="text-lg font-extrabold text-brand-700">{bill.oneTimeInvoice?.invoiceNumber}</div><div className="text-[10px] uppercase font-bold text-ink-700/40">Invoice</div></div>
            </div>
            <div className="text-sm font-bold mb-2">One-time items</div>
            {(bill.oneTimeInvoice?.items || []).map((l) => (
              <div key={l.productId} className="flex justify-between text-sm py-1 border-b border-ink-100/60"><span>{l.productName} × {l.quantity} @ {fmtINR(l.unitPrice)}</span><b>{fmtINR(l.lineTotal)}</b></div>
            ))}
            {(bill.recurring || []).map((s) => (
              <div key={s.productName} className="border border-ink-100 rounded-lg p-3 mt-3">
                <div className="flex justify-between text-sm"><span className="font-semibold">{s.productName}</span><span className="font-bold">{fmtINR(s.periodPrice)} / {s.billingCycle}</span></div>
                <div className="text-xs text-ink-700/50 my-1">📋 {s.prorationRule} · 🚫 {s.cancellationRule} · 💸 {s.refundRule}</div>
                <div className="flex gap-1 flex-wrap">{s.periods.slice(0, 5).map((p) => <span key={p.period} className="badge bg-ink-50 text-ink-700/70">{p.dueDate} · {fmtINR(p.amount)}</span>)}</div>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}