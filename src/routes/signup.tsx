import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { HopOnWordmark } from "@/components/HopOnLogo";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/signup")({ component: Signup });

function Signup() {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) return toast.error("Passwords don't match");
    if (password.length < 6) return toast.error("Password must be at least 6 characters");
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/home`,
        data: { username, display_name: fullName, full_name: fullName },
      },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Account created! Welcome to HopOn 🎉");
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
        <h1 className="mt-6 text-center text-2xl font-bold">Create your HopOn account</h1>

        <form onSubmit={onSubmit} className="mt-7 space-y-3">
          {[
            { v: fullName, set: setFullName, ph: "Full Name", type: "text" },
            { v: username, set: setUsername, ph: "Username", type: "text" },
            { v: email, set: setEmail, ph: "Email", type: "email" },
            { v: password, set: setPassword, ph: "Password", type: "password" },
            { v: confirm, set: setConfirm, ph: "Confirm Password", type: "password" },
          ].map((f) => (
            <input
              key={f.ph}
              required type={f.type} value={f.v} onChange={(e) => f.set(e.target.value)} placeholder={f.ph}
              className="w-full rounded-2xl border border-border bg-input px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          ))}
          <button disabled={loading} className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-gradient py-3 text-sm font-semibold text-white shadow-glow disabled:opacity-60">
            {loading && <Loader2 className="h-4 w-4 animate-spin" />} Create Account
          </button>
        </form>

        <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
          <div className="h-px flex-1 bg-border" /> or continue with <div className="h-px flex-1 bg-border" />
        </div>
        <button onClick={onGoogle} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-background py-3 text-sm font-medium hover:bg-secondary">
          Continue with Google
        </button>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Already have an account? <Link to="/login" className="font-semibold text-brand-gradient">Login</Link>
        </p>
      </div>
    </div>
  );
}
