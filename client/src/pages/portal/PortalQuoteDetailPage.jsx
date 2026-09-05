import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api, { errMsg } from "../../services/api";
import { fmtINR } from "../../utils/format";
import { Loader, Panel, StageBadge, Modal } from "../../components/ui";
import { useToast } from "../../store/ui";
import { ArrowLeft, Handshake, Check, MessageSquare } from "lucide-react";

export default function PortalQuoteDetailPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [requested, setRequested] = useState("");
  const [discountPct, setDiscountPct] = useState("");
  const [busy, setBusy] = useState(false);
  const [commentLine, setCommentLine] = useState(null);
  const [commentText, setCommentText] = useState("");
  const [negResponse, setNegResponse] = useState(null);

  const load = () => api.get(`/customer/quotes/${id}`).then((r) => setData(r.data));
  useEffect(() => { load(); }, [id]);

  if (!data) return <Loader />;
  const { quote, discountLimits, negotiations } = data;

  const counter = negotiations.find((n) => n.status === "Counter Offered" && n.decision === "COUNTER_OFFER");
  const latest = negotiations[0];

  const requestPrice = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const body = {};
      if (discountPct !== "") body.discountPct = Number(discountPct);
      else body.requestedPrice = Number(requested);
      const r = await api.post(`/customer/quotes/${id}/negotiate`, body);
      setNegResponse(r.data.negotiation);
      await load();
    } catch (e) { toast.push(errMsg(e), "error"); }
    setBusy(false);
  };

  const acceptCounter = async () => {
    setBusy(true);
    try {
      const r = await api.post(`/customer/quotes/${id}/accept-counter`, {});
      toast.push(r.data.autoApproved ? "Accepted! Your counter-offer is confirmed." : "Accepted! DealFlow360 is finalizing internal approval — you'll be notified.");
      await load();
    } catch (e) { toast.push(errMsg(e), "error"); }
    setBusy(false);
  };

  const confirm = async () => {
    setBusy(true);
    try {
      await api.post(`/customer/quotes/${id}/confirm`);
      toast.push("Order confirmed. Your fulfilment team has been notified.");
      await load();
    } catch (e) { toast.push(errMsg(e), "error"); }
    setBusy(false);
  };

  const sendComment = async () => {
    setBusy(true);
    try {
      await api.post(`/customer/quotes/${id}/comment`, { lineId: commentLine, text: commentText });
      toast.push("Note sent to your sales partner.");
      setCommentLine(null); setCommentText("");
      await load();
    } catch (e) { toast.push(errMsg(e), "error"); }
    setBusy(false);
  };

  const stage = quote.negotiationStatus === "Counter Offered" || quote.negotiationStatus === "Negotiating"
    ? "Negotiation"
    : quote.negotiationStatus === "Accepted" ? "Approved"
      : quote.confirmedAt ? "Won" : "Sent";

  return (
    <div>
      <button onClick={() => nav(-1)} className="flex items-center gap-1 text-sm text-ink-700/60 hover:text-ink-900 mb-4"><ArrowLeft size={15} /> Back</button>

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <h1 className="text-xl font-extrabold text-ink-900 font-mono">{quote.quoteNumber}</h1>
        <StageBadge stage={stage} />
        {quote.customerSavings > 0 && <span className="badge bg-emerald-100 text-emerald-700">You save {fmtINR(quote.customerSavings)}</span>}
        <div className="ml-auto text-right">
          <div className="text-xs text-ink-700/50 uppercase tracking-wide font-bold">Quoted total incl. GST</div>
          <div className="text-2xl font-extrabold text-ink-900">{fmtINR(quote.total)}</div>
          <div className="text-xs text-ink-700/50">Subtotal {fmtINR(quote.subtotal)} · Tax {fmtINR(quote.tax)}</div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <Panel title="Line items">
            <div className="space-y-3">
              {quote.lines.map((l) => (
                <div key={l._id} className="border border-ink-100 rounded-lg p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="font-semibold text-ink-900">{l.productName}</div>
                      <div className="text-xs text-ink-700/50 mt-0.5">Qty {l.quantity} × {fmtINR(l.unitPrice)} {l.billingCycle ? `· ${l.billingCycle}` : ""} {l.deliveryDays ? `· ${l.deliveryDays}d delivery` : ""}</div>
                      {l.comment && <div className="text-xs mt-2 bg-amber-50 text-amber-800 rounded-lg px-2 py-1 inline-block">Note: {l.comment}</div>}
                    </div>
                    <div className="text-right">
                      <div className="font-bold">{fmtINR(l.unitPrice * l.quantity)}</div>
                      {l.discountPct > 0 && <div className="text-xs text-emerald-700">{l.discountPct}% off</div>}
                    </div>
                  </div>
                  <button onClick={() => { setCommentLine(l._id); setCommentText(l.comment || ""); }} className="mt-2 text-xs flex items-center gap-1 text-brand-700 hover:underline">
                    <MessageSquare size={12} /> Comment on line
                  </button>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Negotiation history">
            {negotiations.length === 0 && <div className="text-sm text-ink-700/50">Nothing yet. Use the negotiation panel to request better terms.</div>}
            <div className="space-y-3">
              {negotiations.map((n) => (
                <div key={n.id} className="border border-ink-100 rounded-lg p-4 text-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-ink-900">Round {n.round}</span>
                    <span className="badge bg-ink-100 text-ink-700">{n.status}</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
                    <div><div className="text-[11px] uppercase text-ink-700/50 font-bold">Quote subtotal</div><div className="font-semibold">{fmtINR(n.originalPrice)}</div></div>
                    <div><div className="text-[11px] uppercase text-ink-700/50 font-bold">You requested</div><div className="font-semibold">{fmtINR(n.customerRequestedPrice)}</div></div>
                    <div><div className="text-[11px] uppercase text-ink-700/50 font-bold">Our offer</div><div className="font-semibold text-emerald-700">{fmtINR(n.proposedPrice)}</div></div>
                    <div><div className="text-[11px] uppercase text-ink-700/50 font-bold">Savings</div><div className="font-semibold">{fmtINR(n.originalPrice - (n.proposedPrice || n.customerRequestedPrice))}</div></div>
                  </div>
                  {n.concessions?.length > 0 && <div className="mt-2 text-xs text-ink-700/60">Includes: {n.concessions.join(", ")}</div>}
                  {n.recommendation && <div className="mt-2 text-xs text-ink-700/60">💡 {n.recommendation}</div>}
                </div>
              ))}
            </div>
          </Panel>
        </div>

        <div className="space-y-5">
          <Panel title="Negotiate this quote">
            {negResponse && (
              <div className="mb-4 bg-brand-50 border border-brand-100 rounded-xl p-4 text-sm">
                <div className="font-bold text-brand-800">{negResponse.recommendation}</div>
                {negResponse.concessions?.length > 0 && <div className="mt-1 text-xs text-brand-700">{negResponse.concessions.join(" + ")}</div>}
                <button onClick={() => setNegResponse(null)} className="text-xs mt-2 text-ink-700/50 hover:underline">Dismiss</button>
              </div>
            )}

            {stage === "Won" && <div className="text-sm text-emerald-700 font-semibold">✅ This quote is confirmed and won. Thank you!</div>}

            {counter && stage === "Negotiation" && (
              <div className="border border-emerald-200 bg-emerald-50 rounded-xl p-4">
                <div className="text-xs font-bold uppercase text-emerald-700 mb-1">Counter-offer on the table</div>
                <div className="text-3xl font-extrabold text-ink-900">{fmtINR(counter.proposedPrice)}</div>
                <div className="text-xs text-ink-700/50 mt-0.5">vs your request of {fmtINR(counter.customerRequestedPrice)}</div>
                {counter.concessions?.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {counter.concessions.map((c) => <span key={c} className="badge bg-emerald-100 text-emerald-700">{c}</span>)}
                  </div>
                )}
                <button className="btn-primary w-full justify-center mt-4" onClick={acceptCounter} disabled={busy}>
                  <Check size={15} /> Accept this offer
                </button>
              </div>
            )}

            {!counter && stage === "Negotiation" && (
              <div className="text-sm text-ink-700/60">We are evaluating your request. A deal specialist will respond shortly.</div>
            )}

            {stage === "Sent" && (
              <form onSubmit={requestPrice} className="space-y-3">
                <div>
                  <label className="label">Your target total (subtotal before GST)</label>
                  <input className="input" type="number" min={0} placeholder="e.g. 900000" value={requested} onChange={(e) => setRequested(e.target.value)} />
                </div>
                <div className="text-center text-[11px] text-ink-700/40 font-semibold uppercase">or</div>
                <div>
                  <label className="label">Request a discount %</label>
                  <input className="input" type="number" min={0} max={100} placeholder="e.g. 10" value={discountPct} onChange={(e) => setDiscountPct(e.target.value)} />
                </div>
                <button className="btn-primary w-full justify-center" type="submit" disabled={busy}><Handshake size={15} /> Request better price</button>
                <div className="text-[11px] text-ink-700/50">Authorized ceiling for your tier: {discountLimits[0]?.allowedDiscount ? `up to ${discountLimits[0].allowedDiscount}% per line.` : "Your tier discount limits apply per line."}</div>
              </form>
            )}

            {stage === "Approved" && !quote.confirmedAt && (
              <div>
                <div className="text-sm mb-3">Your final price is locked at <b>{fmtINR(quote.subtotal)}</b> subtotal ({fmtINR(quote.total)} incl. GST). Ready to move forward?</div>
                <button className="btn-primary w-full justify-center" onClick={confirm} disabled={busy}>Confirm order</button>
              </div>
            )}
          </Panel>
        </div>
      </div>

      <Modal open={!!commentLine} onClose={() => setCommentLine(null)} title="Note for your sales partner">
        <div className="space-y-3">
          <textarea className="input" rows={3} value={commentText} onChange={(e) => setCommentText(e.target.value)} placeholder="e.g. We need this before month-end and may bulk up the order." />
          <button className="btn-primary w-full justify-center" onClick={sendComment} disabled={busy}>Send note</button>
        </div>
      </Modal>
    </div>
  );
}