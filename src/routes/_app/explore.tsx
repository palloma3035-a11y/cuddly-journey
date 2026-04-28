import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Search } from "lucide-react";
import { Avatar } from "@/components/PostCard";
import { PostViewer } from "@/components/PostViewer";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/explore")({ component: Explore });

type Profile = { id: string; username: string; display_name: string | null; avatar_url: string | null; bio: string | null };
type GridPost = { id: string; media_url: string; media_type: string };

function Explore() {
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const [users, setUsers] = useState<Profile[]>([]);
  const [trending, setTrending] = useState<GridPost[]>([]);
  const [following, setFollowing] = useState<Set<string>>(new Set());
  const [openPostId, setOpenPostId] = useState<string | null>(null);

  useEffect(() => {
    supabase.from("posts").select("id, media_url, media_type").order("created_at", { ascending: false }).limit(30)
      .then(({ data }) => setTrending((data as any) ?? []));
  }, []);

  useEffect(() => {
    if (!user) return;
    supabase.from("follows").select("following_id").eq("follower_id", user.id)
      .then(({ data }) => setFollowing(new Set((data ?? []).map((d: any) => d.following_id))));
  }, [user]);

  useEffect(() => {
    const t = setTimeout(async () => {
      if (!q.trim()) return setUsers([]);
      const { data } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url, bio")
        .or(`username.ilike.%${q}%,display_name.ilike.%${q}%`)
        .limit(20);
      setUsers((data as any) ?? []);
    }, 200);
    return () => clearTimeout(t);
  }, [q]);

  const toggleFollow = async (targetId: string) => {
    if (!user || targetId === user.id) return;
    if (following.has(targetId)) {
      await supabase.from("follows").delete().eq("follower_id", user.id).eq("following_id", targetId);
      setFollowing((s) => { const n = new Set(s); n.delete(targetId); return n; });
    } else {
      const { error } = await supabase.from("follows").insert({ follower_id: user.id, following_id: targetId });
      if (error) return toast.error(error.message);
      setFollowing((s) => new Set(s).add(targetId));
    }
  };

  return (
    <div className="space-y-6">
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search HopOn"
          className="w-full rounded-2xl border border-border bg-card pl-11 pr-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {q.trim() && (
        <section className="space-y-2">
          <h2 className="px-1 text-sm font-semibold text-muted-foreground">People</h2>
          {users.length === 0 ? (
            <p className="text-sm text-muted-foreground">No users found.</p>
          ) : users.map((u) => (
            <div key={u.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
              <Link to="/u/$username" params={{ username: u.username }}><Avatar src={u.avatar_url} name={u.username} /></Link>
              <div className="flex-1 min-w-0">
                <Link to="/u/$username" params={{ username: u.username }} className="font-semibold text-sm hover:underline">{u.username}</Link>
                <p className="text-xs text-muted-foreground truncate">{u.display_name ?? u.bio ?? "On HopOn"}</p>
              </div>
              {user && u.id !== user.id && (
                <button
                  onClick={() => toggleFollow(u.id)}
                  className={`rounded-2xl px-4 py-1.5 text-xs font-semibold ${following.has(u.id) ? "bg-secondary" : "bg-brand-gradient text-white shadow-glow"}`}
                >
                  {following.has(u.id) ? "Following" : "Follow"}
                </button>
              )}
            </div>
          ))}
        </section>
      )}

      {!q.trim() && (
        <section>
          <h2 className="mb-3 px-1 text-sm font-semibold text-muted-foreground">Trending</h2>
          {trending.length === 0 ? (
            <p className="text-sm text-muted-foreground">No posts yet.</p>
          ) : (
            <div className="grid grid-cols-3 gap-1">
              {trending.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setOpenPostId(p.id)}
                  className="aspect-square overflow-hidden rounded-xl bg-secondary touch-manipulation transition active:scale-[0.98] hover:opacity-90"
                  aria-label="Open post"
                >
                  {p.media_type === "video" ? (
                    <video src={p.media_url} className="h-full w-full object-cover pointer-events-none" muted playsInline />
                  ) : (
                    <img src={p.media_url} alt="" className="h-full w-full object-cover pointer-events-none" loading="lazy" />
                  )}
                </button>
              ))}
            </div>
          )}
        </section>
      )}
      {openPostId && <PostViewer postId={openPostId} onClose={() => setOpenPostId(null)} />}
    </div>
  );
}
