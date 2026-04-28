import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { HopOnWordmark } from "@/components/HopOnLogo";
import { ArrowRight, Sparkles, Users, Share2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) throw redirect({ to: "/home" });
  },
  component: Landing,
});

function Landing() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-40 -left-40 h-[420px] w-[420px] rounded-full bg-brand-gradient opacity-40 blur-3xl" />
        <div className="absolute top-1/3 -right-40 h-[420px] w-[420px] rounded-full bg-brand-gradient opacity-30 blur-3xl" />
      </div>

      <header className="flex items-center justify-between p-6 max-w-6xl mx-auto">
        <HopOnWordmark />
        <Link to="/login" className="text-sm font-medium hover:text-foreground/80">
          Sign in
        </Link>
      </header>

      <main className="mx-auto max-w-6xl px-6 pt-10 pb-20">
        <section className="text-center animate-float-in">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-4 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur">
            <Sparkles className="h-3.5 w-3.5" /> A fresh place to share moments
          </span>
          <h1 className="mt-6 text-5xl md:text-7xl font-black tracking-tight leading-[1.05]">
            Hop into <span className="text-brand-gradient">what matters</span>.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base md:text-lg text-muted-foreground">
            Discover trending content, share moments instantly, and connect with people & communities you love.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <Link
              to="/signup"
              className="group inline-flex items-center gap-2 rounded-2xl bg-brand-gradient px-6 py-3 text-sm font-semibold text-white shadow-glow transition hover:brightness-110"
            >
              Get started
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
            </Link>
            <Link
              to="/login"
              className="rounded-2xl border border-border bg-card/60 px-6 py-3 text-sm font-semibold backdrop-blur hover:bg-card"
            >
              Login
            </Link>
          </div>
        </section>

        <section className="mt-20 grid md:grid-cols-3 gap-4">
          {[
            { icon: Sparkles, title: "Discover", desc: "Trending content, creators, and moments around you." },
            { icon: Share2, title: "Share", desc: "Post photos, videos, and stories. Your moment, your way." },
            { icon: Users, title: "Connect", desc: "Follow, chat, and build real connections that last." },
          ].map((f, i) => (
            <div
              key={f.title}
              className="rounded-3xl border border-border bg-card/60 p-6 backdrop-blur shadow-soft animate-float-in"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-gradient shadow-glow">
                <f.icon className="h-6 w-6 text-white" />
              </div>
              <h3 className="mt-4 text-lg font-bold">{f.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
