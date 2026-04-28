import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Avatar } from "@/components/PostCard";
import { toast } from "sonner";
import { X, Send, Plus, Trash2 } from "lucide-react";

type StatusRow = {
  id: string;
  user_id: string;
  media_url: string;
  media_type: string;
  caption: string | null;
  created_at: string;
};

type ProfileLite = { id: string; username: string; avatar_url: string | null; display_name: string | null };

type StoryGroup = { profile: ProfileLite; statuses: StatusRow[] };

const IMAGE_DURATION_MS = 5000;

export function StoryTray() {
  const { user, profile: me } = useAuth();
  const [groups, setGroups] = useState<StoryGroup[]>([]);
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [seenIds, setSeenIds] = useState<Set<string>>(new Set());

  const load = async () => {
    const { data: rawStatuses } = await supabase
      .from("statuses")
      .select("id, user_id, media_url, media_type, caption, created_at")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: true });
    const rows = (rawStatuses as StatusRow[] | null) ?? [];
    const userIds = Array.from(new Set(rows.map((r) => r.user_id)));
    let profilesById = new Map<string, ProfileLite>();
    if (userIds.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, username, avatar_url, display_name")
        .in("id", userIds);
      for (const p of (profs as ProfileLite[] | null) ?? []) profilesById.set(p.id, p);
    }
    const map = new Map<string, StoryGroup>();
    for (const r of rows) {
      const p = profilesById.get(r.user_id);
      if (!p) continue;
      const existing = map.get(p.id);
      if (existing) existing.statuses.push(r);
      else map.set(p.id, { profile: p, statuses: [r] });
    }
    let arr = Array.from(map.values());
    // Put my own group first
    if (user) arr = arr.sort((a, b) => (a.profile.id === user.id ? -1 : b.profile.id === user.id ? 1 : 0));
    setGroups(arr);

    // Pull seen statuses
    if (user) {
      const { data: views } = await supabase
        .from("status_views").select("status_id").eq("user_id", user.id);
      setSeenIds(new Set((views ?? []).map((v: any) => v.status_id as string)));
    }
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel("statuses-tray")
      .on("postgres_changes", { event: "*", schema: "public", table: "statuses" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const myGroup = groups.find((g) => g.profile.id === user?.id);
  const otherGroups = groups.filter((g) => g.profile.id !== user?.id);

  const onPickFile = async (file: File) => {
    if (!user) return;
    if (file.size > 25 * 1024 * 1024) return toast.error("Max 25MB");
    setUploading(true);
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${user.id}/${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("statuses").upload(path, file, { upsert: false });
    if (upErr) { setUploading(false); return toast.error(upErr.message); }
    const { data: pub } = supabase.storage.from("statuses").getPublicUrl(path);
    const media_type = file.type.startsWith("video") ? "video" : "image";
    const { error } = await supabase.from("statuses").insert({
      user_id: user.id, media_url: pub.publicUrl, media_type,
    });
    setUploading(false);
    if (error) return toast.error(error.message);
    toast.success("Status posted");
    await load();
  };

  const openGroup = (idx: number) => setOpenIndex(idx);

  // Build the tray order matching openIndex semantics: [myGroup?, ...others]
  const trayOrder: StoryGroup[] = [];
  if (myGroup) trayOrder.push(myGroup);
  trayOrder.push(...otherGroups);

  return (
    <div className="rounded-3xl border border-border bg-card/60 p-3 shadow-soft mb-5">
      <div className="flex gap-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {/* My status / add */}
        <button
          onClick={() => {
            if (myGroup) openGroup(0);
            else fileRef.current?.click();
          }}
          className="flex w-16 flex-shrink-0 flex-col items-center gap-1.5"
        >
          <span className="relative">
            <span className={`grid h-16 w-16 place-items-center rounded-full ${myGroup ? "bg-brand-gradient p-[2.5px]" : "bg-muted p-[2px]"}`}>
              <span className="grid h-full w-full place-items-center rounded-full bg-background">
                <Avatar src={me?.avatar_url ?? null} name={me?.username ?? "you"} size={56} />
              </span>
            </span>
            <span className="absolute -bottom-0.5 -right-0.5 grid h-5 w-5 place-items-center rounded-full bg-brand-gradient text-white shadow-glow">
              <Plus className="h-3 w-3" />
            </span>
          </span>
          <span className="truncate text-[11px] font-medium">Your story</span>
        </button>

        {otherGroups.map((g, i) => {
          const trayIdx = myGroup ? i + 1 : i;
          const allSeen = g.statuses.every((s) => seenIds.has(s.id));
          return (
            <button
              key={g.profile.id}
              onClick={() => openGroup(trayIdx)}
              className="flex w-16 flex-shrink-0 flex-col items-center gap-1.5"
            >
              <span className={`grid h-16 w-16 place-items-center rounded-full p-[2.5px] ${allSeen ? "bg-muted" : "bg-brand-gradient"}`}>
                <span className="grid h-full w-full place-items-center rounded-full bg-background">
                  <Avatar src={g.profile.avatar_url} name={g.profile.username} size={56} />
                </span>
              </span>
              <span className="w-full truncate text-center text-[11px] font-medium">{g.profile.username}</span>
            </button>
          );
        })}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*,video/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onPickFile(f);
          e.target.value = "";
        }}
      />
      {uploading && <p className="mt-2 text-center text-xs text-muted-foreground">Uploading status…</p>}

      {openIndex !== null && trayOrder.length > 0 && (
        <StoryViewer
          groups={trayOrder}
          startGroup={Math.min(openIndex, trayOrder.length - 1)}
          onClose={() => setOpenIndex(null)}
          onAdd={() => fileRef.current?.click()}
          onChange={() => load()}
          markSeen={(id) => setSeenIds((s) => new Set(s).add(id))}
        />
      )}
    </div>
  );
}

function StoryViewer({
  groups, startGroup, onClose, onAdd, onChange, markSeen,
}: {
  groups: StoryGroup[];
  startGroup: number;
  onClose: () => void;
  onAdd: () => void;
  onChange: () => void;
  markSeen: (id: string) => void;
}) {
  const { user } = useAuth();
  const [groupIdx, setGroupIdx] = useState(startGroup);
  const [storyIdx, setStoryIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number>(0);
  const elapsedRef = useRef<number>(0);
  const videoRef = useRef<HTMLVideoElement>(null);

  const group = groups[groupIdx];
  const story = group?.statuses[storyIdx];
  const isMine = story && user?.id === story.user_id;

  // Lock body scroll
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Reset on story change
  useEffect(() => {
    setProgress(0);
    elapsedRef.current = 0;
    startRef.current = performance.now();
    if (!story) return;

    // Mark as seen
    if (user && story.user_id !== user.id) {
      supabase.from("status_views").insert({ status_id: story.id, user_id: user.id })
        .then(() => markSeen(story.id), () => markSeen(story.id));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupIdx, storyIdx]);

  const advance = () => {
    if (!group) return onClose();
    if (storyIdx < group.statuses.length - 1) {
      setStoryIdx(storyIdx + 1);
    } else if (groupIdx < groups.length - 1) {
      setGroupIdx(groupIdx + 1);
      setStoryIdx(0);
    } else {
      onClose();
    }
  };

  const goBack = () => {
    if (storyIdx > 0) setStoryIdx(storyIdx - 1);
    else if (groupIdx > 0) {
      const prevG = groups[groupIdx - 1];
      setGroupIdx(groupIdx - 1);
      setStoryIdx(prevG.statuses.length - 1);
    }
  };

  // Image timer (videos use their own 'ended' event)
  useEffect(() => {
    if (!story || story.media_type === "video" || paused) return;
    let frame = 0;
    const tick = (now: number) => {
      const elapsed = elapsedRef.current + (now - startRef.current);
      const pct = Math.min(100, (elapsed / IMAGE_DURATION_MS) * 100);
      setProgress(pct);
      if (pct >= 100) advance();
      else frame = requestAnimationFrame(tick);
    };
    startRef.current = performance.now();
    frame = requestAnimationFrame(tick);
    rafRef.current = frame;
    return () => {
      cancelAnimationFrame(frame);
      // remember elapsed for resume after pause
      elapsedRef.current += performance.now() - startRef.current;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storyIdx, groupIdx, paused, story?.media_type]);

  const sendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !story || !reply.trim() || isMine) return;
    setSending(true);
    const content = reply.trim();
    setReply("");
    const { error } = await supabase.from("status_replies").insert({
      status_id: story.id,
      sender_id: user.id,
      recipient_id: story.user_id,
      content,
    });
    setSending(false);
    if (error) return toast.error(error.message);
    toast.success(`Reply sent to ${group.profile.username}`);
  };

  const deleteStory = async () => {
    if (!story || !isMine) return;
    if (!confirm("Delete this status?")) return;
    const { error } = await supabase.from("statuses").delete().eq("id", story.id);
    if (error) return toast.error(error.message);
    onChange();
    advance();
  };

  if (!story) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black">
      {/* Header */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 px-3 pt-3">
        <div className="flex gap-1">
          {group.statuses.map((_, i) => (
            <div key={i} className="h-0.5 flex-1 overflow-hidden rounded-full bg-white/30">
              <div
                className="h-full bg-white transition-[width]"
                style={{
                  width: `${i < storyIdx ? 100 : i === storyIdx ? progress : 0}%`,
                }}
              />
            </div>
          ))}
        </div>
        <div className="pointer-events-auto mt-3 flex items-center gap-2">
          <Avatar src={group.profile.avatar_url} name={group.profile.username} size={32} />
          <span className="text-sm font-semibold text-white">{group.profile.username}</span>
          <span className="text-xs text-white/70">
            {timeAgo(story.created_at)}
          </span>
          <div className="ml-auto flex items-center gap-1">
            {isMine && (
              <button onClick={deleteStory} className="rounded-full p-2 text-white hover:bg-white/10" aria-label="Delete">
                <Trash2 className="h-4 w-4" />
              </button>
            )}
            <button onClick={onClose} className="rounded-full p-2 text-white hover:bg-white/10" aria-label="Close">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Tap zones */}
      <button
        className="absolute inset-y-0 left-0 z-[5] w-1/3"
        onClick={goBack}
        onMouseDown={() => setPaused(true)}
        onMouseUp={() => setPaused(false)}
        onTouchStart={() => setPaused(true)}
        onTouchEnd={() => setPaused(false)}
        aria-label="Previous"
      />
      <button
        className="absolute inset-y-0 right-0 z-[5] w-1/3"
        onClick={advance}
        onMouseDown={() => setPaused(true)}
        onMouseUp={() => setPaused(false)}
        onTouchStart={() => setPaused(true)}
        onTouchEnd={() => setPaused(false)}
        aria-label="Next"
      />

      {/* Media */}
      <div className="relative h-full w-full max-w-[480px] flex items-center justify-center">
        {story.media_type === "video" ? (
          <video
            ref={videoRef}
            key={story.id}
            src={story.media_url}
            autoPlay
            playsInline
            controls={false}
            onTimeUpdate={(e) => {
              const v = e.currentTarget;
              if (v.duration) setProgress((v.currentTime / v.duration) * 100);
            }}
            onEnded={advance}
            className="max-h-full max-w-full object-contain"
          />
        ) : (
          <img src={story.media_url} alt="" className="max-h-full max-w-full object-contain" />
        )}
        {story.caption && (
          <div className="pointer-events-none absolute bottom-24 left-0 right-0 px-6 text-center">
            <p className="inline-block rounded-2xl bg-black/40 px-4 py-2 text-sm font-medium text-white backdrop-blur">
              {story.caption}
            </p>
          </div>
        )}
      </div>

      {/* Reply bar */}
      {!isMine && (
        <form
          onSubmit={sendReply}
          className="absolute inset-x-0 bottom-0 z-10 flex items-center gap-2 bg-gradient-to-t from-black/70 to-transparent p-4 pb-6"
        >
          <input
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            onFocus={() => setPaused(true)}
            onBlur={() => setPaused(false)}
            placeholder={`Reply to ${group.profile.username}…`}
            className="flex-1 rounded-full border border-white/20 bg-white/10 px-4 py-2.5 text-sm text-white placeholder:text-white/60 outline-none backdrop-blur focus:border-white/40"
          />
          <button
            type="submit"
            disabled={sending || !reply.trim()}
            className="grid h-10 w-10 place-items-center rounded-full bg-brand-gradient text-white shadow-glow disabled:opacity-40"
            aria-label="Send"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      )}
      {isMine && (
        <div className="absolute inset-x-0 bottom-0 z-10 p-4 pb-6 text-center">
          <button
            onClick={onAdd}
            className="rounded-full bg-white/10 px-4 py-2 text-xs font-medium text-white backdrop-blur hover:bg-white/20"
          >
            + Add another
          </button>
        </div>
      )}
    </div>
  );
}

function timeAgo(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h`;
}
