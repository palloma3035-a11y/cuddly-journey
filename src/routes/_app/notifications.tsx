import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Avatar } from "@/components/PostCard";
import { formatDistanceToNow } from "date-fns";
import { Heart, MessageCircle, UserPlus } from "lucide-react";

export const Route = createFileRoute("/_app/notifications")({ component: Notifications });

type Notif = {
  id: string;
  type: string;
  read: boolean;
  created_at: string;
  actor_id: string;
  post_id: string | null;
  profiles: { username: string; avatar_url: string | null } | null;
};

function Notifications() {
  const { user } = useAuth();
  const [items, setItems] = useState<Notif[]>([]);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data } = await supabase
        .from("notifications")
        .select("id, type, read, created_at, actor_id, post_id, profiles!notifications_actor_id_fkey(username, avatar_url)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(100);
      setItems((data as any) ?? []);
      // mark as read
      await supabase.from("notifications").update({ read: true }).eq("user_id", user.id).eq("read", false);
    };
    load();
    const ch = supabase
      .channel("notif-list")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);

  if (items.length === 0) {
    return (
      <div className="rounded-3xl border border-border bg-card p-10 text-center shadow-soft">
        <h2 className="text-xl font-bold">No notifications yet</h2>
        <p className="mt-1 text-sm text-muted-foreground">Likes, comments and new followers will appear here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-bold">Notifications</h1>
      {items.map((n) => (
        <div key={n.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
          <div className="relative">
            <Avatar src={n.profiles?.avatar_url ?? null} name={n.profiles?.username ?? "?"} />
            <span className="absolute -bottom-1 -right-1 grid h-6 w-6 place-items-center rounded-full bg-brand-gradient text-white shadow-glow">
              {n.type === "like" ? <Heart className="h-3 w-3" /> : n.type === "comment" ? <MessageCircle className="h-3 w-3" /> : <UserPlus className="h-3 w-3" />}
            </span>
          </div>
          <div className="flex-1 text-sm">
            <span className="font-semibold">{n.profiles?.username ?? "Someone"}</span>{" "}
            {n.type === "like" && "liked your post."}
            {n.type === "comment" && "commented on your post."}
            {n.type === "follow" && "started following you."}
            <p className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
