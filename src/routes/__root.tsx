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

import appCss from "../styles.css?url";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Xica Estoque — Controle de Insumos" },
      { name: "description", content: "Sistema moderno de gestão de estoque para restaurante." },
      { property: "og:title", content: "Xica Estoque — Controle de Insumos" },
      { name: "twitter:title", content: "Xica Estoque — Controle de Insumos" },
      { property: "og:description", content: "Sistema moderno de gestão de estoque para restaurante." },
      { name: "twitter:description", content: "Sistema moderno de gestão de estoque para restaurante." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/85109536-4d80-4747-b1fc-b9e12f3883b6/id-preview-c0bd0905--47dae23a-0d87-4931-ab4e-fc14a300d73f.lovable.app-1779317230607.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/85109536-4d80-4747-b1fc-b9e12f3883b6/id-preview-c0bd0905--47dae23a-0d87-4931-ab4e-fc14a300d73f.lovable.app-1779317230607.png" },
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
      <SidebarProvider>
        <div className="flex min-h-screen w-full bg-background">
          <AppSidebar />
          <div className="flex-1 flex flex-col min-w-0">
            <header className="h-14 flex items-center gap-3 border-b border-border px-4 sticky top-0 z-10 bg-background/80 backdrop-blur">
              <SidebarTrigger />
              <div className="text-sm text-muted-foreground">Xica Estoque</div>
            </header>
            <main className="flex-1 p-6 max-w-[1400px] w-full mx-auto">
              <Outlet />
            </main>
          </div>
        </div>
        <Toaster richColors position="top-right" />
      </SidebarProvider>
    </QueryClientProvider>
  );
}
