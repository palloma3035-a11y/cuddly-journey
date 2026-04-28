import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/messages")({
  component: MessagesLayout,
});

function MessagesLayout() {
  return <Outlet />;
}
