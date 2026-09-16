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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
      <SidebarHeader className="border-b border-sidebar-border px-2 py-2.5">
        <div className="flex min-w-0 items-center gap-3 px-1 py-1">
          <div className="grid size-8 shrink-0 place-items-center rounded-sm bg-sidebar-primary text-sidebar-primary-foreground">
            <BrandIcon className="size-[17px]" aria-hidden="true" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold leading-tight text-sidebar-foreground">
                {WORKSPACE_PLACEHOLDER.name}
              </p>
              <p className="mt-0.5 truncate font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                {WORKSPACE_PLACEHOLDER.plan}
              </p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="gap-0 py-2">
        {NAV_GROUPS.map((group, groupIndex) => (
          <SidebarGroup
            key={group.label}
            className={groupIndex === 0 ? "px-2 py-2" : "mx-2 w-auto border-t border-sidebar-border px-0 py-3"}
          >
            <SidebarGroupLabel className="h-7 px-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {group.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-0.5">
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive(item.to)}
                      tooltip={item.title}
                      className="h-9 gap-3 rounded-sm px-2.5 text-[13px] data-[active=true]:border data-[active=true]:border-sidebar-border data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground data-[active=true]:shadow-[inset_2px_0_0_var(--sidebar-primary)] data-[active=true]:[&>svg]:text-sidebar-primary hover:[&>svg]:text-sidebar-primary group-data-[collapsible=icon]:!size-9 group-data-[collapsible=icon]:!p-2.5"
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

      <SidebarFooter className="gap-2 border-t border-sidebar-border p-2.5">
        <div className="flex min-w-0 items-center gap-3 px-0.5 py-1">
          <Avatar className="size-8 rounded-sm border border-sidebar-border">
            <AvatarFallback className="rounded-sm bg-sidebar-accent font-mono text-[11px] text-sidebar-accent-foreground">
              {USER_PLACEHOLDER.initials}
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium leading-tight text-sidebar-foreground">
                {USER_PLACEHOLDER.name}
              </p>
              <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                {USER_PLACEHOLDER.email}
              </p>
            </div>
          )}
        </div>
        {!collapsed && (
          <div className="px-0.5">
            <StatusBadge tone={CONNECTION_PLACEHOLDER.tone} className="w-full justify-start">
              {CONNECTION_PLACEHOLDER.label}
            </StatusBadge>
          </div>
        )}
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
