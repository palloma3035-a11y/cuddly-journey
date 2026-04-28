ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;

DROP POLICY IF EXISTS "messages_update_receiver_read" ON public.messages;
CREATE POLICY "messages_update_receiver_read"
ON public.messages
FOR UPDATE
USING (auth.uid() = receiver_id)
WITH CHECK (auth.uid() = receiver_id);

ALTER TABLE public.messages REPLICA IDENTITY FULL;