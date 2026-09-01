import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Package,
  ArrowDownToLine,
  History,
  AlertTriangle,
  Grid3x3,
  TrendingUp,
  ClipboardCheck,
  Barcode,
  Settings,
  ClipboardList,
  Repeat,
  CalendarClock,
  Users,
  ShieldAlert,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useAuth, ROLE_LABEL, type AppRole } from "@/hooks/use-auth";


type Item = {
  title: string;
  url: string;
  icon: typeof LayoutDashboard;
  roles: AppRole[];
};

const ALL: AppRole[] = ["mestre", "estoquista", "lider", "requisitante"];
const OP: AppRole[] = ["mestre", "estoquista", "lider"];
const READ_OP: AppRole[] = ["mestre", "estoquista", "lider"];

const items: Item[] = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard, roles: READ_OP },
  { title: "Produtos", url: "/produtos", icon: Package, roles: READ_OP },
  { title: "Entradas", url: "/entradas", icon: ArrowDownToLine, roles: OP },
  { title: "Requisições", url: "/requisicoes", icon: ClipboardList, roles: ALL },
  { title: "Empréstimos", url: "/emprestimos", icon: Repeat, roles: READ_OP },
  
  { title: "Movimentações", url: "/movimentacoes", icon: History, roles: READ_OP },
  { title: "Mapa", url: "/mapa", icon: Grid3x3, roles: READ_OP },
  { title: "Validade e Custo", url: "/validade-custo", icon: CalendarClock, roles: READ_OP },
  { title: "Relatório", url: "/relatorio", icon: TrendingUp, roles: READ_OP },
  { title: "Inventário", url: "/inventario", icon: ClipboardCheck, roles: OP },
  { title: "Ajustes", url: "/ajustes", icon: SlidersHorizontal, roles: OP },
  { title: "Alertas", url: "/alertas", icon: AlertTriangle, roles: READ_OP },
  { title: "Avarias", url: "/avarias", icon: ShieldAlert, roles: READ_OP },
  { title: "Usuários", url: "/usuarios", icon: Users, roles: ["mestre"] },
  { title: "Configurações", url: "/configuracoes", icon: Settings, roles: ["mestre"] },
];

export function AppSidebar() {
  const path = useRouterState({ select: (r) => r.location.pathname });
  const { role, user } = useAuth();
  const visible = items.filter((i) => (role ? i.roles.includes(role) : false));

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="px-3 py-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground font-semibold">
            GX
          </div>
          <div className="flex flex-col leading-tight group-data-[collapsible=icon]:hidden">
            <span className="text-sm font-semibold">GX Control</span>
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
      {user && (
        <SidebarFooter className="border-t border-sidebar-border px-3 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sidebar-accent text-xs font-semibold uppercase">
              {user.nome.slice(0, 2)}
            </div>
            <div className="flex flex-col leading-tight min-w-0 group-data-[collapsible=icon]:hidden">
              <span className="text-xs font-medium truncate">Usuário: {user.nome}</span>
              <span className="text-xs text-muted-foreground truncate">
                Permissão: {ROLE_LABEL[user.cargo]}
              </span>
              {user.setor && (
                <span className="text-xs text-muted-foreground truncate">Setor: {user.setor}</span>
              )}
            </div>
          </div>
        </SidebarFooter>
      )}
    </Sidebar>
  );
}
