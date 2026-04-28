-- Statuses (stories) table
CREATE TABLE public.statuses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  media_url TEXT NOT NULL,
  media_type TEXT NOT NULL DEFAULT 'image',
  caption TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '24 hours')
);
CREATE INDEX idx_statuses_user ON public.statuses (user_id);
CREATE INDEX idx_statuses_expires ON public.statuses (expires_at);

ALTER TABLE public.statuses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "statuses_read_active" ON public.statuses
  FOR SELECT USING (expires_at > now());

CREATE POLICY "statuses_insert_own" ON public.statuses
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "statuses_delete_own" ON public.statuses
  FOR DELETE USING (auth.uid() = user_id);

-- Status views
CREATE TABLE public.status_views (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  status_id UUID NOT NULL,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (status_id, user_id)
);
CREATE INDEX idx_status_views_status ON public.status_views (status_id);

ALTER TABLE public.status_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "status_views_read_all" ON public.status_views
  FOR SELECT USING (true);

CREATE POLICY "status_views_insert_own" ON public.status_views
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Status replies (also recorded in messages via trigger)
CREATE TABLE public.status_replies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  status_id UUID NOT NULL,
  sender_id UUID NOT NULL,
  recipient_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
CREATE INDEX idx_status_replies_status ON public.status_replies (status_id);

ALTER TABLE public.status_replies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "status_replies_read_own" ON public.status_replies
  FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

CREATE POLICY "status_replies_insert_own" ON public.status_replies
  FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- Mirror status replies into messages so they appear in the recipient's DM inbox
CREATE OR REPLACE FUNCTION public.mirror_status_reply_to_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.messages (sender_id, receiver_id, content)
  VALUES (NEW.sender_id, NEW.recipient_id, '↪ Replied to status: ' || NEW.content);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_mirror_status_reply
AFTER INSERT ON public.status_replies
FOR EACH ROW EXECUTE FUNCTION public.mirror_status_reply_to_message();

-- Storage bucket for status media
INSERT INTO storage.buckets (id, name, public) VALUES ('statuses', 'statuses', true);

CREATE POLICY "statuses_bucket_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'statuses');

CREATE POLICY "statuses_bucket_insert_own" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'statuses' AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "statuses_bucket_delete_own" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'statuses' AND auth.uid()::text = (storage.foldername(name))[1]
  );