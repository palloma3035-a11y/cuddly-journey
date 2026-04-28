import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { ImagePlus, Loader2, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/create")({ component: Create });

function Create() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const onPick = (f: File | null) => {
    setFile(f);
    if (f) setPreview(URL.createObjectURL(f));
    else setPreview(null);
  };

  const submit = async () => {
    if (!user || !file) return;
    setLoading(true);
    const ext = file.name.split(".").pop();
    const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("posts").upload(path, file, { upsert: false });
    if (upErr) { setLoading(false); return toast.error(upErr.message); }
    const { data: pub } = supabase.storage.from("posts").getPublicUrl(path);
    const media_type = file.type.startsWith("video") ? "video" : "image";
    const { error: insErr } = await supabase.from("posts").insert({
      user_id: user.id, media_url: pub.publicUrl, media_type, caption: caption.trim() || null,
    });
    setLoading(false);
    if (insErr) return toast.error(insErr.message);
    toast.success("Posted! 🎉");
    navigate({ to: "/home" });
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Create Post</h1>

      {!preview ? (
        <button
          onClick={() => inputRef.current?.click()}
          className="grid w-full place-items-center rounded-3xl border-2 border-dashed border-border bg-card/60 py-16 text-center hover:bg-card"
        >
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-brand-gradient shadow-glow">
            <ImagePlus className="h-8 w-8 text-white" />
          </div>
          <p className="mt-4 font-semibold">Tap to upload photo or video</p>
          <p className="text-xs text-muted-foreground">JPG, PNG, MP4 — up to 50MB</p>
        </button>
      ) : (
        <div className="relative overflow-hidden rounded-3xl border border-border bg-card">
          {file?.type.startsWith("video") ? (
            <video src={preview} controls className="w-full max-h-[480px] object-contain bg-black" />
          ) : (
            <img src={preview} alt="preview" className="w-full max-h-[480px] object-contain bg-black" />
          )}
          <button
            onClick={() => onPick(null)}
            className="absolute top-3 right-3 grid h-9 w-9 place-items-center rounded-full bg-black/60 text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <input ref={inputRef} type="file" accept="image/*,video/*" hidden onChange={(e) => onPick(e.target.files?.[0] ?? null)} />

      <textarea
        value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={2200}
        rows={3} placeholder="Write a caption…"
        className="w-full rounded-2xl border border-border bg-card p-4 text-sm outline-none focus:ring-2 focus:ring-ring resize-none"
      />
      <p className="text-right text-xs text-muted-foreground">{caption.length}/2200</p>

      <button
        disabled={!file || loading}
        onClick={submit}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-gradient py-3 text-sm font-semibold text-white shadow-glow disabled:opacity-50"
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />} Post
      </button>
    </div>
  );
}
