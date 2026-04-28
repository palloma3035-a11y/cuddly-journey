import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Heart, MessageCircle, Send, Bookmark, X, Hand } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

export type FeedPost = {
  id: string;
  user_id: string;
  media_url: string;
  media_type: string;
  caption: string | null;
  created_at: string;
  profiles: { username: string; display_name: string | null; avatar_url: string | null } | null;
};

type CommentRow = {
  id: string;
  content: string;
  user_id: string;
  created_at: string;
  profiles: { username: string; avatar_url: string | null } | null;
};

export function PostCard({ post, defaultOpen = false, onCloseModal }: { post: FeedPost; defaultOpen?: boolean; onCloseModal?: () => void }) {
  const { user } = useAuth();
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [commentCount, setCommentCount] = useState(0);
  const [pop, setPop] = useState(false);
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [newComment, setNewComment] = useState("");
  const [modalOpen, setModalOpen] = useState(defaultOpen);
  const [focusInput, setFocusInput] = useState(false);
  const isMobile = useIsMobile();
  const [hintDismissed, setHintDismissed] = useState(() => {
    if (typeof window === "undefined") return true;
    return window.localStorage.getItem("postTapHintDismissed") === "1";
  });
  const dismissHint = () => {
    setHintDismissed(true);
    try { window.localStorage.setItem("postTapHintDismissed", "1"); } catch { /* ignore */ }
  };
  const pointerStart = useRef<{ id: number; x: number; y: number } | null>(null);

  useEffect(() => {
    const load = async () => {
      const [{ count: lc }, { count: cc }, mine] = await Promise.all([
        supabase.from("likes").select("*", { count: "exact", head: true }).eq("post_id", post.id),
        supabase.from("comments").select("*", { count: "exact", head: true }).eq("post_id", post.id),
        user ? supabase.from("likes").select("id").eq("post_id", post.id).eq("user_id", user.id).maybeSingle() : Promise.resolve({ data: null } as any),
      ]);
      setLikeCount(lc ?? 0);
      setCommentCount(cc ?? 0);
      setLiked(!!mine.data);
    };
    load();

    const ch = supabase
      .channel(`post-${post.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "likes", filter: `post_id=eq.${post.id}` }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "comments", filter: `post_id=eq.${post.id}` }, () => {
        load();
        if (modalOpen) loadComments();
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [post.id, user, modalOpen]);

  // Lock body scroll while modal is open
  useEffect(() => {
    if (!modalOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setModalOpen(false); onCloseModal?.(); } };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [modalOpen]);

  // If opened by default (e.g. from Explore), preload comments
  useEffect(() => {
    if (defaultOpen) {
      dismissHint();
      loadComments();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultOpen]);

  const toggleLike = async () => {
    if (!user) return;
    setPop(true);
    setTimeout(() => setPop(false), 450);
    if (liked) {
      setLiked(false);
      setLikeCount((c) => Math.max(0, c - 1));
      await supabase.from("likes").delete().eq("post_id", post.id).eq("user_id", user.id);
    } else {
      setLiked(true);
      setLikeCount((c) => c + 1);
      const { error } = await supabase.from("likes").insert({ post_id: post.id, user_id: user.id });
      if (error) {
        setLiked(false);
        setLikeCount((c) => Math.max(0, c - 1));
      }
    }
  };

  const loadComments = async () => {
    const { data } = await supabase
      .from("comments")
      .select("id, content, user_id, created_at, profiles(username, avatar_url)")
      .eq("post_id", post.id)
      .order("created_at", { ascending: true });
    setComments((data as any) ?? []);
  };

  const openModal = async (focus = false) => {
    dismissHint();
    setFocusInput(focus);
    setModalOpen(true);
    await loadComments();
  };

  const isInteractiveTap = (target: EventTarget | null) =>
    target instanceof HTMLElement && !!target.closest("a, button, input, textarea, select, form");

  const startPostTap = (e: React.PointerEvent<HTMLElement>) => {
    if (isInteractiveTap(e.target)) return;
    pointerStart.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
  };

  const finishPostTap = (e: React.PointerEvent<HTMLElement>) => {
    const start = pointerStart.current;
    pointerStart.current = null;
    if (!start || start.id !== e.pointerId || isInteractiveTap(e.target)) return;
    const moved = Math.hypot(e.clientX - start.x, e.clientY - start.y);
    if (moved <= 12) openModal(false);
  };

  const submitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newComment.trim()) return;
    const content = newComment.trim();
    setNewComment("");
    const { error } = await supabase.from("comments").insert({ post_id: post.id, user_id: user.id, content });
    if (error) toast.error(error.message);
    else loadComments();
  };

  const sharePost = async () => {
    const url = `${window.location.origin}/u/${post.profiles?.username ?? ""}`;
    const shareData = {
      title: `${post.profiles?.username ?? "HopOn"} on HopOn`,
      text: post.caption ?? "Check out this post on HopOn",
      url,
    };
    try {
      if (navigator.share && navigator.canShare?.(shareData)) {
        await navigator.share(shareData);
        return;
      }
    } catch {
      /* user cancelled or share failed — fall through to clipboard */
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied to clipboard");
    } catch {
      toast.error("Couldn't share this post");
    }
  };

  const profile = post.profiles;

  return (
    <>
      <article
        className="overflow-hidden rounded-3xl border border-border bg-card shadow-soft animate-float-in"
        onPointerDown={startPostTap}
        onPointerUp={finishPostTap}
        onPointerCancel={() => { pointerStart.current = null; }}
      >
        <header className="flex items-center gap-3 p-4">
          <Link to="/u/$username" params={{ username: profile?.username ?? "" }}>
            <Avatar src={profile?.avatar_url} name={profile?.username ?? "?"} />
          </Link>
          <div className="flex-1 min-w-0">
            <Link to="/u/$username" params={{ username: profile?.username ?? "" }} className="font-semibold text-sm hover:underline">
              {profile?.username ?? "user"}
            </Link>
            <p className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}</p>
          </div>
        </header>

        <div
          role="button"
          tabIndex={0}
          onDoubleClick={toggleLike}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openModal(false); } }}
          className="relative block w-full bg-black/40 cursor-pointer select-none touch-manipulation"
          aria-label="Open post"
        >
          {post.media_type === "video" ? (
            <video
              src={post.media_url}
              muted
              loop
              playsInline
              autoPlay
              className="w-full max-h-[600px] object-contain pointer-events-none"
            />
          ) : (
            <img
              src={post.media_url}
              alt={post.caption ?? "post"}
              className="w-full max-h-[600px] object-cover pointer-events-none"
              loading="lazy"
              draggable={false}
            />
          )}
          {isMobile && !hintDismissed && (
            <div className="pointer-events-none absolute inset-0 flex items-end justify-center pb-4 animate-float-in">
              <div className="flex items-center gap-2 rounded-full bg-black/60 px-4 py-2 text-xs font-medium text-white backdrop-blur-sm shadow-lg">
                <Hand className="h-4 w-4" />
                Tap to view
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 p-3">
          <button onClick={toggleLike} aria-label="Like" className="rounded-full p-2 hover:bg-secondary">
            <Heart className={`h-6 w-6 transition ${liked ? "fill-pink-500 text-pink-500" : ""} ${pop ? "animate-heart-pop" : ""}`} />
          </button>
          <button onClick={() => openModal(true)} aria-label="Comment" className="rounded-full p-2 hover:bg-secondary">
            <MessageCircle className="h-6 w-6" />
          </button>
          <button onClick={sharePost} aria-label="Share" className="rounded-full p-2 hover:bg-secondary">
            <Send className="h-6 w-6" />
          </button>
          <button aria-label="Save" className="ml-auto rounded-full p-2 hover:bg-secondary"><Bookmark className="h-6 w-6" /></button>
        </div>

        <div className="px-4 pb-4 text-sm">
          <p className="font-semibold">{likeCount.toLocaleString()} {likeCount === 1 ? "like" : "likes"}</p>
          {post.caption && (
            <p className="mt-1">
              <span className="font-semibold mr-1">{profile?.username}</span>{post.caption}
            </p>
          )}
          {commentCount > 0 && (
            <button onClick={() => openModal(false)} className="mt-1 text-xs text-muted-foreground hover:underline">
              View all {commentCount} {commentCount === 1 ? "comment" : "comments"}
            </button>
          )}
        </div>
      </article>

      {modalOpen && (
        <PostModal
          post={post}
          comments={comments}
          liked={liked}
          likeCount={likeCount}
          pop={pop}
          newComment={newComment}
          setNewComment={setNewComment}
          submitComment={submitComment}
          toggleLike={toggleLike}
          sharePost={sharePost}
          autoFocusInput={focusInput}
          onClose={() => { setModalOpen(false); onCloseModal?.(); }}
        />
      )}
    </>
  );
}

function PostModal({
  post, comments, liked, likeCount, pop, newComment, setNewComment,
  submitComment, toggleLike, sharePost, autoFocusInput, onClose,
}: {
  post: FeedPost;
  comments: CommentRow[];
  liked: boolean;
  likeCount: number;
  pop: boolean;
  newComment: string;
  setNewComment: (v: string) => void;
  submitComment: (e: React.FormEvent) => void;
  toggleLike: () => void;
  sharePost: () => void;
  autoFocusInput: boolean;
  onClose: () => void;
}) {
  const profile = post.profiles;
  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-0 md:p-6 animate-float-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <button
        onClick={onClose}
        aria-label="Close"
        className="absolute top-3 right-3 z-10 rounded-full bg-black/50 p-2 text-white hover:bg-black/70"
      >
        <X className="h-5 w-5" />
      </button>

      <div
        className="relative flex h-full w-full max-w-5xl flex-col overflow-hidden bg-card md:h-[85vh] md:flex-row md:rounded-2xl md:shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Media */}
        <div
          className="relative flex items-center justify-center bg-black md:flex-1"
          onDoubleClick={toggleLike}
        >
          {post.media_type === "video" ? (
            <video src={post.media_url} controls className="max-h-[55vh] w-full object-contain md:max-h-full" />
          ) : (
            <img src={post.media_url} alt={post.caption ?? "post"} className="max-h-[55vh] w-full object-contain md:max-h-full" />
          )}
        </div>

        {/* Side panel */}
        <div className="flex w-full flex-col border-t border-border bg-card md:w-[380px] md:border-l md:border-t-0">
          <header className="flex items-center gap-3 border-b border-border p-3">
            <Link to="/u/$username" params={{ username: profile?.username ?? "" }} onClick={onClose}>
              <Avatar src={profile?.avatar_url} name={profile?.username ?? "?"} size={36} />
            </Link>
            <Link
              to="/u/$username"
              params={{ username: profile?.username ?? "" }}
              onClick={onClose}
              className="text-sm font-semibold hover:underline"
            >
              {profile?.username ?? "user"}
            </Link>
          </header>

          <div className="flex-1 overflow-y-auto px-4 py-3 text-sm space-y-3 max-h-[40vh] md:max-h-none">
            {post.caption && (
              <div className="flex gap-2">
                <Avatar src={profile?.avatar_url ?? null} name={profile?.username ?? "?"} size={28} />
                <div className="flex-1 text-xs">
                  <span className="font-semibold mr-1">{profile?.username}</span>{post.caption}
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                  </p>
                </div>
              </div>
            )}
            {comments.length === 0 ? (
              <p className="text-center text-xs text-muted-foreground py-6">No comments yet. Be the first.</p>
            ) : (
              comments.map((c) => (
                <div key={c.id} className="flex gap-2">
                  <Avatar src={c.profiles?.avatar_url ?? null} name={c.profiles?.username ?? "?"} size={28} />
                  <div className="flex-1 text-xs">
                    <span className="font-semibold mr-1">{c.profiles?.username}</span>{c.content}
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="border-t border-border">
            <div className="flex items-center gap-2 p-3">
              <button onClick={toggleLike} aria-label="Like" className="rounded-full p-2 hover:bg-secondary">
                <Heart className={`h-6 w-6 transition ${liked ? "fill-pink-500 text-pink-500" : ""} ${pop ? "animate-heart-pop" : ""}`} />
              </button>
              <button aria-label="Comment" className="rounded-full p-2 hover:bg-secondary">
                <MessageCircle className="h-6 w-6" />
              </button>
              <button onClick={sharePost} aria-label="Share" className="rounded-full p-2 hover:bg-secondary">
                <Send className="h-6 w-6" />
              </button>
              <button aria-label="Save" className="ml-auto rounded-full p-2 hover:bg-secondary"><Bookmark className="h-6 w-6" /></button>
            </div>
            <div className="px-4 pb-2 text-sm">
              <p className="font-semibold">{likeCount.toLocaleString()} {likeCount === 1 ? "like" : "likes"}</p>
            </div>
            <form onSubmit={submitComment} className="flex gap-2 p-3 pt-0">
              <input
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Add a comment…"
                autoFocus={autoFocusInput}
                className="flex-1 rounded-2xl border border-border bg-input px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-ring"
              />
              <button className="rounded-2xl bg-brand-gradient px-3 text-xs font-semibold text-white">Post</button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Avatar({ src, name, size = 40 }: { src?: string | null; name: string; size?: number }) {
  if (src) {
    return <img src={src} alt={name} width={size} height={size} className="rounded-full object-cover bg-secondary" style={{ width: size, height: size }} />;
  }
  return (
    <div className="rounded-full bg-brand-gradient grid place-items-center text-white font-bold" style={{ width: size, height: size, fontSize: size * 0.4 }}>
      {name.slice(0, 1).toUpperCase()}
    </div>
  );
}
