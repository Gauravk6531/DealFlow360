import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import api, { errMsg } from "../services/api";
import { fmtINR } from "../utils/format";
import { Loader, PageHeader, StageBadge, RiskBadge, HealthBadge, Panel, Modal } from "../components/ui";
import { useToast } from "../store/ui";
import { deriveStage } from "./QuotesPage";
import { Star, Share2, Send, FlaskConical, Handshake, Truck, Receipt, BadgeCheck, AlertTriangle, RefreshCw, FileText, GitBranch } from "lucide-react";

export default function QuoteDetailPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const [d, setD] = useState(null);
  const [simOpen, setSimOpen] = useState(false);
  const [negOpen, setNegOpen] = useState(false);
  const [fulOpen, setFulOpen] = useState(false);
  const [billOpen, setBillOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try { setD(await fetchQuoteData(id)); } catch (e) { toast.push(errMsg(e), "error"); }
  };
  useEffect(() => { load(); }, [id]);

  if (!d) return <Loader label="Loading deal intelligence…" />;
  const { quote, risk, health, dealerComparison, approvals, negotiations, recommendations, settings } = d;
  const stage = deriveStage(quote);

  const submitForApproval = async () => {
    setBusy(true);
    try {
      const r = await api.post(`/quotes/${id}/submit`, {});
      toast.push(r.data.autoApproved ? "Auto-approved! Within autonomous limits." : `Routed to: ${(r.data.approvalChain || []).join(" → ")}`);
      await load();
    } catch (e) { toast.push(errMsg(e), "error"); }
    setBusy(false);
  };

  const applyRec = async (rec) => {
    setBusy(true);
    try {
      await api.post(`/quotes/${id}/add-line`, { productId: rec.product.id, quantity: 1, isSubscription: rec.product.subscriptionEligible && rec.product.category === "Subscription" });
      toast.push(`Added ${rec.product.name}`);
      await load();
    } catch (e) { toast.push(errMsg(e), "error"); }
    setBusy(false);
  };

  return (
    <div>
      <PageHeader
        title={<span className="font-mono">{quote.quoteNumber}</span>}
        subtitle={<><span className="font-semibold text-ink-900">{quote.customerId?.name}</span> · {quote.customerId?.customerTier} tier · by {quote.salesRepId?.name || "—"}</>}
        actions={
          <>
            <StageBadge stage={stage} />
            <RiskBadge level={quote.riskLevel} />
            <Link to="/builder" className="btn-secondary !py-1.5 text-xs">New Quote</Link>
          </>
        }
      />

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <Panel title="Line items" actions={<span className="text-xs text-ink-700/50">Version {quote.version}</span>}>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-ink-50">
                  <tr>
                    <th className="th">Product</th>
                    <th className="th">Qty</th>
                    <th className="th">List</th>
                    <th className="th">Unit</th>
                    <th className="th">Discount</th>
                    <th className="th">Line total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {quote.lines.map((l) => (
                    <tr key={l._id}>
                      <td className="td">
                        <div className="font-semibold text-ink-900">{l.productName}</div>
                        <div className="text-[11px] text-ink-700/40">{l.billingCycle ? `${l.billingCycle} subscription` : l.deliveryDays ? `${l.deliveryDays}d delivery` : "One-time"}</div>
                      </td>
                      <td className="td">{l.quantity}</td>
                      <td className="td text-ink-700/60">{fmtINR(l.listUnitPrice)}</td>
                      <td className="td font-semibold">{fmtINR(l.unitPrice)}</td>
                      <td className="td text-xs">{l.discountPct?.toFixed(1)}% <span className="text-ink-700/40">(-{fmtINR(l.discountAmount)})</span></td>
                      <td className="td font-bold">{fmtINR(l.unitPrice * l.quantity)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-col sm:flex-row justify-between gap-3 mt-4 pt-3 border-t border-ink-100">
              <div className="text-sm">
                <div className="flex gap-6 text-ink-700/60"><span>Subtotal</span><b className="text-ink-900">{fmtINR(quote.subtotal)}</b></div>
                <div className="flex gap-6 text-ink-700/60"><span>GST</span><b className="text-ink-900">{fmtINR(quote.tax)}</b></div>
                <div className="flex gap-6 text-ink-900 font-extrabold mt-1"><span>Total</span><span>{fmtINR(quote.total)}</span></div>
              </div>
              <div className="text-right text-sm space-y-1">
                <div className="text-ink-700/60">Effective discount <b className="text-ink-900">{quote.weightedDiscountPct?.toFixed(1)}%</b></div>
                <div className="text-ink-700/60">Estimated margin <b className={quote.marginPercentage >= 0 ? "text-profit" : "text-risk"}>{quote.marginPercentage?.toFixed(1)}%</b></div>
                <div className="text-ink-700/60">Estimated profit <b className="text-profit">{fmtINR(quote.estimatedMargin)}</b></div>
                {quote.customerSavings > 0 && <div className="badge bg-emerald-100 text-emerald-700">Customer saves {fmtINR(quote.customerSavings)}</div>}
              </div>
            </div>
          </Panel>

          <Panel title="Dealer comparison — multi-dealer scoring" actions={<span className="text-xs text-ink-700/50">scores blend price · dealer profit · company margin · delivery · inventory · reliability</span>}>
            {(dealerComparison?.perLine || []).map((line) => (
              <div key={line.productId} className="mb-4 last:mb-0">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-bold text-ink-900">{line.productName}</span>
                  <span className="text-xs text-ink-700/50">Qty {line.quantity} · target {fmtINR(line.unitPrice)}</span>
                  {line.recommendedDealerName && <span className="badge bg-brand-50 text-brand-700 ml-auto flex items-center gap-1"><Star size={11} /> Recommended: {line.recommendedDealerName}</span>}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-ink-50">
                      <tr>
                        <th className="th">Dealer</th>
                        <th className="th">Price</th>
                        <th className="th">Dealer profit</th>
                        <th className="th">Min floor</th>
                        <th className="th">Delivery</th>
                        <th className="th">Stock</th>
                        <th className="th">Reliability</th>
                        <th className="th">Score</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-ink-100">
                      {(line.dealers || []).map((dl) => (
                        <tr key={dl.dealerId} className={dl.dealerId === line.recommendedDealerId ? "bg-brand-50/50" : ""}>
                          <td className="td font-semibold text-ink-900">{dl.dealerName}</td>
                          <td className="td">{fmtINR(dl.price)}</td>
                          <td className="td text-profit">+{fmtINR(dl.dealerProfit)}</td>
                          <td className="td text-ink-700/60">{fmtINR(dl.minimumAcceptablePrice)}</td>
                          <td className="td">{dl.deliveryDays}d</td>
                          <td className="td">{dl.availableQuantity}</td>
                          <td className="td">{dl.reliabilityScore}%</td>
                          <td className="td"><b className={dl.dealerId === line.recommendedDealerId ? "text-brand-700" : ""}>{dl.score}</b></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </Panel>

          <Panel title="Deal intelligence & recommendations">
            <div className="grid sm:grid-cols-2 gap-3">
              {(recommendations || []).map((r) => (
                <div key={r.product.id} className="border border-brand-100 bg-brand-50/40 rounded-xl p-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-bold text-ink-900">{r.product.name}</div>
                    <button onClick={() => applyRec(r)} className="text-xs px-2 py-1 rounded-lg bg-brand-600 text-white hover:bg-brand-700">Add</button>
                  </div>
                  <div className="text-xs text-ink-700/60 mt-1">{r.product.category} · {r.matchReason}</div>
                  <div className="flex justify-between text-xs mt-2">
                    <span>{fmtINR(r.lineTotal)}</span>
                    <span className="font-bold text-profit">+{fmtINR(r.marginDelta)} margin</span>
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Approval chain" actions={<HealthBadge status={quote.approvalStatus === "Pending" ? "At Risk" : quote.approvalStatus} />}>
            {(approvals || []).length === 0 ? <div className="text-sm text-ink-700/50">No approval requests yet.{quote.submittedAt ? "" : " Submit for approval to trigger routing."}</div> : (
              <div className="flex flex-wrap items-center gap-2">
                {(approvals || []).map((a, i) => (
                  <div key={a._id} className="flex items-center gap-2">
                    <div className={`border rounded-lg px-3 py-2 text-sm ${a.status === "Approved" ? "border-emerald-200 bg-emerald-50" : a.status === "Pending" ? "border-amber-200 bg-amber-50" : "border-ink-100 bg-ink-50 text-ink-700/40"}`}>
                      <div className="font-semibold">{a.approverRole.replace("_", " ")}</div>
                      <div className={`text-xs ${a.status === "Approved" ? "text-emerald-700" : a.status === "Pending" ? "text-amber-700" : "text-ink-700/40"}`}>{a.status}</div>
                    </div>
                    {i < (approvals || []).length - 1 && <span className="text-ink-700/30">→</span>}
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel title="Negotiation rounds">
            {(negotiations || []).length === 0 ? <div className="text-sm text-ink-700/50">No negotiations yet. Customer can request a better price from the portal, or you can open the negotiation panel.</div> : (
              <div className="space-y-3">
                {(negotiations || []).map((n) => (
                  <div key={n._id} className="border border-ink-100 rounded-lg p-4 text-sm">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-ink-900">Round {n.negotiationRound}</span>
                      <span className={`badge ${n.status === "Accepted" || n.status === "Approved" ? "bg-emerald-100 text-emerald-700" : n.status === "Counter Offered" ? "bg-amber-100 text-amber-700" : n.status === "Escalated" ? "bg-red-100 text-red-700" : "bg-ink-100 text-ink-700"}`}>{n.status}</span>
                      <span className="text-xs text-ink-700/50">by {n.requestedBy}</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
                      <div className="bg-ink-50 rounded-lg p-2"><div className="text-[10px] uppercase font-bold text-ink-700/40">Original</div><b>{fmtINR(n.originalPrice)}</b></div>
                      <div className="bg-ink-50 rounded-lg p-2"><div className="text-[10px] uppercase font-bold text-ink-700/40">Requested</div><b>{fmtINR(n.customerRequestedPrice)}</b></div>
                      <div className="bg-ink-50 rounded-lg p-2"><div className="text-[10px] uppercase font-bold text-ink-700/40">Proposed</div><b className="text-emerald-700">{fmtINR(n.proposedPrice)}</b></div>
                      <div className="bg-ink-50 rounded-lg p-2"><div className="text-[10px] uppercase font-bold text-ink-700/40">Decision</div><b>{n.decision}</b></div>
                    </div>
                    {n.concessions?.length > 0 && <div className="mt-2 text-xs flex flex-wrap gap-1">{n.concessions.map((c) => <span key={c} className="badge bg-emerald-100 text-emerald-700">{c}</span>)}</div>}
                    {n.recommendation && <div className="mt-2 text-xs text-ink-700/60">💡 {n.recommendation}</div>}
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>

        <div className="space-y-5">
          <Panel title="Actions">
            <div className="space-y-2">
              {!quote.submittedAt && <button className="btn-primary w-full justify-center" onClick={submitForApproval} disabled={busy}><Send size={15} /> Submit for approval</button>}
              <button className="btn-secondary w-full justify-center" onClick={() => setNegOpen(true)}><Handshake size={15} /> Negotiate price</button>
              <button className="btn-secondary w-full justify-center" onClick={() => setSimOpen(true)}><FlaskConical size={15} /> What-If simulator</button>
              <button className="btn-secondary w-full justify-center" onClick={() => setFulOpen(true)} disabled={!quote.wonAt && stage !== "Won" && stage !== "Fulfillment"}><Truck size={15} /> Plan fulfillment</button>
              <button className="btn-secondary w-full justify-center" onClick={() => setBillOpen(true)} disabled={!quote.wonAt && stage !== "Won" && stage !== "Fulfillment"}><Receipt size={15} /> Billing preview</button>
            </div>
            <div className="mt-4 text-xs text-ink-700/50">
              <div className="font-bold text-ink-700/60 mb-1 flex items-center gap-1"><GitBranch size={12} /> Approval policy</div>
              ≤ {settings?.approvalThresholds?.autoMax ?? 20} risk → auto · ≤ {settings?.approvalThresholds?.managerMax ?? 50} → manager · above → manager + finance
            </div>
          </Panel>

          <Panel title="Risk analysis">
            <div className="text-center py-2">
              <div className={`text-3xl font-extrabold ${quote.riskScore > 50 ? "text-risk" : quote.riskScore > 20 ? "text-warn" : "text-profit"}`}>{risk?.riskScore?.toFixed(1) ?? quote.riskScore}</div>
              <div className="text-xs text-ink-700/50 mt-1">risk score out of 100</div>
            </div>
            <div className="h-2 rounded-full bg-ink-100 overflow-hidden mt-2">
              <div className={`h-full ${quote.riskScore > 50 ? "bg-risk" : quote.riskScore > 20 ? "bg-warn" : "bg-profit"}`} style={{ width: `${Math.min(100, quote.riskScore)}%` }} />
            </div>
            <ul className="mt-3 space-y-1 text-xs">
              {(quote.riskReasons || risk?.reasons || []).slice(0, 5).map((r, i) => (
                <li key={i} className="flex items-start gap-1.5 text-ink-700/70"><AlertTriangle size={12} className="shrink-0 mt-0.5 text-warn" /> {r}</li>
              ))}
            </ul>
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-ink-100 text-xs">
              <span className="text-ink-700/50">Deal health</span>
              <HealthBadge status={health?.dealHealthStatus ?? quote.dealHealthStatus} />
            </div>
            <div className="flex items-center justify-between mt-1 text-xs">
              <span className="text-ink-700/50">Health score</span>
              <b>{health?.dealHealthScore ?? quote.dealHealthScore}</b>
            </div>
          </Panel>

          <Panel title="Timeline">
            <div className="space-y-2 text-xs">
              {[
                ["Created", quote.createdAt],
                ["Submitted", quote.submittedAt],
                ["Confirmed", quote.confirmedAt],
                ["Won", quote.wonAt],
                ["Lost", quote.lostAt],
                ["Expires", quote.expiresAt],
              ].filter(([, v]) => v).map(([label, date]) => (
                <div key={label} className="flex justify-between text-ink-700/70">
                  <span>{label}</span><span>{new Date(date).toLocaleString()}</span>
                </div>
              ))}
            </div>
            {quote.notes && (
              <div className="mt-3 pt-3 border-t border-ink-100 text-xs text-ink-700/70 whitespace-pre-wrap">
                <div className="font-bold text-ink-700/60 mb-1 flex items-center gap-1"><FileText size={12} /> Notes</div>
                {quote.notes}
              </div>
            )}
          </Panel>
        </div>
      </div>

      <WhatIfModal open={simOpen} onClose={() => setSimOpen(false)} quoteId={id} toast={toast} />
      <NegotiateModal open={negOpen} onClose={() => setNegOpen(false)} quoteId={id} toast={toast} onDone={load} />
      <FulfillmentModal open={fulOpen} onClose={() => setFulOpen(false)} quoteId={id} quote={quote} toast={toast} />
      <BillingModal open={billOpen} onClose={() => setBillOpen(false)} quoteId={id} quote={quote} toast={toast} />
    </div>
  );
}

async function fetchQuoteData(id) {
  const { data } = await api.get(`/quotes/${id}`);
  return data;
}

// ---------- What-If ----------
function WhatIfModal({ open, onClose, quoteId, toast }) {
  const [discountPct, setDiscountPct] = useState("");
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    try {
      const { data } = await api.post(`/quotes/${quoteId}/what-if`, { discountPct: Number(discountPct) });
      setResult(data);
    } catch (e) { toast.push(errMsg(e), "error"); }
    setBusy(false);
  };

  return (
    <Modal open={open} onClose={() => { setResult(null); onClose(); }} title="What-If simulator" wide>
      <div className="mb-4">
        <label className="label">Apply a uniform discount % to all lines</label>
        <div className="flex gap-2">
          <input className="input max-w-[180px]" type="number" min={0} max={100} value={discountPct} onChange={(e) => setDiscountPct(e.target.value)} placeholder="e.g. 20" />
          <button className="btn-primary" onClick={run} disabled={busy}><FlaskConical size={15} /> Simulate</button>
        </div>
      </div>

      {result && (
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="border border-ink-100 rounded-xl p-4">
            <div className="text-xs font-bold uppercase text-ink-700/50 mb-3">Current</div>
            <Row label="Total" value={fmtINR(result.current.total)} />
            <Row label="Margin" value={`${result.current.margin?.toFixed?.(1)}%`} />
            <Row label="Discount" value={`${result.current.discount?.toFixed?.(1)}%`} />
            <Row label="Risk" value={result.current.riskScore?.toFixed?.(1)} accent={result.current.riskScore > 50 ? "text-risk" : "text-warn"} />
            <Row label="Approval" value={result.current.approvalChain?.join(" → ") || "Auto"} />
          </div>
          <div className="border border-brand-200 bg-brand-50/40 rounded-xl p-4">
            <div className="text-xs font-bold uppercase text-brand-700 mb-3">Simulated</div>
            <Row label="Total" value={fmtINR(result.simulation.total)} />
            <Row label="Margin" value={`${result.simulation.margin?.toFixed?.(1)}%`} />
            <Row label="Discount" value={`${result.simulation.discount?.toFixed?.(1)}%`} />
            <Row label="Risk" value={`${result.simulation.riskScore?.toFixed?.(1)} (${result.simulation.riskLevel})`} accent={result.simulation.riskScore > 50 ? "text-risk" : "text-warn"} />
            <Row label="Approval" value={result.simulation.approvalChain?.join(" → ") || "Auto"} />
            <div className="mt-2 pt-2 border-t border-brand-100 text-xs text-brand-700">Δ risk <b>{(result.simulation.riskDelta || 0) >= 0 ? "+" : ""}{result.simulation.riskDelta?.toFixed?.(1)}</b> · Δ margin <b>{result.simulation.marginDelta?.toFixed?.(1)}pp</b></div>
          </div>
          {result.recommendation && (
            <div className="sm:col-span-2 bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-900">
              <b>💡 Engine guidance:</b> {result.recommendation}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

function Row({ label, value, accent }) {
  return <div className="flex justify-between text-sm py-1"><span className="text-ink-700/60">{label}</span><b className={accent}>{value}</b></div>;
}

// ---------- Negotiate ----------
function NegotiateModal({ open, onClose, quoteId, toast, onDone }) {
  const [requested, setRequested] = useState("");
  const [discountPct, setDiscountPct] = useState("");
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    try {
      const body = discountPct !== "" ? { discountPct: Number(discountPct), requestedBy: "SalesRep" } : { requestedPrice: Number(requested), requestedBy: "SalesRep" };
      const { data } = await api.post(`/quotes/${quoteId}/negotiate`, body);
      setResult(data.result || data.negotiation);
      await onDone();
    } catch (e) { toast.push(errMsg(e), "error"); }
    setBusy(false);
  };

  return (
    <Modal open={open} onClose={() => { setResult(null); onClose(); }} title="Profit-aware negotiation engine" wide>
      <div className="mb-4">
        <label className="label">Target total (pre-tax subtotal) — the engine finds the best mutually profitable dealer</label>
        <div className="flex gap-2 items-center">
          <input className="input max-w-[180px]" type="number" min={0} value={requested} onChange={(e) => setRequested(e.target.value)} placeholder="e.g. 900000" />
          <span className="text-xs text-ink-700/50 font-semibold uppercase">or discount %</span>
          <input className="input max-w-[120px]" type="number" min={0} max={100} value={discountPct} onChange={(e) => setDiscountPct(e.target.value)} placeholder="e.g. 10" />
          <button className="btn-primary" onClick={run} disabled={busy}><Handshake size={15} /> Negotiate</button>
        </div>
      </div>

      {result && (
        <div>
          <div className="flex items-center gap-3 flex-wrap mb-4">
            <span className={`badge ${result.decision === "AUTO_ACCEPT" ? "bg-emerald-100 text-emerald-700" : result.decision === "COUNTER_OFFER" ? "bg-amber-100 text-amber-700" : result.decision === "ESCALATE" ? "bg-red-100 text-red-700" : "bg-ink-100 text-ink-700"}`}>{result.decision}</span>
            <span className="text-sm text-ink-700/70">{result.reason}</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <Metric label="Original" value={fmtINR(result.originalPrice)} />
            <Metric label="Requested" value={fmtINR(result.customerRequestedPrice)} />
            <Metric label="Proposed" value={fmtINR(result.proposedPrice)} accent="text-emerald-700" />
            <Metric label="Customer savings" value={fmtINR(result.customerSavings)} accent="text-emerald-700" />
          </div>
          {result.concessions?.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-1.5">
              <span className="text-xs text-ink-700/50">Value-adds:</span>
              {result.concessions.map((c) => <span key={c} className="badge bg-emerald-100 text-emerald-700">{c}</span>)}
            </div>
          )}
          <div className="grid grid-cols-3 gap-3 text-center bg-ink-50 rounded-xl p-3 mb-3">
            <div><div className="text-[10px] uppercase font-bold text-ink-700/40">Dealer profit</div><b className="text-profit">{fmtINR(result.dealerProfit)}</b></div>
            <div><div className="text-[10px] uppercase font-bold text-ink-700/40">Company profit</div><b className="text-profit">{fmtINR(result.companyProfit)}</b></div>
            <div><div className="text-[10px] uppercase font-bold text-ink-700/40">Dealer</div><b className="text-sm">{result.dealerName || "—"}</b></div>
          </div>
          {result.recommendation && <div className="text-sm text-ink-700/70">💡 {result.recommendation}</div>}
        </div>
      )}
    </Modal>
  );
}

function Metric({ label, value, accent }) {
  return (
    <div className="bg-ink-50 rounded-xl p-3 text-center">
      <div className="text-[10px] uppercase font-bold text-ink-700/40">{label}</div>
      <div className={`font-extrabold ${accent || "text-ink-900"}`}>{value}</div>
    </div>
  );
}

// ---------- Fulfillment ----------
function FulfillmentModal({ open, onClose, quoteId, quote, toast }) {
  const [plan, setPlan] = useState(null);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    try {
      const { data } = await api.post(`/quotes/${quoteId}/fulfillment`, {});
      setPlan(data.plan);
    } catch (e) { toast.push(errMsg(e), "error"); }
    setBusy(false);
  };
  useEffect(() => { if (open) run(); }, [open]);

  return (
    <Modal open={open} onClose={onClose} title="Warehouse fulfillment planner" wide>
      {!plan ? <Loader label="Planning shipments…" /> : (
        <div>
          <div className="flex gap-3 mb-4">
            <div className="bg-ink-50 rounded-xl px-4 py-2 text-center"><div className="text-lg font-extrabold text-ink-900">{plan.shipments}</div><div className="text-[10px] uppercase font-bold text-ink-700/40">Shipments</div></div>
            <div className="bg-ink-50 rounded-xl px-4 py-2 text-center"><div className="text-lg font-extrabold text-ink-900">{plan.backorders}</div><div className="text-[10px] uppercase font-bold text-ink-700/40">Backorder</div></div>
            <div className="bg-ink-50 rounded-xl px-4 py-2 text-center"><div className="text-lg font-extrabold text-ink-900">{fmtINR(plan.totalShippingCost)}</div><div className="text-[10px] uppercase font-bold text-ink-700/40">Shipping cost</div></div>
            <div className="bg-ink-50 rounded-xl px-4 py-2 text-center"><div className="text-lg font-extrabold text-ink-900">{plan.status}</div><div className="text-[10px] uppercase font-bold text-ink-700/40">Status</div></div>
          </div>
          {(plan.lines || []).map((l) => (
            <div key={l.productId} className="border border-ink-100 rounded-lg p-4 mb-3">
              <div className="flex justify-between text-sm font-bold text-ink-900 mb-2"><span>{l.productName}</span><span>Qty {l.quantity}</span></div>
              {(l.allocated || []).map((a, i) => (
                <div key={i} className="flex justify-between text-sm text-ink-700/70 py-0.5">
                  <span>{a.warehouseName} <span className="text-ink-700/40">· {a.location}</span></span>
                  <b className="text-ink-900">{a.quantity}</b>
                </div>
              ))}
              {l.backorder > 0 && <div className="text-sm text-warn font-semibold mt-1">⚠ {l.backorder} on backorder · ETA ≈ {l.deliveryEstimateDays}d</div>}
              {l.fullyAllocated && <div className="text-xs text-emerald-700 font-semibold mt-1">✓ Fully allocated</div>}
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

// ---------- Billing ----------
function BillingModal({ open, onClose, quoteId, quote, toast }) {
  const [bill, setBill] = useState(null);
  useEffect(() => {
    if (open) api.get(`/quotes/${quoteId}/billing`).then((r) => setBill(r.data.billing)).catch((e) => toast.push(errMsg(e), "error"));
  }, [open]);

  return (
    <Modal open={open} onClose={onClose} title="Hybrid billing preview" wide>
      {!bill ? <Loader label="Generating invoice…" /> : (
        <div>
          <div className="flex gap-3 mb-4">
            <div className="bg-ink-50 rounded-xl px-4 py-2 text-center"><div className="text-lg font-extrabold text-ink-900">{bill.billingType}</div><div className="text-[10px] uppercase font-bold text-ink-700/40">Billing type</div></div>
            <div className="bg-ink-50 rounded-xl px-4 py-2 text-center"><div className="text-lg font-extrabold text-ink-900">{fmtINR(bill.oneTimeInvoice?.subtotal)}</div><div className="text-[10px] uppercase font-bold text-ink-700/40">One-time subtotal</div></div>
            <div className="bg-ink-50 rounded-xl px-4 py-2 text-center"><div className="text-lg font-extrabold text-ink-900">{fmtINR(bill.recurringMonthlyEquivalent)}</div><div className="text-[10px] uppercase font-bold text-ink-700/40">Monthly equivalent</div></div>
            <div className="bg-ink-50 rounded-xl px-4 py-2 text-center"><div className="text-lg font-extrabold text-brand-700">{bill.oneTimeInvoice?.invoiceNumber}</div><div className="text-[10px] uppercase font-bold text-ink-700/40">Invoice</div></div>
          </div>
          <div className="text-sm font-bold text-ink-900 mb-2">One-time invoice items</div>
          {(bill.oneTimeInvoice?.items || []).map((l) => (
            <div key={l.productId} className="flex justify-between text-sm py-1 border-b border-ink-100/60"><span>{l.productName} × {l.quantity}</span><b>{fmtINR(l.lineTotal)}</b></div>
          ))}
          {bill.recurring?.length > 0 && (
            <>
              <div className="text-sm font-bold text-ink-900 my-2 mt-4">Recurring schedule</div>
              {(bill.recurring || []).map((s) => (
                <div key={s.productName} className="border border-ink-100 rounded-lg p-3 mb-2">
                  <div className="flex justify-between text-sm"><span className="font-semibold">{s.productName}</span><span className="text-brand-700 font-bold">{fmtINR(s.periodPrice)} / {s.billingCycle}</span></div>
                  <div className="text-xs text-ink-700/50 my-1">{s.prorationRule} · {s.cancellationRule}</div>
                  <div className="flex gap-1 flex-wrap">
                    {s.periods.slice(0, 4).map((p) => <span key={p.period} className="badge bg-ink-50 text-ink-700/70">{p.dueDate} · {fmtINR(p.amount)}</span>)}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </Modal>
  );
}