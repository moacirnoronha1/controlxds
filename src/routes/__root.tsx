import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider, useAuth, ROLE_LABEL } from "@/hooks/use-auth";
import { AuthGate } from "@/components/auth-gate";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";


import appCss from "../styles.css?url";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Xica Estoque" },
      { name: "description", content: "Sistema moderno de gestão de estoque para restaurante." },
      { property: "og:title", content: "Xica Estoque" },
      { name: "twitter:title", content: "Xica Estoque" },
      { property: "og:description", content: "Sistema moderno de gestão de estoque para restaurante." },
      { name: "twitter:description", content: "Sistema moderno de gestão de estoque para restaurante." },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/rogKivNCHNYEJs6bKcA2behu10x1/social-images/social-1785242708246-ChatGPT_Image_28_de_jul._de_2026,_10_44_53.webp" },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/rogKivNCHNYEJs6bKcA2behu10x1/social-images/social-1785242708246-ChatGPT_Image_28_de_jul._de_2026,_10_44_53.webp" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: RootShell,
  component: RootComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <HeadContent />
      </head>
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
      <AuthProvider>
        <AuthGate>
          <AppShell />
        </AuthGate>
        <Toaster richColors position="top-right" />
      </AuthProvider>
    </QueryClientProvider>
  );
}

function AppShell() {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center gap-3 border-b border-border px-4 sticky top-0 z-10 bg-background/80 backdrop-blur">
            <SidebarTrigger />
            <div className="text-sm text-muted-foreground hidden sm:block">GX Control</div>
            <div className="ml-auto">
              <UserMenu />
            </div>
          </header>
          <main className="flex-1 p-6 max-w-[1400px] w-full mx-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function UserMenu() {
  const { user, signOut } = useAuth();
  if (!user) return null;
  return (
    <div className="flex items-center gap-3">
      <div className="text-right leading-tight hidden sm:block">
        <div className="text-sm font-medium">{user.nome}</div>
        <div className="text-xs text-muted-foreground">{ROLE_LABEL[user.cargo]}</div>
      </div>
      <Button size="sm" variant="ghost" onClick={() => signOut()} title="Sair">
        <LogOut className="h-4 w-4" />
      </Button>
    </div>
  );
}


