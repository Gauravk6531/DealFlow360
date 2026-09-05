import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../store/auth";
import { useToast } from "../store/ui";

export default function SignupPage() {
  const { register } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    if (password.length < 8) return toast.push("Password must be at least 8 characters", "error");
    if (password !== password2) return toast.push("Passwords do not match", "error");
    const r = await register({ name, email, password });
    if (r.ok) { toast.push("Account created. Welcome aboard!"); nav("/"); }
    else toast.push(r.message, "error");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-ink-50 p-6">
      <div className="w-full max-w-md">
        <Link to="/" className="text-xl font-extrabold text-ink-900 mb-6 block">DealFlow360</Link>
        <div className="card p-6">
          <h2 className="text-lg font-extrabold text-ink-900">Create your team account</h2>
          <p className="text-xs text-ink-700/50 mt-1 mb-5">You will be onboarded as a Sales Rep. Managers & finance are invited by admins.</p>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="label">Full name</label>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div>
              <label className="label">Work email</label>
              <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div>
              <label className="label">Password</label>
              <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <div>
              <label className="label">Confirm password</label>
              <input className="input" type="password" value={password2} onChange={(e) => setPassword2(e.target.value)} required />
            </div>
            <button className="btn-primary w-full justify-center" type="submit">Create account</button>
          </form>
          <div className="text-center mt-4 text-sm text-ink-700/60">
            Already registered? <Link to="/login" className="font-semibold text-brand-700 hover:underline">Sign in</Link>
          </div>
        </div>
      </div>
    </div>
  );
}