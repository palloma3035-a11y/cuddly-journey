import { createFileRoute, Outlet, redirect, Link, useLocation } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Home, Compass, PlusSquare, Bell, User, MessageCircle, Moon, Sun, Film } from "lucide-react";
import { HopOnWordmark } from "@/components/HopOnLogo";
import { useTheme } from "@/lib/theme";
import { useAuth } from "@/lib/auth-context";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/_app")({
  beforeLoad: async ({ location }) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw redirect({ to: "/login", search: { redirect: location.href } as never });
    }
  },
  component: AppLayout,
});

function AppLayout() {
  const { theme, toggle } = useTheme();
  const { user, signOut } = useAuth();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { count } = await supabase
        .from("notifications").select("*", { count: "exact", head: true })
        .eq("user_id", user.id).eq("read", false);
      setUnread(count ?? 0);
    };
    load();
    const ch = supabase
      .channel("notif-count")
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);

  return (
    <div className="min-h-screen pb-20 md:pb-0 md:pl-64">
      {/* Top bar (mobile) */}
      <header className="sticky top-0 z-30 flex md:hidden items-center justify-between border-b border-border bg-background/80 px-4 py-3 backdrop-blur">
        <HopOnWordmark />
        <div className="flex items-center gap-2">
          <button onClick={toggle} className="rounded-full p-2 hover:bg-secondary">
            {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>
          <Link to="/messages" className="rounded-full p-2 hover:bg-secondary"><MessageCircle className="h-5 w-5" /></Link>
        </div>
      </header>

      {/* Sidebar (desktop) */}
      <aside className="hidden md:flex fixed inset-y-0 left-0 w-64 flex-col border-r border-border bg-card/40 p-5 backdrop-blur">
        <Link to="/home"><HopOnWordmark /></Link>
        <nav className="mt-8 flex flex-1 flex-col gap-1">
          <NavItem to="/home" icon={Home} label="Home" />
          <NavItem to="/explore" icon={Compass} label="Explore" />
          <NavItem to="/reels" icon={Film} label="Reels" />
          <NavItem to="/create" icon={PlusSquare} label="Create" />
          <NavItem to="/notifications" icon={Bell} label="Notifications" badge={unread} />
          <NavItem to="/messages" icon={MessageCircle} label="Messages" />
          <NavItem to="/profile" icon={User} label="Profile" />
        </nav>
        <div className="space-y-2">
          <button onClick={toggle} className="flex w-full items-center gap-3 rounded-2xl p-3 text-sm font-medium hover:bg-secondary">
            {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            {theme === "dark" ? "Light mode" : "Dark mode"}
          </button>
          <button onClick={signOut} className="w-full rounded-2xl p-3 text-sm font-medium text-muted-foreground hover:bg-secondary text-left">
            Sign out
          </button>
        </div>
      </aside>

      <main className="mx-auto max-w-2xl p-4 md:p-8">
        <Outlet />
      </main>

      {/* Bottom nav (mobile) */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 grid grid-cols-5 border-t border-border bg-background/90 backdrop-blur">
        <BottomItem to="/home" icon={Home} label="Home" />
        <BottomItem to="/explore" icon={Compass} label="Explore" />
        <BottomItem to="/create" icon={PlusSquare} label="Create" highlight />
        <BottomItem to="/reels" icon={Film} label="Reels" />
        <BottomItem to="/profile" icon={User} label="Profile" />
      </nav>
    </div>
  );
}

function NavItem({ to, icon: Icon, label, badge }: { to: string; icon: any; label: string; badge?: number }) {
  const loc = useLocation();
  const active = loc.pathname === to || (to !== "/home" && loc.pathname.startsWith(to));
  return (
    <Link
      to={to as any}
      className={`flex items-center gap-3 rounded-2xl p-3 text-sm font-medium transition ${active ? "bg-brand-gradient text-white shadow-glow" : "hover:bg-secondary"}`}
    >
      <Icon className="h-5 w-5" />
      <span className="flex-1">{label}</span>
      {badge ? <span className="rounded-full bg-destructive px-2 py-0.5 text-xs font-bold text-white">{badge}</span> : null}
    </Link>
  );
}

function BottomItem({ to, icon: Icon, label, highlight, badge }: { to: string; icon: any; label: string; highlight?: boolean; badge?: number }) {
  const loc = useLocation();
  const active = loc.pathname === to;
  return (
    <Link to={to as any} className="flex flex-col items-center justify-center gap-0.5 py-2.5 text-[10px] font-medium relative">
      {highlight ? (
        <span className="grid h-9 w-9 place-items-center rounded-2xl bg-brand-gradient text-white shadow-glow">
          <Icon className="h-5 w-5" />
        </span>
      ) : (
        <Icon className={`h-5 w-5 ${active ? "text-foreground" : "text-muted-foreground"}`} />
      )}
      <span className={active ? "" : "text-muted-foreground"}>{label}</span>
      {badge ? <span className="absolute right-4 top-1 rounded-full bg-destructive px-1.5 text-[10px] font-bold text-white">{badge}</span> : null}
    </Link>
  );
}
