import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api, { errMsg } from "../services/api";
import { fmtINR } from "../utils/format";
import { Loader, PageHeader, Panel } from "../components/ui";
import { useToast } from "../store/ui";
import { FlaskConical } from "lucide-react";

function Row({ label, value, accent }) {
  return <div className="flex justify-between text-sm py-1"><span className="text-ink-700/60">{label}</span><b className={accent}>{value}</b></div>;
}

export default function WhatIfPage() {
  const toast = useToast();
  const [quotes, setQuotes] = useState(null);
  const [quoteId, setQuoteId] = useState("");
  const [discountPct, setDiscountPct] = useState("");
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { api.get("/quotes").then((r) => setQuotes(r.data.quotes)).catch(() => setQuotes([])); }, []);

  const run = async () => {
    setBusy(true);
    try {
      const { data } = await api.post(`/quotes/${quoteId}/what-if`, { discountPct: Number(discountPct) });
      setResult(data);
    } catch (e) { toast.push(errMsg(e), "error"); }
    setBusy(false);
  };

  if (!quotes) return <Loader />;

  return (
    <div>
      <PageHeader title="What-If Simulator" subtitle="Zero-risk sandbox — apply discounts, see exact margin, risk and approval-chain impact before touching a live quote." />

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="space-y-4">
          <Panel title="Scenario">
            <label className="label">Quote</label>
            <select className="input mb-3" value={quoteId} onChange={(e) => { setQuoteId(e.target.value); setResult(null); }}>
              <option value="">Select a quote…</option>
              {quotes.filter((q) => q.lines.length > 0).map((q) => <option key={q._id} value={q._id}>{q.quoteNumber} — {q.customerId?.name}</option>)}
            </select>
            <label className="label">Uniform discount %</label>
            <input className="input" type="number" min={0} max={100} value={discountPct} onChange={(e) => setDiscountPct(e.target.value)} placeholder="e.g. 20" />
            <button className="btn-primary w-full justify-center mt-4" onClick={run} disabled={busy || !quoteId}>
              <FlaskConical size={15} /> Run simulation
            </button>
            <div className="text-xs text-ink-700/50 mt-3">Tip: open any quote detail page for a contextual simulator with upsell-rec flow.</div>
          </Panel>
        </div>

        <div className="lg:col-span-2">
          {!result && <div className="card p-12 text-center text-sm text-ink-700/50">Pick a quote, dial in a discount and simulate. Nothing is persisted — the engine recomputes margin, risk and approval routing in a sandboxed clone.</div>}
          {result && (
            <div className="grid sm:grid-cols-2 gap-5">
              <div className="card p-5">
                <div className="text-xs font-bold uppercase text-ink-700/50 mb-3">Current</div>
                <Row label="Total" value={fmtINR(result.current.total)} />
                <Row label="Margin" value={`${result.current.margin?.toFixed?.(1)}%`} />
                <Row label="Discount" value={`${result.current.discount?.toFixed?.(1)}%`} />
                <Row label="Risk" value={result.current.riskScore?.toFixed?.(1)} accent={result.current.riskScore > 50 ? "text-risk" : "text-warn"} />
                <Row label="Approval" value={result.current.approvalChain?.join(" → ") || "Auto"} />
              </div>
              <div className="card p-5 border-brand-200 bg-brand-50/40">
                <div className="text-xs font-bold uppercase text-brand-700 mb-3">Simulated</div>
                <Row label="Total" value={fmtINR(result.simulation.total)} />
                <Row label="Margin" value={`${result.simulation.margin?.toFixed?.(1)}%`} />
                <Row label="Discount" value={`${result.simulation.discount?.toFixed?.(1)}%`} />
                <Row label="Risk" value={`${result.simulation.riskScore?.toFixed?.(1)} (${result.simulation.riskLevel})`} accent={result.simulation.riskScore > 50 ? "text-risk" : "text-warn"} />
                <Row label="Approval" value={result.simulation.approvalChain?.join(" → ") || "Auto"} />
                <div className="mt-2 pt-2 border-t border-brand-100 text-xs text-brand-700">
                  Δ risk <b>{result.simulation.riskDelta >= 0 ? "+" : ""}{result.simulation.riskDelta?.toFixed?.(1)}</b> · Δ margin <b>{result.simulation.marginDelta?.toFixed?.(1)}pp</b>
                </div>
              </div>
              {result.recommendation && (
                <div className="sm:col-span-2 bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-900">
                  <b>💡 Engine guidance:</b> {result.recommendation}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}