import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PostCard, type FeedPost } from "@/components/PostCard";
import { StoryTray } from "@/components/StoryTray";
import { ImagePlus } from "lucide-react";

export const Route = createFileRoute("/_app/home")({ component: Home });

function Home() {
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const { data } = await supabase
      .from("posts")
      .select("id, user_id, media_url, media_type, caption, created_at, profiles!posts_user_id_fkey(username, display_name, avatar_url)")
      .order("created_at", { ascending: false })
      .limit(50);
    setPosts((data as any) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel("home-posts")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "posts" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        {[0, 1].map((i) => (
          <div key={i} className="rounded-3xl border border-border bg-card p-4 shadow-soft">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-secondary animate-pulse" />
              <div className="h-3 w-32 rounded bg-secondary animate-pulse" />
            </div>
            <div className="mt-3 h-80 rounded-2xl bg-secondary animate-pulse" />
          </div>
        ))}
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <>
        <StoryTray />
        <div className="rounded-3xl border border-border bg-card p-10 text-center shadow-soft">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-brand-gradient shadow-glow">
            <ImagePlus className="h-8 w-8 text-white" />
          </div>
          <h2 className="mt-4 text-xl font-bold">Your feed is quiet</h2>
          <p className="mt-1 text-sm text-muted-foreground">Be the first to share a moment on HopOn.</p>
          <Link to="/create" className="mt-5 inline-flex rounded-2xl bg-brand-gradient px-5 py-2.5 text-sm font-semibold text-white shadow-glow">
            Create a post
          </Link>
        </div>
      </>
    );
  }

  return (
    <div>
      <StoryTray />
      <div className="space-y-5">
        {posts.map((p) => <PostCard key={p.id} post={p} />)}
      </div>
    </div>
  );
}
