import { useEffect, useState } from "react";
import api, { errMsg } from "../services/api";
import { fmtINR } from "../utils/format";
import { Loader, PageHeader, Modal } from "../components/ui";
import { useToast } from "../store/ui";
import { Pencil, Plus, Trash2, Save } from "lucide-react";

const TABS = [
  ["products", "Products"],
  ["customers", "Customers"],
  ["dealers", "Dealers"],
  ["offers", "Dealer Offers"],
  ["warehouses", "Warehouses"],
  ["settings", "Policies & Settings"],
];

const FIELDS = {
  products: [
    ["name", "Name", "text"], ["sku", "SKU", "text"], ["category", "Category", "select:Hardware,Software,Services,Subscription,Accessories"],
    ["basePrice", "Base price (₹)", "number"], ["costPrice", "Cost price (₹)", "number"], ["description", "Description", "text"], ["active", "Active", "bool"],
  ],
  customers: [
    ["name", "Name", "text"], ["email", "Email", "text"], ["company", "Company", "text"], ["customerTier", "Tier", "select:Bronze,Silver,Gold,Platinum"],
    ["creditLimit", "Credit limit (₹)", "number"], ["historicalAverageDiscount", "Historical disc %", "number"], ["active", "Active", "bool"],
  ],
  dealers: [
    ["name", "Name", "text"], ["email", "Email", "text"], ["contact", "Contact", "text"], ["rating", "Rating (0-5)", "number"],
    ["reliabilityScore", "Reliability (0-100)", "number"], ["minimumProfitMargin", "Min margin %", "number"], ["paymentTerms", "Payment terms", "text"], ["active", "Active", "bool"],
  ],
  offers: [
    ["dealerId", "Dealer", "ref:dealers"], ["productId", "Product", "ref:products"], ["sellingPrice", "Selling price (₹)", "number"],
    ["dealerCost", "Dealer cost (₹)", "number"], ["availableQuantity", "Available qty", "number"], ["minimumAcceptablePrice", "Min acceptable (₹)", "number"],
    ["deliveryDays", "Delivery days", "number"], ["shippingCost", "Shipping (₹)", "number"], ["active", "Active", "bool"],
  ],
  warehouses: [
    ["name", "Name", "text"], ["location", "Location", "text"], ["shippingCostWeight", "Shipping cost weight", "number"], ["priority", "Priority", "number"], ["active", "Active", "bool"],
  ],
};

export default function AdminPage({ tab }) {
  const toast = useToast();
  const [active, setActive] = useState(tab || "products");
  const [rows, setRows] = useState(null);
  const [refs, setRefs] = useState({ dealers: [], products: [], customers: [] });
  const [edit, setEdit] = useState(null);
  const [draft, setDraft] = useState({});
  const [busy, setBusy] = useState(false);

  const load = async (t = active) => {
    setRows(null);
    try {
      const { data } = await api.get(`/admin/${t}`);
      setRows(data[t] || []);
      if (t === "offers") {
        const [dl, pr] = await Promise.all([api.get("/admin/dealers"), api.get("/admin/products")]);
        setRefs({ ...refs, dealers: dl.data.dealers, products: pr.data.products });
      }
    } catch (e) { toast.push(errMsg(e), "error"); setRows([]); }
  };
  useEffect(() => {
    if (active === "settings") { loadSettings(); return; }
    setActive(tab || "products");
  }, [tab]);
  useEffect(() => { if (active !== "settings") load(active); }, [active]);

  const loadSettings = async () => {
    setRows(null);
    try {
      const { data } = await api.get("/admin/settings");
      setRows(data.settings);
    } catch (e) { toast.push(errMsg(e), "error"); }
  };

  // ---------- settings ----------
  if (active === "settings") {
    const s = rows;
    if (!s) return <Loader />;
    const num = (v) => (v === "" || v === null || v === undefined ? "" : Number(v));
    const setTier = (k, v) => setRows({ ...s, tierDiscountLimits: { ...s.tierDiscountLimits, [k]: num(v) } });
    const setCat = (k, v) => setRows({ ...s, categoryDiscountLimits: { ...s.categoryDiscountLimits, [k]: num(v) } });
    const setAppr = (k, v) => setRows({ ...s, approvalThresholds: { ...s.approvalThresholds, [k]: num(v) } });
    const saveSettings = async () => {
      setBusy(true);
      try {
        await api.put("/admin/settings", {
          tierDiscountLimits: s.tierDiscountLimits,
          categoryDiscountLimits: s.categoryDiscountLimits,
          approvalThresholds: s.approvalThresholds,
          minCompanyMarginPct: s.minCompanyMarginPct,
          dealerMinMarginPct: s.dealerMinMarginPct,
          negotiationBudget: s.negotiationBudget,
        });
        toast.push("Policies updated");
      } catch (e) { toast.push(errMsg(e), "error"); }
      setBusy(false);
    };

    const numInput = (v, fn) => <input className="input" type="number" value={v ?? ""} onChange={(e) => fn(e.target.value)} />;
    const grp = (title, arr) => (
      <div className="mb-5">
        <div className="text-sm font-bold text-ink-900 mb-2">{title}</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{arr}</div>
      </div>
    );

    return (
      <div>
        <PageHeader title="Policies & Settings" subtitle="These numbers govern auto-approval, risk scoring and the minimum-margin floors the negotiation engine respects." actions={<button className="btn-primary" onClick={saveSettings} disabled={busy}><Save size={15} /> Save policies</button>} />
        <AdminTabs active={active} setActive={(t) => setActive(t)} />
        <div className="card p-5">
          {grp("Tier discount ceilings (%)", [
            <div key="b"><label className="label">Bronze</label>{numInput(s.tierDiscountLimits?.Bronze ?? 5, (v) => setTier("Bronze", v))}</div>,
            <div key="si"><label className="label">Silver</label>{numInput(s.tierDiscountLimits?.Silver ?? 10, (v) => setTier("Silver", v))}</div>,
            <div key="g"><label className="label">Gold</label>{numInput(s.tierDiscountLimits?.Gold ?? 15, (v) => setTier("Gold", v))}</div>,
            <div key="p"><label className="label">Platinum</label>{numInput(s.tierDiscountLimits?.Platinum ?? 20, (v) => setTier("Platinum", v))}</div>,
          ])}
          {grp("Category discount ceilings (%)", [
            <div key="h"><label className="label">Hardware</label>{numInput(s.categoryDiscountLimits?.Hardware ?? 15, (v) => setCat("Hardware", v))}</div>,
            <div key="sv"><label className="label">Services</label>{numInput(s.categoryDiscountLimits?.Services ?? 10, (v) => setCat("Services", v))}</div>,
            <div key="su"><label className="label">Subscription</label>{numInput(s.categoryDiscountLimits?.Subscription ?? 8, (v) => setCat("Subscription", v))}</div>,
          ])}
          {grp("Approval thresholds", [
            <div key="a"><label className="label">Auto-approve ≤ risk</label>{numInput(s.approvalThresholds?.autoMax ?? 20, (v) => setAppr("autoMax", v))}</div>,
            <div key="m"><label className="label">Manager ≤ risk</label>{numInput(s.approvalThresholds?.managerMax ?? 50, (v) => setAppr("managerMax", v))}</div>,
          ])}
          {grp("Margin & negotiation", [
            <div key="c"><label className="label">Min company margin %</label>{numInput(s.minCompanyMarginPct ?? 10, (v) => setRows({ ...s, minCompanyMarginPct: num(v) }))}</div>,
            <div key="dc"><label className="label">Min dealer margin %</label>{numInput(s.dealerMinMarginPct ?? 8, (v) => setRows({ ...s, dealerMinMarginPct: num(v) }))}</div>,
            <div key="nb"><label className="label">Negotiation budget (₹)</label>{numInput(s.negotiationBudget ?? 50000, (v) => setRows({ ...s, negotiationBudget: num(v) }))}</div>,
          ])}
        </div>
      </div>
    );
  }

  // ---------- generic list ----------
  const openCreate = () => {
    const d = {};
    (FIELDS[active] || []).forEach(([k, , type]) => {
      if (type === "bool") d[k] = false;
      else if (type === "number") d[k] = 0;
    });
    setDraft(d);
    setEdit({ mode: "create" });
  };

  const openEdit = (row) => {
    const d = {};
    (FIELDS[active] || []).forEach(([k]) => { d[k] = row[k]; });
    setDraft(d);
    setEdit({ mode: "edit", row });
  };

  const save = async () => {
    setBusy(true);
    try {
      if (edit.mode === "edit") await api.put(`/admin/${active}/${edit.row._id}`, draft);
      else await api.post(`/admin/${active}`, draft);
      toast.push(edit.mode === "edit" ? "Updated" : "Created");
      setEdit(null);
      await load();
    } catch (e) { toast.push(errMsg(e), "error"); }
    setBusy(false);
  };

  const del = async (row) => {
    if (!confirm("Delete this record?")) return;
    try {
      await api.delete(`/admin/${active}/${row._id}`);
      toast.push("Deleted");
      await load();
    } catch (e) { toast.push(errMsg(e), "error"); }
  };

  const nameOf = (type, id) => {
    const list = refs[type] || [];
    const found = list.find((d) => String(d._id) === String(id) || String(d.id) === String(id));
    return found?.name || (String(id) || "").slice(-6);
  };

  const displayFor = (row) => {
    const first = (FIELDS[active] || [])[0];
    return first ? row[first[0]] : row._id;
  };

  return (
    <div>
      <PageHeader title="Administration" subtitle="Master data that feeds pricing, negotiation and fulfillment engines."
        actions={<button className="btn-primary" onClick={openCreate}><Plus size={15} /> New</button>} />
      <AdminTabs active={active} setActive={setActive} />

      <div className="card overflow-hidden">
        {!rows ? <Loader /> : (
          <table className="w-full text-sm">
            <thead className="bg-ink-50">
              <tr>
                {(FIELDS[active] || []).slice(0, 6).map(([k, label]) => <th key={k} className="th">{label}</th>)}
                <th className="th text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {(rows || []).map((row) => (
                <tr key={row._id} className="hover:bg-ink-50/60">
                  {(FIELDS[active] || []).slice(0, 6).map(([k, , type]) => {
                    let v = row[k];
                    if (type === "ref:dealers") v = nameOf("dealers", v);
                    else if (type === "ref:products") v = nameOf("products", v);
                    else if (type === "bool") v = v ? "Yes" : "No";
                    else if (type === "number" && !isNaN(v)) v = k.includes("Price") || k.includes("limit") || k.includes("cost") ? (v ? `₹${Number(v).toLocaleString("en-IN")}` : v) : v;
                    return <td key={k} className="td">{v ?? "—"}</td>;
                  })}
                  <td className="td text-right whitespace-nowrap">
                    <button className="btn-ghost !px-2 !py-1" onClick={() => openEdit(row)}><Pencil size={13} /></button>
                    <button className="btn-ghost !px-2 !py-1 !text-risk" onClick={() => del(row)}><Trash2 size={13} /></button>
                  </td>
                </tr>
              ))}
              {(rows || []).length === 0 && <tr><td colSpan={8} className="td text-center text-ink-700/50 py-8">No records.</td></tr>}
            </tbody>
          </table>
        )}
      </div>

      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.mode === "edit" ? `Edit — ${displayFor(edit.row)}` : "Create new record"}>
        <div className="grid grid-cols-2 gap-3">
          {(FIELDS[active] || []).map(([k, label, type]) => {
            if (type === "bool") {
              return (
                <label key={k} className="label flex items-center gap-2 pt-2">
                  <input type="checkbox" checked={!!draft[k]} onChange={(e) => setDraft({ ...draft, [k]: e.target.checked })} />
                  {label}
                </label>
              );
            }
            if (type.startsWith("select:")) {
              const opts = type.split(":")[1].split(",");
              return (
                <div key={k}>
                  <label className="label">{label}</label>
                  <select className="input" value={draft[k] || opts[0]} onChange={(e) => setDraft({ ...draft, [k]: e.target.value })}>
                    {opts.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
              );
            }
            if (type.startsWith("ref:")) {
              const refType = type.split(":")[1];
              const list = refs[refType] || [];
              return (
                <div key={k}>
                  <label className="label">{label}</label>
                  <select className="input" value={draft[k] || ""} onChange={(e) => setDraft({ ...draft, [k]: e.target.value })}>
                    <option value="">Select…</option>
                    {list.map((r) => <option key={r._id} value={r._id}>{r.name}</option>)}
                  </select>
                </div>
              );
            }
            return (
              <div key={k} className={type === "text" && k === "description" ? "col-span-2" : ""}>
                <label className="label">{label}</label>
                <input className="input" type={type} value={draft[k] ?? ""} onChange={(e) => setDraft({ ...draft, [k]: type === "number" ? Number(e.target.value) : e.target.value })} />
              </div>
            );
          })}
        </div>
        <button className="btn-primary w-full justify-center mt-4" onClick={save} disabled={busy}><Save size={15} /> Save</button>
      </Modal>
    </div>
  );
}

function AdminTabs({ active, setActive }) {
  return (
    <div className="flex flex-wrap gap-1 mb-5">
      {TABS.map(([key, label]) => (
        <button key={key} onClick={() => setActive(key)}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold transition ${active === key ? "bg-ink-900 text-white" : "bg-white text-ink-700/60 border border-ink-100 hover:bg-ink-50"}`}>
          {label}
        </button>
      ))}
    </div>
  );
}