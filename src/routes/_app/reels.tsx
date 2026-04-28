import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Heart, MessageCircle, Share2, Music2, Plus, Volume2, VolumeX } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/reels")({ component: ReelsPage });

type Profile = { id: string; username: string; avatar_url: string | null };
type Reel = {
  id: string;
  user_id: string;
  video_url: string;
  caption: string | null;
  audio_label: string | null;
  views: number;
  created_at: string;
  profile?: Profile;
  likes_count: number;
  comments_count: number;
  liked_by_me: boolean;
  followed: boolean;
};

const PAGE = 6;

function ReelsPage() {
  const { user } = useAuth();
  const [reels, setReels] = useState<Reel[]>([]);
  const [loading, setLoading] = useState(true);
  const [done, setDone] = useState(false);
  const [muted, setMuted] = useState(true);
  const [activeIdx, setActiveIdx] = useState(0);
  const [commentsFor, setCommentsFor] = useState<Reel | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fetchingRef = useRef(false);

  const hydrate = useCallback(
    async (rows: any[]): Promise<Reel[]> => {
      if (rows.length === 0) return [];
      const userIds = [...new Set(rows.map((r) => r.user_id))];
      const reelIds = rows.map((r) => r.id);
      const [{ data: profs }, { data: likes }, { data: comments }, { data: myLikes }, { data: myFollows }] =
        await Promise.all([
          supabase.from("profiles").select("id, username, avatar_url").in("id", userIds),
          supabase.from("reel_likes").select("reel_id").in("reel_id", reelIds),
          supabase.from("reel_comments").select("reel_id").in("reel_id", reelIds),
          user
            ? supabase.from("reel_likes").select("reel_id").in("reel_id", reelIds).eq("user_id", user.id)
            : Promise.resolve({ data: [] as any[] }),
          user
            ? supabase.from("follows").select("following_id").eq("follower_id", user.id).in("following_id", userIds)
            : Promise.resolve({ data: [] as any[] }),
        ]);
      const profMap = new Map((profs ?? []).map((p) => [p.id, p as Profile]));
      const likeCount = new Map<string, number>();
      (likes ?? []).forEach((l: any) => likeCount.set(l.reel_id, (likeCount.get(l.reel_id) ?? 0) + 1));
      const commentCount = new Map<string, number>();
      (comments ?? []).forEach((c: any) => commentCount.set(c.reel_id, (commentCount.get(c.reel_id) ?? 0) + 1));
      const myLikeSet = new Set((myLikes ?? []).map((l: any) => l.reel_id));
      const myFollowSet = new Set((myFollows ?? []).map((f: any) => f.following_id));
      return rows.map((r) => ({
        ...r,
        profile: profMap.get(r.user_id),
        likes_count: likeCount.get(r.id) ?? 0,
        comments_count: commentCount.get(r.id) ?? 0,
        liked_by_me: myLikeSet.has(r.id),
        followed: myFollowSet.has(r.user_id),
      }));
    },
    [user],
  );

  const loadMore = useCallback(async () => {
    if (fetchingRef.current || done) return;
    fetchingRef.current = true;
    const offset = reels.length;
    const { data, error } = await supabase
      .from("reels")
      .select("*")
      .order("created_at", { ascending: false })
      .range(offset, offset + PAGE - 1);
    if (error) {
      toast.error(error.message);
      fetchingRef.current = false;
      setLoading(false);
      return;
    }
    const hydrated = await hydrate(data ?? []);
    // Light shuffle for first batch (latest + random mix)
    if (offset === 0 && hydrated.length > 2) {
      const head = hydrated.slice(0, 2);
      const tail = hydrated.slice(2).sort(() => Math.random() - 0.5);
      setReels([...head, ...tail]);
    } else {
      setReels((prev) => [...prev, ...hydrated]);
    }
    if ((data ?? []).length < PAGE) setDone(true);
    setLoading(false);
    fetchingRef.current = false;
  }, [done, reels.length, hydrate]);

  useEffect(() => {
    loadMore();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Track which reel is in view via scroll snap
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onScroll = () => {
      const idx = Math.round(el.scrollTop / el.clientHeight);
      if (idx !== activeIdx) setActiveIdx(idx);
      if (idx >= reels.length - 2) loadMore();
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [activeIdx, reels.length, loadMore]);

  const toggleLike = async (reel: Reel) => {
    if (!user) return toast.error("Sign in first");
    const liked = reel.liked_by_me;
    setReels((rs) =>
      rs.map((r) =>
        r.id === reel.id
          ? { ...r, liked_by_me: !liked, likes_count: r.likes_count + (liked ? -1 : 1) }
          : r,
      ),
    );
    if (liked) {
      await supabase.from("reel_likes").delete().eq("reel_id", reel.id).eq("user_id", user.id);
    } else {
      await supabase.from("reel_likes").insert({ reel_id: reel.id, user_id: user.id });
    }
  };

  const toggleFollow = async (reel: Reel) => {
    if (!user || user.id === reel.user_id) return;
    const followed = reel.followed;
    setReels((rs) => rs.map((r) => (r.user_id === reel.user_id ? { ...r, followed: !followed } : r)));
    if (followed) {
      await supabase.from("follows").delete().eq("follower_id", user.id).eq("following_id", reel.user_id);
    } else {
      await supabase.from("follows").insert({ follower_id: user.id, following_id: reel.user_id });
    }
  };

  const share = async (reel: Reel) => {
    const url = `${window.location.origin}/reels?id=${reel.id}`;
    try {
      if (navigator.share) await navigator.share({ url, title: "Check this reel" });
      else {
        await navigator.clipboard.writeText(url);
        toast.success("Link copied");
      }
    } catch {}
  };

  return (
    <div className="fixed inset-0 z-20 bg-black md:left-64">
      <div
        ref={containerRef}
        className="h-full w-full overflow-y-scroll snap-y snap-mandatory scrollbar-none"
        style={{ scrollbarWidth: "none" }}
      >
        {reels.length === 0 && !loading && (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-white">
            <p className="text-lg font-semibold">No reels yet</p>
            <Link
              to="/reels/new"
              className="rounded-full bg-brand-gradient px-6 py-3 text-sm font-semibold shadow-glow"
            >
              Upload the first reel
            </Link>
          </div>
        )}
        {reels.map((reel, idx) => (
          <ReelItem
            key={reel.id}
            reel={reel}
            active={idx === activeIdx}
            preload={idx === activeIdx + 1}
            muted={muted}
            onToggleMute={() => setMuted((m) => !m)}
            onLike={() => toggleLike(reel)}
            onComment={() => setCommentsFor(reel)}
            onShare={() => share(reel)}
            onFollow={() => toggleFollow(reel)}
          />
        ))}
      </div>

      {/* Upload FAB */}
      <Link
        to="/reels/new"
        className="absolute right-4 top-4 z-30 grid h-11 w-11 place-items-center rounded-full bg-brand-gradient text-white shadow-glow"
        aria-label="Upload reel"
      >
        <Plus className="h-5 w-5" />
      </Link>

      {commentsFor && (
        <CommentsModal
          reel={commentsFor}
          onClose={() => setCommentsFor(null)}
          onCountChange={(delta) =>
            setReels((rs) =>
              rs.map((r) =>
                r.id === commentsFor.id ? { ...r, comments_count: r.comments_count + delta } : r,
              ),
            )
          }
        />
      )}
    </div>
  );
}

function ReelItem({
  reel,
  active,
  preload,
  muted,
  onToggleMute,
  onLike,
  onComment,
  onShare,
  onFollow,
}: {
  reel: Reel;
  active: boolean;
  preload: boolean;
  muted: boolean;
  onToggleMute: () => void;
  onLike: () => void;
  onComment: () => void;
  onShare: () => void;
  onFollow: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [expanded, setExpanded] = useState(false);
  const viewedRef = useRef(false);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (active) {
      v.currentTime = 0;
      v.play().catch(() => {});
      if (!viewedRef.current) {
        viewedRef.current = true;
        supabase.rpc("increment_reel_view", { reel_uuid: reel.id });
      }
    } else {
      v.pause();
    }
  }, [active, reel.id]);

  return (
    <div className="relative h-full w-full snap-start snap-always">
      <video
        ref={videoRef}
        src={active || preload ? reel.video_url : undefined}
        data-src={reel.video_url}
        loop
        muted={muted}
        playsInline
        preload={preload ? "auto" : "metadata"}
        onClick={onToggleMute}
        className="h-full w-full object-cover bg-black"
      />

      {/* Mute indicator */}
      <button
        onClick={onToggleMute}
        className="absolute top-4 left-4 grid h-9 w-9 place-items-center rounded-full bg-black/40 text-white"
      >
        {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
      </button>

      {/* Right side actions */}
      <div className="absolute right-3 bottom-28 z-10 flex flex-col items-center gap-5 text-white">
        <Link
          to="/u/$username"
          params={{ username: reel.profile?.username ?? "" }}
          className="relative"
        >
          <img
            src={reel.profile?.avatar_url ?? `https://api.dicebear.com/7.x/identicon/svg?seed=${reel.user_id}`}
            alt=""
            className="h-12 w-12 rounded-full border-2 border-white object-cover"
          />
          {!reel.followed && (
            <button
              onClick={(e) => {
                e.preventDefault();
                onFollow();
              }}
              className="absolute -bottom-2 left-1/2 grid h-5 w-5 -translate-x-1/2 place-items-center rounded-full bg-brand-gradient text-white"
              aria-label="Follow"
            >
              <Plus className="h-3 w-3" />
            </button>
          )}
        </Link>

        <button onClick={onLike} className="flex flex-col items-center gap-1">
          <Heart
            className={`h-8 w-8 drop-shadow ${reel.liked_by_me ? "fill-rose-500 text-rose-500" : ""}`}
          />
          <span className="text-xs font-semibold">{reel.likes_count}</span>
        </button>

        <button onClick={onComment} className="flex flex-col items-center gap-1">
          <MessageCircle className="h-8 w-8 drop-shadow" />
          <span className="text-xs font-semibold">{reel.comments_count}</span>
        </button>

        <button onClick={onShare} className="flex flex-col items-center gap-1">
          <Share2 className="h-8 w-8 drop-shadow" />
          <span className="text-xs font-semibold">Share</span>
        </button>
      </div>

      {/* Bottom-left meta */}
      <div className="absolute bottom-24 md:bottom-6 left-3 right-20 z-10 text-white">
        <Link
          to="/u/$username"
          params={{ username: reel.profile?.username ?? "" }}
          className="text-sm font-bold drop-shadow"
        >
          @{reel.profile?.username ?? "user"}
        </Link>
        {reel.caption && (
          <p
            onClick={() => setExpanded((e) => !e)}
            className={`mt-1 text-sm drop-shadow ${expanded ? "" : "line-clamp-2"}`}
          >
            {reel.caption}
          </p>
        )}
        <div className="mt-2 flex items-center gap-2 text-xs">
          <Music2 className="h-3.5 w-3.5" />
          <span className="truncate">{reel.audio_label ?? "Original audio"}</span>
        </div>
      </div>

      {/* Gradient overlays for legibility */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/50 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-black/60 to-transparent" />
    </div>
  );
}

function CommentsModal({
  reel,
  onClose,
  onCountChange,
}: {
  reel: Reel;
  onClose: () => void;
  onCountChange: (delta: number) => void;
}) {
  const { user } = useAuth();
  const [items, setItems] = useState<{ id: string; content: string; user_id: string; created_at: string; profile?: Profile }[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("reel_comments")
        .select("*")
        .eq("reel_id", reel.id)
        .order("created_at", { ascending: false });
      const userIds = [...new Set((data ?? []).map((c: any) => c.user_id))];
      const { data: profs } = userIds.length
        ? await supabase.from("profiles").select("id, username, avatar_url").in("id", userIds)
        : { data: [] };
      const profMap = new Map((profs ?? []).map((p: any) => [p.id, p]));
      setItems((data ?? []).map((c: any) => ({ ...c, profile: profMap.get(c.user_id) })));
    };
    load();
  }, [reel.id]);

  const send = async () => {
    if (!user || !text.trim()) return;
    setSending(true);
    const { data, error } = await supabase
      .from("reel_comments")
      .insert({ reel_id: reel.id, user_id: user.id, content: text.trim() })
      .select()
      .single();
    setSending(false);
    if (error) return toast.error(error.message);
    const { data: prof } = await supabase
      .from("profiles")
      .select("id, username, avatar_url")
      .eq("id", user.id)
      .maybeSingle();
    setItems((it) => [{ ...(data as any), profile: prof as Profile }, ...it]);
    setText("");
    onCountChange(1);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full md:max-w-md bg-background rounded-t-3xl md:rounded-3xl max-h-[75vh] flex flex-col"
      >
        <div className="p-4 border-b border-border text-center font-semibold">Comments</div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {items.length === 0 && <p className="text-center text-sm text-muted-foreground">Be the first to comment</p>}
          {items.map((c) => (
            <div key={c.id} className="flex gap-3">
              <img
                src={c.profile?.avatar_url ?? `https://api.dicebear.com/7.x/identicon/svg?seed=${c.user_id}`}
                alt=""
                className="h-8 w-8 rounded-full object-cover"
              />
              <div className="flex-1">
                <p className="text-sm">
                  <span className="font-semibold">@{c.profile?.username ?? "user"}</span>{" "}
                  <span>{c.content}</span>
                </p>
              </div>
            </div>
          ))}
        </div>
        <div className="p-3 border-t border-border flex gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Add a comment…"
            className="flex-1 rounded-full bg-secondary px-4 py-2 text-sm outline-none"
          />
          <button
            onClick={send}
            disabled={sending || !text.trim()}
            className="rounded-full bg-brand-gradient px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            Post
          </button>
        </div>
      </div>
    </div>
  );
}
