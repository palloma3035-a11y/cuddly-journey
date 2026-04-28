import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { HopOnWordmark } from "@/components/HopOnLogo";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2 } from "lucide-react";

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Welcome back 👋");
    navigate({ to: "/home" });
  };

  const onGoogle = async () => {
    const { error } = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: `${window.location.origin}/home`,
    });
    if (error) toast.error(error.message);
  };

  return (
    <div className="min-h-screen grid place-items-center px-4 py-10">
      <div className="w-full max-w-md rounded-3xl border border-border bg-card p-8 shadow-soft animate-float-in">
        <div className="flex justify-center"><HopOnWordmark /></div>
        <h1 className="mt-6 text-center text-2xl font-bold">Welcome back 👋</h1>
        <p className="mt-1 text-center text-sm text-muted-foreground">Login to continue to HopOn</p>

        <form onSubmit={onSubmit} className="mt-7 space-y-3">
          <input
            type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="w-full rounded-2xl border border-border bg-input px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <div className="relative">
            <input
              type={showPwd ? "text" : "password"} required value={password}
              onChange={(e) => setPassword(e.target.value)} placeholder="Password"
              className="w-full rounded-2xl border border-border bg-input px-4 py-3 pr-11 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
            <button type="button" onClick={() => setShowPwd((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <button
            disabled={loading}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-gradient py-3 text-sm font-semibold text-white shadow-glow transition hover:brightness-110 disabled:opacity-60"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Login
          </button>
        </form>

        <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
          <div className="h-px flex-1 bg-border" /> or continue with <div className="h-px flex-1 bg-border" />
        </div>

        <button onClick={onGoogle} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-background py-3 text-sm font-medium hover:bg-secondary">
          <GoogleIcon /> Continue with Google
        </button>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Don't have an account?{" "}
          <Link to="/signup" className="font-semibold text-brand-gradient">Sign up</Link>
        </p>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#EA4335" d="M12 10.2v3.84h5.36c-.24 1.36-1.7 4-5.36 4-3.22 0-5.86-2.68-5.86-6s2.64-6 5.86-6c1.84 0 3.06.78 3.76 1.46l2.56-2.46C16.78 3.42 14.62 2.4 12 2.4 6.96 2.4 2.86 6.5 2.86 11.54S6.96 20.68 12 20.68c6.94 0 9.14-4.86 9.14-7.36 0-.5-.06-.88-.14-1.26H12z"/></svg>
  );
}
