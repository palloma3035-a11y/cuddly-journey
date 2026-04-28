import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PostCard, type FeedPost } from "@/components/PostCard";

export function PostViewer({ postId, onClose }: { postId: string; onClose: () => void }) {
  const [post, setPost] = useState<FeedPost | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("posts")
        .select("id, user_id, media_url, media_type, caption, created_at, profiles(username, display_name, avatar_url)")
        .eq("id", postId)
        .maybeSingle();
      if (!cancelled) {
        setPost((data as any) ?? null);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [postId]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm grid place-items-center" role="dialog" aria-modal="true">
        <p className="text-sm text-white/80">Loading…</p>
      </div>
    );
  }
  if (!post) {
    return (
      <div
        className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm grid place-items-center"
        role="dialog"
        aria-modal="true"
        onClick={onClose}
      >
        <p className="text-sm text-white/80">Post not found.</p>
      </div>
    );
  }
  // PostCard renders its own full-screen modal when defaultOpen=true.
  // The hidden wrapper keeps the article off-screen so only the modal shows.
  return (
    <>
      <div className="sr-only" aria-hidden="true">
        <PostCard post={post} defaultOpen onCloseModal={onClose} />
      </div>
    </>
  );
}
