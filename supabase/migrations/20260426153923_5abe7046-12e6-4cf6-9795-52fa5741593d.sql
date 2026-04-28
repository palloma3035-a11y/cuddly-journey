
-- Profiles table (linked to auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  media_url TEXT NOT NULL,
  media_type TEXT NOT NULL DEFAULT 'image',
  caption TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX posts_user_idx ON public.posts(user_id);
CREATE INDEX posts_created_idx ON public.posts(created_at DESC);

CREATE TABLE public.likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, post_id)
);
CREATE INDEX likes_post_idx ON public.likes(post_id);

CREATE TABLE public.comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX comments_post_idx ON public.comments(post_id);

CREATE TABLE public.follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (follower_id, following_id),
  CHECK (follower_id <> following_id)
);
CREATE INDEX follows_following_idx ON public.follows(following_id);

CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX messages_pair_idx ON public.messages(sender_id, receiver_id, created_at DESC);

CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, -- recipient
  actor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'like' | 'comment' | 'follow'
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX notif_user_idx ON public.notifications(user_id, created_at DESC);

-- RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Profiles: public read, owner write
CREATE POLICY "profiles_read_all" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Posts: public read, owner write/delete
CREATE POLICY "posts_read_all" ON public.posts FOR SELECT USING (true);
CREATE POLICY "posts_insert_own" ON public.posts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "posts_update_own" ON public.posts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "posts_delete_own" ON public.posts FOR DELETE USING (auth.uid() = user_id);

-- Likes
CREATE POLICY "likes_read_all" ON public.likes FOR SELECT USING (true);
CREATE POLICY "likes_insert_own" ON public.likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "likes_delete_own" ON public.likes FOR DELETE USING (auth.uid() = user_id);

-- Comments
CREATE POLICY "comments_read_all" ON public.comments FOR SELECT USING (true);
CREATE POLICY "comments_insert_own" ON public.comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "comments_delete_own" ON public.comments FOR DELETE USING (auth.uid() = user_id);

-- Follows
CREATE POLICY "follows_read_all" ON public.follows FOR SELECT USING (true);
CREATE POLICY "follows_insert_own" ON public.follows FOR INSERT WITH CHECK (auth.uid() = follower_id);
CREATE POLICY "follows_delete_own" ON public.follows FOR DELETE USING (auth.uid() = follower_id);

-- Messages: only sender or receiver can see
CREATE POLICY "messages_read_own" ON public.messages FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);
CREATE POLICY "messages_insert_own" ON public.messages FOR INSERT WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "messages_delete_own" ON public.messages FOR DELETE USING (auth.uid() = sender_id);

-- Notifications: only recipient
CREATE POLICY "notif_read_own" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "notif_update_own" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "notif_insert_any_auth" ON public.notifications FOR INSERT WITH CHECK (auth.uid() = actor_id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  base_username TEXT;
  final_username TEXT;
  suffix INT := 0;
BEGIN
  base_username := COALESCE(
    NEW.raw_user_meta_data->>'username',
    split_part(COALESCE(NEW.email, 'user'), '@', 1)
  );
  base_username := regexp_replace(lower(base_username), '[^a-z0-9_]', '', 'g');
  IF base_username = '' THEN base_username := 'user'; END IF;
  final_username := base_username;
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = final_username) LOOP
    suffix := suffix + 1;
    final_username := base_username || suffix::text;
  END LOOP;

  INSERT INTO public.profiles (id, username, display_name, avatar_url)
  VALUES (
    NEW.id,
    final_username,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', final_username),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Notification triggers
CREATE OR REPLACE FUNCTION public.notify_on_like()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE owner UUID;
BEGIN
  SELECT user_id INTO owner FROM public.posts WHERE id = NEW.post_id;
  IF owner IS NOT NULL AND owner <> NEW.user_id THEN
    INSERT INTO public.notifications (user_id, actor_id, type, post_id)
    VALUES (owner, NEW.user_id, 'like', NEW.post_id);
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_like_created AFTER INSERT ON public.likes
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_like();

CREATE OR REPLACE FUNCTION public.notify_on_comment()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE owner UUID;
BEGIN
  SELECT user_id INTO owner FROM public.posts WHERE id = NEW.post_id;
  IF owner IS NOT NULL AND owner <> NEW.user_id THEN
    INSERT INTO public.notifications (user_id, actor_id, type, post_id)
    VALUES (owner, NEW.user_id, 'comment', NEW.post_id);
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_comment_created AFTER INSERT ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_comment();

CREATE OR REPLACE FUNCTION public.notify_on_follow()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.notifications (user_id, actor_id, type)
  VALUES (NEW.following_id, NEW.follower_id, 'follow');
  RETURN NEW;
END; $$;
CREATE TRIGGER on_follow_created AFTER INSERT ON public.follows
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_follow();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.likes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.comments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.posts;

-- Storage bucket for posts and avatars
INSERT INTO storage.buckets (id, name, public) VALUES ('posts', 'posts', true) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true) ON CONFLICT DO NOTHING;

CREATE POLICY "posts_bucket_read" ON storage.objects FOR SELECT USING (bucket_id IN ('posts','avatars'));
CREATE POLICY "posts_bucket_insert" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id IN ('posts','avatars') AND auth.uid()::text = (storage.foldername(name))[1]
);
CREATE POLICY "posts_bucket_update" ON storage.objects FOR UPDATE USING (
  bucket_id IN ('posts','avatars') AND auth.uid()::text = (storage.foldername(name))[1]
);
CREATE POLICY "posts_bucket_delete" ON storage.objects FOR DELETE USING (
  bucket_id IN ('posts','avatars') AND auth.uid()::text = (storage.foldername(name))[1]
);
