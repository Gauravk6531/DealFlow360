import { useEffect, useState } from "react";
import api from "../services/api";
import { fmtINR } from "../utils/format";
import { Loader, PageHeader } from "../components/ui";
import { Star, Medal, Trophy } from "lucide-react";

export default function DealerComparisonPage() {
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get("/dashboard/dealer-intelligence").then((r) => setData(r.data)).catch(() => setData(null));
  }, []);

  if (!data) return <Loader />;

  return (
    <div>
      <PageHeader title="Dealer Intelligence" subtitle="Every dealer scored on price competitiveness, profitability, delivery, inventory and reliability — the engine never just picks the cheapest." />

      <div className="grid lg:grid-cols-2 gap-5 mb-6">
        <div className="card flex items-center gap-4 p-5">
          <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center"><Trophy size={22} /></div>
          <div>
            <div className="text-xs font-bold uppercase text-ink-700/50">Most competitive dealer</div>
            <div className="text-xl font-extrabold text-ink-900">{data.mostCompetitiveDealer?.name || "—"}</div>
            <div className="text-sm text-ink-700/50">avg unit {fmtINR(data.mostCompetitiveDealer?.avgPrice)} · reliability {data.mostCompetitiveDealer?.reliabilityScore}%</div>
          </div>
        </div>
        <div className="card flex items-center gap-4 p-5">
          <div className="w-12 h-12 rounded-2xl bg-brand-100 text-brand-700 flex items-center justify-center"><Medal size={22} /></div>
          <div>
            <div className="text-xs font-bold uppercase text-ink-700/50">Best recommended per product</div>
            <div className="flex flex-wrap gap-2 mt-1">
              {(data.bestPerProduct || []).slice(0, 4).map((b) => (
                <span key={b.product} className="badge bg-brand-50 text-brand-700">{b.product} → {b.recommendedDealer}</span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-ink-100 font-bold text-ink-900">Dealer scorecards</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-ink-50">
              <tr>
                <th className="th">Dealer</th>
                <th className="th">Rating</th>
                <th className="th">Reliability</th>
                <th className="th">Avg price</th>
                <th className="th">Avg delivery</th>
                <th className="th">Inventory</th>
                <th className="th">Offers</th>
                <th className="th">Deals</th>
                <th className="th">Win rate</th>
                <th className="th">Profit derived</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {(data.dealers || []).map((dl) => (
                <tr key={dl.id} className="hover:bg-ink-50/60">
                  <td className="td font-bold text-ink-900 flex items-center gap-1">{dl.name} {dl.id === data.mostCompetitiveDealer?.id && <Star size={12} className="text-amber-500" />}</td>
                  <td className="td">★ {dl.rating}</td>
                  <td className="td">{dl.reliabilityScore}%</td>
                  <td className="td">{fmtINR(dl.avgPrice)}</td>
                  <td className="td">{dl.avgDelivery}d</td>
                  <td className="td">{dl.totalInventory}</td>
                  <td className="td">{dl.activeOffers}</td>
                  <td className="td">{dl.dealsInvolved}</td>
                  <td className="td text-profit font-semibold">{dl.winRate}%</td>
                  <td className="td text-profit font-semibold">{fmtINR(dl.derivedProfit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card mt-5">
        <div className="px-5 py-3 border-b border-ink-100 font-bold text-ink-900">Recommended dealer per product (blended score)</div>
        <div className="grid sm:grid-cols-2 gap-3 p-5">
          {(data.bestPerProduct || []).map((b) => (
            <div key={b.product} className="border border-ink-100 rounded-xl p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-brand-50 text-brand-700 flex items-center justify-center font-bold">{b.score}</div>
              <div className="flex-1">
                <div className="text-sm font-bold text-ink-900">{b.product}</div>
                <div className="text-xs text-ink-700/50">{b.recommendedDealer} · {fmtINR(b.price)} · {b.deliveryDays}d · {b.reliability}% rel</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}