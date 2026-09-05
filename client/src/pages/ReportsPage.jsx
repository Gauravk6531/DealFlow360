import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";
import { fmtINR, fmtINRShort } from "../utils/format";
import { Loader, PageHeader } from "../components/ui";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

export default function ReportsPage() {
  const [data, setData] = useState(null);
  const [filters, setFilters] = useState({});

  const load = (f = {}) => {
    const qs = new URLSearchParams();
    Object.entries(f).forEach(([k, v]) => v && qs.set(k, v));
    api.get(`/reports?${qs.toString()}`).then((r) => setData(r.data.report)).catch(() => setData(null));
  };
  useEffect(() => { load(); }, []);

  if (!data) return <Loader />;

  const chart = Object.entries(data.byStage || {}).map(([name, count]) => ({ name, count }));
  const applyFilters = (e) => {
    e.preventDefault();
    load(filters);
  };

  return (
    <div>
      <PageHeader title="Reports & Analytics" subtitle="Win rates, margins, negotiation success and dealer performance — all from one auditable source." />

      <form onSubmit={applyFilters} className="card p-4 mb-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div><label className="label">From</label><input className="input" type="date" onChange={(e) => setFilters({ ...filters, startDate: e.target.value })} /></div>
        <div><label className="label">To</label><input className="input" type="date" onChange={(e) => setFilters({ ...filters, endDate: e.target.value })} /></div>
        <div><label className="label">Stage</label>
          <select className="input" onChange={(e) => setFilters({ ...filters, stage: e.target.value })}>
            <option value="">All</option>
            {["Draft", "Sent", "Negotiation", "Approval", "Approved", "Fulfillment", "Billing", "Won", "Lost"].map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div className="flex items-end"><button className="btn-secondary w-full" type="submit">Apply</button></div>
      </form>

      <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        {[
          ["Deals", data.filteredCount],
          ["Value", fmtINRShort(data.totalValue)],
          ["Avg margin", `${data.avgMarginPct}%`],
          ["Conversion", `${data.conversionRate}%`],
          ["Negotiation success", `${data.negotiationSuccess}%`],
        ].map(([label, val]) => (
          <div key={label} className="card p-4 text-center">
            <div className="text-2xl font-extrabold text-ink-900">{val}</div>
            <div className="text-xs font-bold uppercase text-ink-700/50 mt-1">{label}</div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <div className="card">
          <div className="px-5 py-3 border-b border-ink-100 font-bold text-ink-900">Deals by stage</div>
          <div className="p-4">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chart}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={28} />
                <Tooltip />
                <Bar dataKey="count" fill="#3563ff" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <div className="px-5 py-3 border-b border-ink-100 font-bold text-ink-900">Dealer performance</div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-ink-50">
                <tr><th className="th">Dealer</th><th className="th">Deals</th><th className="th">Won</th><th className="th">Win rate</th><th className="th">Reliability</th></tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {(data.dealerPerformance || []).map((d) => (
                  <tr key={d.dealer}>
                    <td className="td font-semibold">{d.dealer}</td>
                    <td className="td">{d.deals}</td>
                    <td className="td">{d.won}</td>
                    <td className="td">{d.winRate}%</td>
                    <td className="td">{d.reliability}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="card mt-5 overflow-hidden">
        <div className="px-5 py-3 border-b border-ink-100 font-bold text-ink-900">Deal ledger</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-ink-50">
              <tr>
                <th className="th">Quote</th><th className="th">Customer</th><th className="th">Rep</th><th className="th">Stage</th><th className="th">Total</th><th className="th">Margin</th><th className="th">Discount</th><th className="th">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {(data.rows || []).map((r) => (
                <tr key={r.id} className="hover:bg-ink-50/60">
                  <td className="td"><Link to={`/quotes/${r.id}`} className="font-mono text-brand-700 text-xs hover:underline">{r.quoteNumber}</Link></td>
                  <td className="td">{r.customer}</td>
                  <td className="td text-ink-700/70">{r.salesRep || "—"}</td>
                  <td className="td"><span className={`badge bg-ink-100 text-ink-700`}>{r.stage}</span></td>
                  <td className="td font-semibold">{fmtINR(r.total)}</td>
                  <td className="td text-profit">{r.marginPercentage?.toFixed?.(1)}%</td>
                  <td className="td">{r.weightedDiscountPct?.toFixed?.(1)}%</td>
                  <td className="td text-xs text-ink-700/50">{new Date(r.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}