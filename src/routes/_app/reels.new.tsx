import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Film, Loader2, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/reels/new")({ component: NewReel });

const MAX_BYTES = 50 * 1024 * 1024;

function NewReel() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [audio, setAudio] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const onPick = (f: File | null) => {
    if (f && f.size > MAX_BYTES) {
      toast.error("Video must be under 50MB");
      return;
    }
    if (f && !f.type.startsWith("video")) {
      toast.error("Please choose a video file");
      return;
    }
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : null);
  };

  const submit = async () => {
    if (!user || !file) return;
    setLoading(true);
    const ext = file.name.split(".").pop() || "mp4";
    const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("reels").upload(path, file, { upsert: false, contentType: file.type });
    if (upErr) {
      setLoading(false);
      return toast.error(upErr.message);
    }
    const { data: pub } = supabase.storage.from("reels").getPublicUrl(path);
    const { error: insErr } = await supabase.from("reels").insert({
      user_id: user.id,
      video_url: pub.publicUrl,
      caption: caption.trim() || null,
      audio_label: audio.trim() || null,
    });
    setLoading(false);
    if (insErr) return toast.error(insErr.message);
    toast.success("Reel posted! 🎬");
    navigate({ to: "/reels" });
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">New Reel</h1>

      {!preview ? (
        <button
          onClick={() => inputRef.current?.click()}
          className="grid w-full place-items-center rounded-3xl border-2 border-dashed border-border bg-card/60 py-16 text-center hover:bg-card"
        >
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-brand-gradient shadow-glow">
            <Film className="h-8 w-8 text-white" />
          </div>
          <p className="mt-4 font-semibold">Tap to upload a vertical video</p>
          <p className="text-xs text-muted-foreground">MP4, MOV — up to 50MB · 9:16 recommended</p>
        </button>
      ) : (
        <div className="relative overflow-hidden rounded-3xl border border-border bg-black">
          <video src={preview} controls playsInline className="w-full max-h-[60vh] object-contain" />
          <button
            onClick={() => onPick(null)}
            className="absolute top-3 right-3 grid h-9 w-9 place-items-center rounded-full bg-black/60 text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="video/*"
        hidden
        onChange={(e) => onPick(e.target.files?.[0] ?? null)}
      />

      <textarea
        value={caption}
        onChange={(e) => setCaption(e.target.value)}
        maxLength={2200}
        rows={3}
        placeholder="Write a caption…"
        className="w-full rounded-2xl border border-border bg-card p-4 text-sm outline-none focus:ring-2 focus:ring-ring resize-none"
      />

      <input
        value={audio}
        onChange={(e) => setAudio(e.target.value)}
        maxLength={120}
        placeholder="Audio / track label (optional)"
        className="w-full rounded-2xl border border-border bg-card p-4 text-sm outline-none focus:ring-2 focus:ring-ring"
      />

      <button
        disabled={!file || loading}
        onClick={submit}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-gradient py-3 text-sm font-semibold text-white shadow-glow disabled:opacity-50"
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />} Share Reel
      </button>
    </div>
  );
}
