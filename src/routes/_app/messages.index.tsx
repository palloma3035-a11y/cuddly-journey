import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Avatar } from "@/components/PostCard";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_app/messages/")({ component: MessagesIndex });

type Thread = {
  userId: string;
  username: string;
  avatar_url: string | null;
  last: string;
  at: string;
};

function MessagesIndex() {
  const { user } = useAuth();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);
  const [typingFrom, setTypingFrom] = useState<Record<string, boolean>>({});
  const typingTimeouts = useRef<Record<string, NodeJS.Timeout>>({});

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data } = await supabase
        .from("messages")
        .select("id, sender_id, receiver_id, content, created_at")
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order("created_at", { ascending: false })
        .limit(200);
      const map = new Map<string, { content: string; created_at: string }>();
      (data ?? []).forEach((m: any) => {
        const other = m.sender_id === user.id ? m.receiver_id : m.sender_id;
        if (!map.has(other)) map.set(other, { content: m.content, created_at: m.created_at });
      });
      const ids = [...map.keys()];
      if (ids.length === 0) { setThreads([]); setLoading(false); return; }
      const { data: profs } = await supabase.from("profiles").select("id, username, avatar_url").in("id", ids);
      const t: Thread[] = ids.map((id) => {
        const p = profs?.find((pp: any) => pp.id === id);
        const m = map.get(id)!;
        return { userId: id, username: p?.username ?? "user", avatar_url: p?.avatar_url ?? null, last: m.content, at: m.created_at };
      });
      setThreads(t);
      setLoading(false);
    };
    load();

    const ch = supabase
      .channel("msg-list")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, load)
      .subscribe();

    // Listen to typing broadcasts targeted at this user
    const inbox = supabase
      .channel(`user-inbox:${user.id}`)
      .on("broadcast", { event: "typing" }, (payload) => {
        const from = payload.payload?.from as string | undefined;
        if (!from || from === user.id) return;
        setTypingFrom((prev) => ({ ...prev, [from]: true }));
        if (typingTimeouts.current[from]) clearTimeout(typingTimeouts.current[from]);
        typingTimeouts.current[from] = setTimeout(() => {
          setTypingFrom((prev) => {
            const next = { ...prev };
            delete next[from];
            return next;
          });
        }, 2500);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
      supabase.removeChannel(inbox);
      Object.values(typingTimeouts.current).forEach(clearTimeout);
      typingTimeouts.current = {};
    };
  }, [user]);

  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-bold">Messages</h1>
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : threads.length === 0 ? (
        <div className="rounded-3xl border border-border bg-card p-10 text-center">
          <p className="text-sm text-muted-foreground">No conversations yet. Visit a profile to start one.</p>
        </div>
      ) : threads.map((t) => {
        const isTyping = !!typingFrom[t.userId];
        return (
          <Link key={t.userId} to="/messages/$userId" params={{ userId: t.userId }} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 hover:bg-secondary">
            <Avatar src={t.avatar_url} name={t.username} />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm">{t.username}</p>
              {isTyping ? (
                <p className="text-xs text-primary flex items-center gap-1.5">
                  <span className="inline-flex items-center gap-0.5">
                    <span className="h-1 w-1 animate-bounce rounded-full bg-primary [animation-delay:-0.3s]" />
                    <span className="h-1 w-1 animate-bounce rounded-full bg-primary [animation-delay:-0.15s]" />
                    <span className="h-1 w-1 animate-bounce rounded-full bg-primary" />
                  </span>
                  typing…
                </p>
              ) : (
                <p className="text-xs text-muted-foreground truncate">{t.last}</p>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground">{formatDistanceToNow(new Date(t.at), { addSuffix: true })}</p>
          </Link>
        );
      })}
    </div>
  );
}
