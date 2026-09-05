import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api, { errMsg } from "../services/api";
import { fmtINR, fetchQuote } from "../utils/format";
import { Loader, PageHeader, RiskBadge } from "../components/ui";
import { useToast } from "../store/ui";
import { Plus, Trash2, Minus, Sparkles, Zap, Send, ChevronRight } from "lucide-react";

export default function QuoteBuilderPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [customerId, setCustomerId] = useState("");
  const [cart, setCart] = useState([]); // {productId, name, price, category, subscriptionEligible, qty, discountPct, dealerId}
  const [recs, setRecs] = useState([]);
  const [busy, setBusy] = useState(false);
  const [loadQ, setLoadQ] = useState(null);

  useEffect(() => {
    api.get("/admin/customers").then((r) => setCustomers(r.data.customers)).catch(() => {});
    api.get("/admin/products").then((r) => {
      setProducts(r.data.products.filter((p) => p.active));
    }).catch(() => {});
    if (id) fetchQuote(id).then((d) => {
      setLoadQ(d.quote);
      setCustomerId(String(d.quote.customerId?._id));
      setCart(d.quote.lines.map((l) => ({
        productId: String(l.productId),
        name: l.productName,
        price: l.listUnitPrice || l.unitPrice,
        category: l.isSubscription ? "Subscription" : "Hardware",
        subscriptionEligible: !!l.isSubscription,
        qty: l.quantity,
        discountPct: Math.round(((l.listUnitPrice - l.unitPrice) / l.listUnitPrice) * 100) || 0,
        dealerId: l.dealerId ? String(l.dealerId) : null,
        _id: l._id,
      })));
    }).catch((e) => toast.push(errMsg(e), "error"));
  }, [id]);

  if (!products || !customers) return <Loader />;

  const addToCart = (p) => {
    const existing = cart.find((c) => c.productId === String(p._id));
    if (existing) {
      setCart(cart.map((c) => c.productId === String(p._id) ? { ...c, qty: c.qty + 1 } : c));
    } else {
      setCart([...cart, { productId: String(p._id), name: p.name, price: p.basePrice, category: p.category, subscriptionEligible: !!p.subscriptionEligible, qty: 1, discountPct: 0, dealerId: null }]);
    }
  };

  const updateQty = (pid, idx, delta) => {
    setCart(cart.map((c, i) => i === idx ? { ...c, qty: Math.max(1, (c.qty || 1) + delta) } : c));
  };

  const updateDiscount = (idx, val) => {
    setCart(cart.map((c, i) => i === idx ? { ...c, discountPct: Math.max(0, Math.min(100, Number(val) || 0)) } : c));
  };

  const remove = (idx) => setCart(cart.filter((_, i) => i !== idx));

  const refreshRecs = async () => {
    const base = cart[0];
    if (!base) { setRecs([]); return; }
    try {
      // recommendation service endpoint-free on server; approximate upsells from product catalog
      const cands = products.filter((p) => String(p._id) !== base.productId && p.active);
      const order = ["Services", "Accessories", "Subscription", "Software"];
      const sorted = cands.sort((a, b) => order.indexOf(a.category) - order.indexOf(b.category)).slice(0, 4);
      setRecs(sorted.map((p) => ({ product: { id: String(p._id), name: p.name, category: p.category, basePrice: p.basePrice }, lineTotal: p.basePrice * base.qty, marginDelta: Math.round(p.basePrice * base.qty * 0.3) })));
    } catch { setRecs([]); }
  };

  const submit = async () => {
    if (!customerId) return toast.push("Select a customer first", "error");
    if (cart.length === 0) return toast.push("Add at least one product", "error");
    setBusy(true);
    try {
      const lines = cart.map((c) => ({ productId: c.productId, quantity: c.qty, discountPct: c.discountPct, dealerId: c.dealerId || undefined, isSubscription: c.subscriptionEligible && c.category === "Subscription" }));
      if (loadQ) {
        await api.put(`/quotes/${loadQ._id}`, { lines: cart.map((c) => ({ _id: c._id, quantity: c.qty, discountPct: c.discountPct, dealerId: c.dealerId || null })) });
        toast.push("Quote updated");
        nav(`/quotes/${loadQ._id}`);
      } else {
        const r = await api.post("/quotes", { customerId, lines });
        toast.push(`Quote ${r.data.quote.quoteNumber} created`);
        nav(`/quotes/${r.data.quote._id}`);
      }
    } catch (e) { toast.push(errMsg(e), "error"); }
    setBusy(false);
  };

  const subtotal = cart.reduce((s, c) => s + (c.price * (1 - (c.discountPct || 0) / 100)) * c.qty, 0);
  const listTotal = cart.reduce((s, c) => s + c.price * c.qty, 0);
  const discountAmt = listTotal - subtotal;
  const tax = subtotal * 0.18;

  return (
    <div>
      <PageHeader title={loadQ ? `Editing ${loadQ.quoteNumber}` : "Quote Builder"} subtitle="Build a profitable quote — the Deal Intelligence engine managers margin, dealer fit and risk automatically." />

      <div className="mb-4 max-w-sm">
        <label className="label">Customer</label>
        <select className="input" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
          <option value="">Select customer…</option>
          {customers.map((c) => <option key={c._id} value={c._id}>{c.name} ({c.customerTier})</option>)}
        </select>
      </div>

      <div className="grid lg:grid-cols-5 gap-5">
        <div className="lg:col-span-2 card">
          <div className="px-5 py-3 border-b border-ink-100 font-bold text-ink-900 flex items-center gap-2"><Zap size={15} className="text-brand-600" /> Product catalog</div>
          <div className="p-3 grid grid-cols-1 gap-2 max-h-[70vh] overflow-y-auto">
            {products.map((p) => (
              <div key={p._id} className="flex items-center gap-3 border border-ink-100 rounded-lg p-3 hover:border-brand-300 transition">
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm text-ink-900 truncate">{p.name}</div>
                  <div className="text-xs text-ink-700/50">{p.category} · {fmtINR(p.basePrice)} {p.subscriptionEligible ? "· subscription eligible" : ""}</div>
                </div>
                <button className="btn-secondary !px-2.5 !py-1.5 text-xs" onClick={() => addToCart(p)}><Plus size={13} /></button>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-2 card">
          <div className="px-5 py-3 border-b border-ink-100 font-bold text-ink-900">Cart — {cart.length} line{cart.length !== 1 ? "s" : ""}</div>
          <div className="p-4">
            {cart.length === 0 && <div className="text-sm text-ink-700/50 py-8 text-center">Add products from the catalog to build the quote.</div>}
            <div className="space-y-3">
              {cart.map((c, i) => {
                const unit = c.price * (1 - (c.discountPct || 0) / 100);
                return (
                  <div key={i} className="border border-ink-100 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-semibold text-ink-900">{c.name}</div>
                      <button onClick={() => remove(i)} className="text-ink-700/40 hover:text-risk"><Trash2 size={14} /></button>
                    </div>
                    <div className="grid grid-cols-3 gap-2 mt-2 items-center">
                      <div>
                        <label className="text-[10px] uppercase font-bold text-ink-700/40">Qty</label>
                        <div className="flex items-center gap-1">
                          <button className="btn-secondary !px-1.5 !py-0.5" onClick={() => updateQty(c.productId, i, -1)}><Minus size={12} /></button>
                          <span className="w-6 text-center text-sm font-bold">{c.qty}</span>
                          <button className="btn-secondary !px-1.5 !py-0.5" onClick={() => updateQty(c.productId, i, 1)}><Plus size={12} /></button>
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] uppercase font-bold text-ink-700/40">Discount %</label>
                        <input className="input !py-1 text-center" type="number" min={0} max={100} value={c.discountPct} onChange={(e) => updateDiscount(i, e.target.value)} />
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-ink-700/50">Unit</div>
                        <div className="font-bold text-sm">{fmtINR(unit)}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 border-t border-ink-100 pt-3 space-y-1 text-sm">
              <div className="flex justify-between text-ink-700/60"><span>List total</span><span>{fmtINR(listTotal)}</span></div>
              <div className="flex justify-between text-ink-700/60"><span>Discount</span><span className="text-emerald-700">-{fmtINR(discountAmt)}</span></div>
              <div className="flex justify-between text-ink-700/60"><span>Subtotal</span><span>{fmtINR(subtotal)}</span></div>
              <div className="flex justify-between text-ink-700/60"><span>GST (18%)</span><span>{fmtINR(tax)}</span></div>
              <div className="flex justify-between font-extrabold text-ink-900 pt-1 border-t border-ink-100"><span>Total</span><span>{fmtINR(subtotal + tax)}</span></div>
            </div>

            <button className="btn-primary w-full justify-center mt-4" onClick={submit} disabled={busy}>
              <Send size={15} /> {loadQ ? "Save changes" : "Create quote"} <ChevronRight size={15} />
            </button>
          </div>
        </div>

        <div className="card bg-brand-50/40 border-brand-100">
          <div className="px-5 py-3 border-b border-brand-100 font-bold text-ink-900 flex items-center gap-2 text-brand-800"><Sparkles size={15} /> Deal Intelligence</div>
          <div className="p-4">
            <button className="btn-secondary w-full justify-center mb-3 text-xs" onClick={refreshRecs}>Refresh upsell ideas</button>
            {recs.length === 0 && <div className="text-xs text-ink-700/50">Add a product to see margin-boosting bundles.</div>}
            {recs.map((r) => (
              <div key={r.product.id} className="bg-white rounded-lg p-3 mb-2 border border-brand-100">
                <div className="text-sm font-semibold text-ink-900">{r.product.name}</div>
                <div className="text-xs text-ink-700/50">{r.product.category}</div>
                <div className="flex justify-between mt-1.5 text-xs">
                  <span className="text-ink-700/60">{fmtINR(r.lineTotal)}</span>
                  <span className="font-bold text-profit">+₹{r.marginDelta.toLocaleString("en-IN")} margin</span>
                </div>
              </div>
            ))}
            <div className="mt-3 text-center text-xs text-brand-700 font-semibold">The engine validates margin & risk at submit and wires approvals automatically.</div>
          </div>
        </div>
      </div>
    </div>
  );
}