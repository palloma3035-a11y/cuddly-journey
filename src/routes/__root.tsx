import { Outlet, Link, createRootRouteWithContext, HeadContent, Scripts } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/lib/auth-context";
import { ThemeProvider } from "@/lib/theme";

import appCss from "../styles.css?url";

interface RouterContext { queryClient: QueryClient }

export const Route = createRootRouteWithContext<RouterContext>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "HopOn — Hop into what matters" },
      { name: "description", content: "HopOn is a modern social network. Discover, share, and connect with people and communities." },
      { name: "theme-color", content: "#0e0a18" },
      { property: "og:title", content: "HopOn — Hop into what matters" },
      { name: "twitter:title", content: "HopOn — Hop into what matters" },
      { property: "og:description", content: "HopOn is a modern social network. Discover, share, and connect with people and communities." },
      { name: "twitter:description", content: "HopOn is a modern social network. Discover, share, and connect with people and communities." },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/804d4e10-aa2c-4b72-ac71-ffb7a03267c1" },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/804d4e10-aa2c-4b72-ac71-ffb7a03267c1" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFound,
});

function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-black text-brand-gradient">404</h1>
        <h2 className="mt-3 text-xl font-semibold">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">This page doesn't exist or has hopped away.</p>
        <Link to="/" className="mt-6 inline-flex rounded-xl bg-brand-gradient px-5 py-2 text-sm font-semibold text-white shadow-glow">
          Go home
        </Link>
      </div>
    </div>
  );
}

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head><HeadContent /></head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <Outlet />
          <Toaster richColors position="top-center" />
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
