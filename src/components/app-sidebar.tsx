import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Package,
  ArrowDownToLine,
  ArrowUpFromLine,
  History,
  AlertTriangle,
  Grid3x3,
  TrendingUp,
  ClipboardCheck,
  Barcode,
  Settings,
  ClipboardList,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useAuth, type AppRole } from "@/hooks/use-auth";

type Item = {
  title: string;
  url: string;
  icon: typeof LayoutDashboard;
  roles: AppRole[];
};

const ALL: AppRole[] = ["admin", "estoquista", "leitor"];

const items: Item[] = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard, roles: ALL },
  { title: "Produtos", url: "/produtos", icon: Package, roles: ALL },
  { title: "Entradas", url: "/entradas", icon: ArrowDownToLine, roles: ["admin", "estoquista"] },
  { title: "Saídas", url: "/saidas", icon: ArrowUpFromLine, roles: ["admin", "estoquista"] },
  { title: "Leitura rápida", url: "/scan", icon: Barcode, roles: ["admin", "estoquista"] },
  { title: "Movimentações", url: "/movimentacoes", icon: History, roles: ALL },
  { title: "Mapa", url: "/mapa", icon: Grid3x3, roles: ALL },
  { title: "Relatório", url: "/relatorio", icon: TrendingUp, roles: ALL },
  { title: "Inventário", url: "/inventario", icon: ClipboardCheck, roles: ALL },
  { title: "Alertas", url: "/alertas", icon: AlertTriangle, roles: ALL },
  { title: "Configurações", url: "/configuracoes", icon: Settings, roles: ALL },
];

export function AppSidebar() {
  const path = useRouterState({ select: (r) => r.location.pathname });
  const { role } = useAuth();
  const visible = items.filter((i) => !role || i.roles.includes(role));

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="px-3 py-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground font-semibold">
            X
          </div>
          <div className="flex flex-col leading-tight group-data-[collapsible=icon]:hidden">
            <span className="text-sm font-semibold">Xica Estoque</span>
            <span className="text-xs text-muted-foreground">Controle de insumos</span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Operação</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visible.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={path === item.url}>
                    <Link to={item.url} className="flex items-center gap-2">
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
