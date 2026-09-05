import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api, { errMsg } from "../services/api";
import { fmtINR } from "../utils/format";
import { Loader, PageHeader, StageBadge, RiskBadge, Modal } from "../components/ui";
import { useToast } from "../store/ui";
import { useAuth } from "../store/auth";
import { CheckCircle2, XCircle, BadgeCheck } from "lucide-react";

export default function ApprovalCenterPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [approvals, setApprovals] = useState(null);
  const [focus, setFocus] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = () => api.get("/approvals").then((r) => setApprovals(r.data.approvals)).catch(() => setApprovals([]));
  useEffect(() => { load(); }, []);

  if (!approvals) return <Loader />;

  const myQueue = approvals.filter((a) => a.status === "Pending" && a.approverRole === user.role);
  const visible = approvals;

  const review = async (a, status) => {
    setBusy(true);
    try {
      await api.post(`/approvals/${a._id}/review`, { status, reason: focus?.reason || "" });
      toast.push(status === "approve" ? `${a.approverRole} approved` : "Approval rejected");
      setFocus(null);
      await load();
    } catch (e) { toast.push(errMsg(e), "error"); }
    setBusy(false);
  };

  return (
    <div>
      <PageHeader title="Approval Center" subtitle="Risk-gated routing — the engine decides the chain, you decide the outcome." actions={myQueue.length > 0 ? <span className="badge bg-amber-100 text-amber-700">{myQueue.length} waiting on you</span> : null} />

      <div className="flex items-center gap-2 mb-5 text-sm bg-brand-50 border border-brand-100 rounded-xl px-4 py-3 text-brand-800">
        <BadgeCheck size={16} /> Your role ({user.role}) receives only the approvals routed to it by the risk engine — no cherry-picking, full audit trail.
      </div>

      {visible.length === 0 ? <div className="card p-10 text-center text-sm text-ink-700/50">Queue empty. Every deal is within autonomous limits. 🎉</div> : (
        <div className="grid gap-4">
          {visible.map((a) => {
            const q = a.quoteId;
            if (!q) return null;
            return (
              <div key={a._id} className={`card p-5 ${a.status === "Pending" && a.approverRole === user.role ? "border-2 border-amber-200 bg-amber-50/30" : ""}`}>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-700 flex items-center justify-center font-bold">{a.approverRole[0]}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link to={`/quotes/${q._id}`} className="font-mono text-sm text-brand-700 hover:underline">{q.quoteNumber}</Link>
                      <span className="text-sm font-semibold text-ink-900">{q.customerId?.name}</span>
                      <StageBadge stage={q.approvalStatus === "Pending" ? "Approval" : q.approvalStatus} />
                    </div>
                    <div className="text-xs text-ink-700/50 mt-0.5">
                      Level {a.approvalLevel} · {a.approverRole.replace("_", " ")} · requested {new Date(a.createdAt).toLocaleString()} · risk {a.previousValue?.riskScore}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-extrabold text-ink-900">{fmtINR(q.total)}</div>
                    <div className="text-xs text-ink-700/50">discount {a.previousValue?.discount ?? q.weightedDiscountPct}%</div>
                    <RiskBadge level={q.riskLevel} />
                  </div>
                  <div className="flex items-center gap-2">
                    {a.status === "Pending" && (
                      <>
                        {a.approverRole === user.role || user.role === "ADMIN" || user.role === "FINANCE" ? (
                          <>
                            <button className="btn-primary !py-1.5" onClick={() => setFocus({ a, mode: "approve" })}><CheckCircle2 size={15} /> Approve</button>
                            <button className="btn-danger !py-1.5" onClick={() => setFocus({ a, mode: "reject" })}><XCircle size={15} /> Reject</button>
                          </>
                        ) : <span className="badge bg-ink-100 text-ink-700">routed to {a.approverRole.replace("_", " ")}</span>}
                      </>
                    )}
                    {a.status !== "Pending" && <span className={`badge ${a.status === "Approved" ? "bg-emerald-100 text-emerald-700" : "bg-ink-100 text-ink-700"}`}>{a.status}</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal open={!!focus} onClose={() => setFocus(null)} title={focus?.mode === "approve" ? `Approve — level ${focus.a.approvalLevel}` : "Reject request"}>
        <div className="space-y-3">
          <div className="text-sm text-ink-700/70">
            {focus?.a?.quoteId?.quoteNumber} · risk {focus?.a?.previousValue?.riskScore} · discount {focus?.a?.previousValue?.discount ?? "—"}%
          </div>
          <textarea className="input" rows={3} placeholder="Decision note (audited)…" value={focus?.reason || ""} onChange={(e) => setFocus({ ...focus, reason: e.target.value })} />
          <button className={`w-full justify-center ${focus?.mode === "approve" ? "btn-primary" : "btn-danger"}`} onClick={() => review(focus.a, focus.mode)} disabled={busy}>
            {focus?.mode === "approve" ? "Confirm approval" : "Reject and stop chain"}
          </button>
        </div>
      </Modal>
    </div>
  );
}