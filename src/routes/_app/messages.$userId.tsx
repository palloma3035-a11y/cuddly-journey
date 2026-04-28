import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Avatar } from "@/components/PostCard";
import { ArrowLeft, Send, Check, CheckCheck } from "lucide-react";

export const Route = createFileRoute("/_app/messages/$userId")({ component: Chat });

type Msg = {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
  read_at: string | null;
};

function Chat() {
  const { userId } = useParams({ from: "/_app/messages/$userId" });
  const { user } = useAuth();
  const [other, setOther] = useState<{ username: string; avatar_url: string | null } | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [otherTyping, setOtherTyping] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastTypingSentRef = useRef<number>(0);
  const otherTypingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Stable channel name for the pair (sorted ids)
  const channelName = useMemo(() => {
    if (!user) return null;
    const ids = [user.id, userId].sort();
    return `chat:${ids[0]}:${ids[1]}`;
  }, [user, userId]);

  useEffect(() => {
    supabase.from("profiles").select("username, avatar_url").eq("id", userId).maybeSingle()
      .then(({ data }) => setOther(data));
  }, [userId]);

  // Mark unread messages from the other user as read
  const markRead = async () => {
    if (!user) return;
    await supabase
      .from("messages")
      .update({ read_at: new Date().toISOString() })
      .eq("sender_id", userId)
      .eq("receiver_id", user.id)
      .is("read_at", null);
  };

  useEffect(() => {
    if (!user || !channelName) return;

    const load = async () => {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .or(`and(sender_id.eq.${user.id},receiver_id.eq.${userId}),and(sender_id.eq.${userId},receiver_id.eq.${user.id})`)
        .order("created_at", { ascending: true })
        .limit(200);
      setMessages((data as any) ?? []);
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 30);
      markRead();
    };
    load();

    const ch = supabase
      .channel(channelName, { config: { broadcast: { self: false } } })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => {
        const m = payload.new as Msg;
        if ((m.sender_id === user.id && m.receiver_id === userId) || (m.sender_id === userId && m.receiver_id === user.id)) {
          setMessages((prev) => [...prev, m]);
          setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 30);
          if (m.sender_id === userId) markRead();
        }
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages" }, (payload) => {
        const m = payload.new as Msg;
        setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, read_at: m.read_at } : x)));
      })
      .on("broadcast", { event: "typing" }, (payload) => {
        if (payload.payload?.user_id === userId) {
          setOtherTyping(true);
          if (otherTypingTimeoutRef.current) clearTimeout(otherTypingTimeoutRef.current);
          otherTypingTimeoutRef.current = setTimeout(() => setOtherTyping(false), 2500);
        }
      })
      .subscribe();

    const onFocus = () => markRead();
    window.addEventListener("focus", onFocus);

    return () => {
      supabase.removeChannel(ch);
      window.removeEventListener("focus", onFocus);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (otherTypingTimeoutRef.current) clearTimeout(otherTypingTimeoutRef.current);
    };
  }, [user, userId, channelName]);

  const sendTyping = () => {
    if (!user || !channelName) return;
    const now = Date.now();
    // Throttle to once every 1.5s
    if (now - lastTypingSentRef.current < 1500) return;
    lastTypingSentRef.current = now;
    // In-chat channel (for the open chat indicator)
    supabase.channel(channelName).send({
      type: "broadcast",
      event: "typing",
      payload: { user_id: user.id },
    });
    // Per-recipient inbox channel (for the thread list indicator)
    supabase.channel(`user-inbox:${userId}`).send({
      type: "broadcast",
      event: "typing",
      payload: { from: user.id },
    });
  };

  const onChangeText = (v: string) => {
    setText(v);
    if (v.trim().length > 0) sendTyping();
  };

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !text.trim()) return;
    const content = text.trim();
    setText("");
    lastTypingSentRef.current = 0;
    await supabase.from("messages").insert({ sender_id: user.id, receiver_id: userId, content });
  };

  // Find last message I sent to render seen indicator only on it
  const lastMineId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].sender_id === user?.id) return messages[i].id;
    }
    return null;
  }, [messages, user]);

  return (
    <div className="flex h-[calc(100vh-180px)] md:h-[calc(100vh-120px)] flex-col -m-4 md:-m-8">
      <header className="flex items-center gap-3 border-b border-border bg-card/60 p-3 backdrop-blur">
        <Link to="/messages" className="rounded-full p-2 hover:bg-secondary"><ArrowLeft className="h-5 w-5" /></Link>
        <Avatar src={other?.avatar_url ?? null} name={other?.username ?? "?"} size={36} />
        <div className="flex flex-col">
          <p className="font-semibold leading-tight">{other?.username ?? "Loading…"}</p>
          {otherTyping && (
            <p className="text-[11px] text-muted-foreground">typing…</p>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {messages.map((m) => {
          const mine = m.sender_id === user?.id;
          return (
            <div key={m.id} className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
              <div className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm ${mine ? "bg-brand-gradient text-white shadow-glow" : "bg-card border border-border"}`}>
                {m.content}
              </div>
              {mine && m.id === lastMineId && (
                <div className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground">
                  {m.read_at ? (
                    <>
                      <CheckCheck className="h-3 w-3 text-primary" />
                      <span>Seen</span>
                    </>
                  ) : (
                    <>
                      <Check className="h-3 w-3" />
                      <span>Sent</span>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {otherTyping && (
          <div className="flex justify-start">
            <div className="flex items-center gap-1 rounded-2xl border border-border bg-card px-3 py-2">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.3s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.15s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground" />
            </div>
          </div>
        )}

        <div ref={endRef} />
      </div>

      <form onSubmit={send} className="flex items-center gap-2 border-t border-border bg-card/60 p-3 backdrop-blur">
        <input
          value={text}
          onChange={(e) => onChangeText(e.target.value)}
          placeholder="Send a message…"
          className="flex-1 rounded-2xl border border-border bg-input px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        <button className="grid h-10 w-10 place-items-center rounded-2xl bg-brand-gradient text-white shadow-glow"><Send className="h-4 w-4" /></button>
      </form>
    </div>
  );
}
