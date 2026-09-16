import { Link, useRouterState } from "@tanstack/react-router";

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
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { StatusBadge } from "@/components/ui/status-badge";
import { BRAND_ICON, NAV_GROUPS } from "@/components/layout/nav-items";
import {
  CONNECTION_PLACEHOLDER,
  USER_PLACEHOLDER,
  WORKSPACE_PLACEHOLDER,
} from "@/components/layout/shell-placeholders";

/**
 * Navegación principal de la aplicación.
 * Colapsable a franja de iconos en escritorio y deslizante en móvil.
 */
export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const isActive = (to: string) =>
    to === "/" ? pathname === "/" : pathname.startsWith(to);

  const BrandIcon = BRAND_ICON;

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex min-w-0 items-center gap-2.5 px-1 py-1.5">
          <div className="grid size-8 shrink-0 place-items-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
            <BrandIcon className="size-4" aria-hidden="true" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold leading-tight text-sidebar-foreground">
                {WORKSPACE_PLACEHOLDER.name}
              </p>
              <p className="truncate font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                {WORKSPACE_PLACEHOLDER.plan}
              </p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        {NAV_GROUPS.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel className="font-mono text-[10px] uppercase tracking-[0.12em]">
              {group.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive(item.to)}
                      tooltip={item.title}
                    >
                      <Link to={item.to}>
                        <item.icon aria-hidden="true" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <div className="flex min-w-0 items-center gap-2.5 px-1 py-1">
          <div className="grid size-8 shrink-0 place-items-center rounded-md border border-sidebar-border bg-sidebar-accent font-mono text-[11px] text-sidebar-accent-foreground">
            {USER_PLACEHOLDER.initials}
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm leading-tight text-sidebar-foreground">
                {USER_PLACEHOLDER.name}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {USER_PLACEHOLDER.email}
              </p>
            </div>
          )}
        </div>
        {!collapsed && (
          <div className="px-1 pb-1">
            <StatusBadge tone={CONNECTION_PLACEHOLDER.tone} className="w-full justify-center">
              {CONNECTION_PLACEHOLDER.label}
            </StatusBadge>
          </div>
        )}
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
