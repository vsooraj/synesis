import * as React from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard, FileText, History, BarChart3, ChevronRight,
  Users, Briefcase, Zap, ShieldCheck, LogOut, Building2, Search, TrendingUp, Bot, BookOpen, Webhook, TicketCheck, CalendarDays
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/auth";

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  roles?: string[];
}

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Analyzer", icon: FileText },
  { href: "/history", label: "History", icon: History },
  { href: "/stats", label: "Stats", icon: BarChart3 },
];

const ENTERPRISE_ITEMS: NavItem[] = [
  { href: "/candidates", label: "Candidates", icon: Users },
  { href: "/jobs", label: "Job Descriptions", icon: Briefcase, roles: ["super_admin", "hr_admin", "hiring_manager"] },
  { href: "/bulk-jobs", label: "Bulk Analysis", icon: Zap, roles: ["super_admin", "hr_admin", "recruiter"] },
  { href: "/talent-search", label: "Talent Search", icon: Search, roles: ["super_admin", "hr_admin", "recruiter", "hiring_manager"] },
  { href: "/rag", label: "RAG Search", icon: BookOpen, roles: ["super_admin", "hr_admin", "recruiter", "hiring_manager"] },
  { href: "/analytics", label: "Analytics", icon: TrendingUp, roles: ["super_admin", "hr_admin", "hiring_manager"] },
  { href: "/agent", label: "AI Agent", icon: Bot, roles: ["super_admin", "hr_admin"] },
  { href: "/tickets", label: "Position Board", icon: TicketCheck, roles: ["super_admin", "hr_admin", "recruiter", "hiring_manager"] },
  { href: "/interviews", label: "Interviews", icon: CalendarDays, roles: ["super_admin", "hr_admin", "recruiter", "hiring_manager"] },
  { href: "/integrations", label: "Integrations", icon: Webhook, roles: ["super_admin", "hr_admin"] },
  { href: "/users", label: "Team", icon: Building2, roles: ["super_admin", "hr_admin"] },
  { href: "/audit-log", label: "Audit Log", icon: ShieldCheck, roles: ["super_admin", "hr_admin"] },
];

function NavLink({ item, location }: { item: NavItem; location: string }) {
  const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={cn(
        "flex items-center justify-between px-3 py-2.5 rounded-md transition-all group",
        isActive
          ? "bg-primary/10 text-primary font-medium"
          : "text-muted-foreground hover:bg-secondary hover:text-foreground"
      )}
    >
      <div className="flex items-center gap-3">
        <Icon size={18} className={cn("transition-colors", isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
        <span className="text-sm">{item.label}</span>
      </div>
      {isActive && <ChevronRight size={14} className="text-primary opacity-50" />}
    </Link>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user, logout } = useAuth();

  const visibleEnterprise = ENTERPRISE_ITEMS.filter(item =>
    !item.roles || (user && item.roles.includes(user.role))
  );

  return (
    <div className="min-h-screen w-full flex flex-col md:flex-row bg-background">
      <aside className="w-full md:w-64 border-r border-border bg-card flex flex-col z-10 shadow-sm relative">
        <div className="p-5 pb-3 flex-1 overflow-y-auto">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground">
              <LayoutDashboard size={18} />
            </div>
            <div>
              <span className="font-bold text-base tracking-tight block">MatchPoint</span>
              {user && <span className="text-xs text-muted-foreground">Enterprise</span>}
            </div>
          </div>

          <nav className="space-y-0.5">
            {NAV_ITEMS.map(item => <NavLink key={item.href} item={item} location={location} />)}
          </nav>

          {user && visibleEnterprise.length > 0 && (
            <>
              <div className="mt-4 mb-2 px-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Enterprise</p>
              </div>
              <nav className="space-y-0.5">
                {visibleEnterprise.map(item => <NavLink key={item.href} item={item} location={location} />)}
              </nav>
            </>
          )}
        </div>

        <div className="p-4 border-t border-border">
          {user ? (
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{user.name}</p>
                <p className="text-xs text-muted-foreground truncate">{user.role.replace(/_/g, " ")}</p>
              </div>
              <button
                onClick={logout}
                className="ml-2 p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                title="Sign out"
              >
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <div className="text-xs text-muted-foreground">
              <p>MatchPoint Enterprise</p>
              <Link href="/login" className="text-primary hover:underline mt-1 block">Sign in for enterprise features</Link>
            </div>
          )}
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-[100dvh] overflow-hidden">
        <div className="flex-1 overflow-y-auto w-full relative">
          <div className="max-w-6xl mx-auto p-4 md:p-8 lg:p-10">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
