import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_app/profile")({
  beforeLoad: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw redirect({ to: "/login" });
    const { data: prof } = await supabase.from("profiles").select("username").eq("id", session.user.id).maybeSingle();
    if (prof?.username) throw redirect({ to: "/u/$username", params: { username: prof.username } });
    throw redirect({ to: "/home" });
  },
});
