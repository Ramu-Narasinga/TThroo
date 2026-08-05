"use client";

import * as React from "react";
import {
  BookMarked,
  Bot,
  CreditCard,
  DollarSign,
  FlaskConical,
  Inbox,
  LayoutDashboard,
  MessageSquare,
  Server,
  Settings,
  SquareTerminal,
  Users,
  Users2,
} from "lucide-react";

import { NavProjects } from "@/components/nav-projects";
import { NavWorkspace } from "@/components/nav-workspace";
import { NavUser } from "@/components/nav-user";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
} from "@thinkthroo/ui/components/sidebar";
import { SidebarOptInForm } from "./tokens-usage";
import { OrgSwitcher } from "./org-switcher";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useUnreadInboxCount } from "@/hooks/useUnreadInboxCount";
import { JoinDiscordWidget } from "./join-discord-widget";

const data = {
  user: {
    name: "shadcn",
    email: "m@example.com",
    avatar: "/avatars/shadcn.jpg",
  },
  teams: [
    {
      name: "Acme Inc.",
      plan: "Free",
    },
  ],
  navMain: [
    {
      title: "ThinkThroo",
      url: "/codearc",
      icon: SquareTerminal,
      isActive: true,
      items: [
        {
          title: "Dashboard",
          url: "/dashboard",
          icon: LayoutDashboard,
        },
        {
          title: "Repositories",
          url: "/repositories",
          icon: BookMarked,
        },
        {
          title: "Subscription",
          url: "/subscription",
          icon: DollarSign,
        },
        {
          title: "Pricing",
          url: "/pricing",
          icon: CreditCard,
        },
      ],
    },
    {
      title: "Learn",
      url: "#",
      icon: Bot,
      isActive: true,
      items: [
        {
          title: "Codebase Architecture",
          url: "#",
          icon: BookMarked,
        },
        {
          title: "Production Grade Projects",
          url: "#",
          icon: BookMarked,
        },
        {
          title: "Challenges",
          url: "#",
          icon: BookMarked,
        },
        {
          title: "Leaderboard",
          url: "#",
          icon: BookMarked,
        },
      ],
    },
  ],
  navSecondary: [],
  workspace: [
    {
      name: "Inbox",
      url: "/inbox",
      icon: Inbox,
    },
    {
      name: "Repositories",
      url: "/repositories",
      icon: BookMarked,
    },
    {
      name: "Squad",
      url: "/squad",
      icon: Users2,
    },
    {
      name: "Runtime",
      url: "/runtime",
      icon: Server,
    },
    {
      name: "Analytics",
      url: "/analytics",
      icon: LayoutDashboard,
    },
  ],
  manage: [
    {
      name: "Integrations",
      url: "/integrations",
      icon: MessageSquare,
    },
    {
      name: "Organization Settings",
      url: "/organization-settings",
      icon: Settings,
    },
    {
      name: "Account",
      url: "/account",
      icon: Users,
    },
  ],
  account: [
    {
      name: "Billing",
      url: "/account/billing",
      icon: CreditCard,
    },
    {
      name: "Members",
      url: "/account/members",
      icon: Users,
    },
  ],
  learn: [
    {
      name: "Dashboard",
      url: "/learn/dashboard",
      icon: LayoutDashboard,
    },
    {
      name: "Codebase Architecture",
      url: "/architecture",
      icon: LayoutDashboard,
    },
    {
      name: "Production Grade Projects",
      url: "/production-grade-projects",
      icon: BookMarked,
    },
    {
      name: "Skills Library",
      url: "/skills-library",
      icon: BookMarked,
    },
  ],
  integrations: [
    {
      name: "Slack",
      url: "/integrations/slack",
      icon: MessageSquare,
    },
  ],
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  useCurrentUser()
  const unreadInboxCount = useUnreadInboxCount()
  const workspace = data.workspace.map((item) =>
    item.name === "Inbox" ? { ...item, badge: unreadInboxCount } : item
  )
  return (
    <Sidebar variant="inset" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <OrgSwitcher />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <NavWorkspace projects={workspace} label="Workspace" />
        <NavProjects projects={data.manage} label="Manage" />
        <NavProjects projects={data.learn} label="Learn" />
      </SidebarContent>

      <SidebarFooter>
        {/* <SidebarOptInForm /> */}
        <JoinDiscordWidget />
        <div className="flex items-center gap-2 px-2 py-1 text-xs text-muted-foreground">
          <FlaskConical className="h-3 w-3 shrink-0" />
          <span>Think Throo is in Beta</span>
        </div>
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  );
}