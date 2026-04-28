-- Reels table
CREATE TABLE public.reels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  video_url TEXT NOT NULL,
  thumbnail_url TEXT,
  caption TEXT,
  audio_label TEXT,
  views BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_reels_created_at ON public.reels (created_at DESC);
CREATE INDEX idx_reels_user_id ON public.reels (user_id);

ALTER TABLE public.reels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reels_read_all" ON public.reels FOR SELECT USING (true);
CREATE POLICY "reels_insert_own" ON public.reels FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "reels_update_own" ON public.reels FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "reels_delete_own" ON public.reels FOR DELETE USING (auth.uid() = user_id);

-- Reel likes
CREATE TABLE public.reel_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reel_id UUID NOT NULL,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (reel_id, user_id)
);
CREATE INDEX idx_reel_likes_reel_id ON public.reel_likes (reel_id);

ALTER TABLE public.reel_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reel_likes_read_all" ON public.reel_likes FOR SELECT USING (true);
CREATE POLICY "reel_likes_insert_own" ON public.reel_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "reel_likes_delete_own" ON public.reel_likes FOR DELETE USING (auth.uid() = user_id);

-- Reel comments
CREATE TABLE public.reel_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reel_id UUID NOT NULL,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_reel_comments_reel_id ON public.reel_comments (reel_id);

ALTER TABLE public.reel_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reel_comments_read_all" ON public.reel_comments FOR SELECT USING (true);
CREATE POLICY "reel_comments_insert_own" ON public.reel_comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "reel_comments_delete_own" ON public.reel_comments FOR DELETE USING (auth.uid() = user_id);

-- View counter function
CREATE OR REPLACE FUNCTION public.increment_reel_view(reel_uuid UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.reels SET views = views + 1 WHERE id = reel_uuid;
END;
$$;

-- Storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('reels', 'reels', true);

CREATE POLICY "reels_bucket_read" ON storage.objects FOR SELECT USING (bucket_id = 'reels');
CREATE POLICY "reels_bucket_insert" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'reels' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "reels_bucket_delete" ON storage.objects FOR DELETE
  USING (bucket_id = 'reels' AND auth.uid()::text = (storage.foldername(name))[1]);