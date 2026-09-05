import api from "../services/api";

export const fmtINR = (n) =>
  n === null || n === undefined || Number.isNaN(Number(n))
    ? "—"
    : new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(n));

export const fmtINRShort = (n) => {
  const v = Number(n || 0);
  if (Math.abs(v) >= 10000000) return `₹${(v / 10000000).toFixed(1)}Cr`;
  if (Math.abs(v) >= 100000) return `₹${(v / 100000).toFixed(1)}L`;
  if (Math.abs(v) >= 1000) return `₹${(v / 1000).toFixed(1)}K`;
  return fmtINR(v);
};

export function riskColor(level) {
  return level === "High" ? "bg-red-100 text-red-700" : level === "Medium" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700";
}

export function healthColor(status) {
  return status === "Healthy" ? "bg-emerald-100 text-emerald-700" : status === "At Risk" ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700";
}

export function stageColor(stage) {
  const map = {
    Draft: "bg-ink-100 text-ink-700", Sent: "bg-blue-100 text-blue-700",
    Negotiation: "bg-purple-100 text-purple-700", Approval: "bg-amber-100 text-amber-700",
    Approved: "bg-teal-100 text-teal-700", Fulfillment: "bg-cyan-100 text-cyan-700",
    Billing: "bg-indigo-100 text-indigo-700", Won: "bg-emerald-100 text-emerald-700", Lost: "bg-red-100 text-red-700",
  };
  return map[stage] || "bg-ink-100 text-ink-700";
}

export async function fetchQuotes() {
  const { data } = await api.get("/quotes");
  return data.quotes;
}

export async function fetchQuote(id) {
  const { data } = await api.get(`/quotes/${id}`);
  return data;
}

export async function fetchSettings() {
  const { data } = await api.get("/admin/settings");
  return data.settings;
}