"use client"

import { type LucideIcon } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@thinkthroo/ui/components/sidebar"
import { useUmamiTracking } from "@/hooks/useUmamiTracking"

const REPO_TABS = [
  { label: "Agent",    value: "agent" },
  { label: "Issues",  value: "issues" },
  { label: "Skills",  value: "skills" },
  { label: "Settings", value: "settings" },
]

export function NavWorkspace({
  projects,
  label,
}: {
  projects: { name: string; url: string; icon?: LucideIcon; badge?: number }[]
  label: string
}) {
  const pathname = usePathname()
  const { isMobile } = useSidebar()
  const { trackEvent } = useUmamiTracking()

  // Match /repositories/[encodedRepo]/[tab] — tab is optional
  const repoMatch = pathname.match(/^\/repositories\/([^/]+)(?:\/([^/]*))?/)
  const encodedRepo = repoMatch?.[1] ?? null
  const currentTab = repoMatch?.[2] ?? null
  const decodedRepo = encodedRepo ? decodeURIComponent(encodedRepo) : null

  const handleNavClick = (itemName: string, url: string) => {
    trackEvent("sidebar_navigation", {
      item: itemName,
      url,
      section: label,
      device: isMobile ? "mobile" : "desktop",
    })
  }

  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel>{label}</SidebarGroupLabel>
      <SidebarMenu>
        {projects.map((item) => {
          const isRepositoriesItem = item.url === "/repositories"
          const isItemActive = isRepositoriesItem
            ? pathname.startsWith("/repositories")
            : pathname === item.url

          return (
            <SidebarMenuItem key={item.name}>
              <SidebarMenuButton asChild isActive={isItemActive}>
                <Link href={item.url} onClick={() => handleNavClick(item.name, item.url)}>
                  {item.icon && <item.icon />}
                  <span>{item.name}</span>
                  {!!item.badge && (
                    <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-medium text-primary-foreground">
                      {item.badge > 99 ? "99+" : item.badge}
                    </span>
                  )}
                </Link>
              </SidebarMenuButton>

              {/* Repository sub-nav — only when on a repo detail route */}
              {isRepositoriesItem && decodedRepo && encodedRepo && (
                <SidebarMenuSub>
                  {/* Repo name row */}
                  <SidebarMenuSubItem>
                    <SidebarMenuSubButton asChild isActive={false}>
                      <Link
                        href={`/repositories/${encodedRepo}/issues`}
                        onClick={() => handleNavClick(decodedRepo, `/repositories/${encodedRepo}/issues`)}
                      >
                        <span className="truncate max-w-[140px] font-medium" title={decodedRepo}>
                          {decodedRepo}
                        </span>
                      </Link>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>

                  {/* Tab items — indented another level */}
                  {REPO_TABS.map((tab) => (
                    <SidebarMenuSubItem key={tab.value} className="ml-3">
                      <SidebarMenuSubButton
                        asChild
                        isActive={currentTab === tab.value}
                      >
                        <Link
                          href={`/repositories/${encodedRepo}/${tab.value}`}
                          onClick={() => handleNavClick(tab.label, `/repositories/${encodedRepo}/${tab.value}`)}
                        >
                          {tab.label}
                        </Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  ))}
                </SidebarMenuSub>
              )}
            </SidebarMenuItem>
          )
        })}
      </SidebarMenu>
    </SidebarGroup>
  )
}
