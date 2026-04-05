import * as React from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard, FileText, History, BarChart3, ChevronRight,
  Users, Briefcase, Zap, ShieldCheck, LogOut, Building2, Search, TrendingUp, Bot, BookOpen, Webhook, TicketCheck, CalendarDays, Layers, Bell, HelpCircle, Book
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/auth";

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  roles?: string[];
}

const ENTERPRISE_ITEMS: NavItem[] = [
  { href: "/analyzer", label: "Analyzer", icon: FileText, roles: ["super_admin", "hr_admin", "recruiter", "hiring_manager"] },
  { href: "/history", label: "History", icon: History, roles: ["super_admin", "hr_admin", "recruiter", "hiring_manager"] },
  { href: "/stats", label: "Stats", icon: BarChart3, roles: ["super_admin", "hr_admin", "recruiter", "hiring_manager"] },
  { href: "/candidates", label: "Candidates", icon: Users },
  { href: "/jobs", label: "Job Descriptions", icon: Briefcase, roles: ["super_admin", "hr_admin", "hiring_manager"] },
  { href: "/bulk-jobs", label: "Bulk Analysis", icon: Zap, roles: ["super_admin", "hr_admin", "recruiter"] },
  { href: "/talent-search", label: "Talent Search", icon: Search, roles: ["super_admin", "hr_admin", "recruiter", "hiring_manager"] },
  { href: "/rag", label: "RAG Search", icon: BookOpen, roles: ["super_admin", "hr_admin", "recruiter", "hiring_manager"] },
  { href: "/analytics", label: "Analytics", icon: TrendingUp, roles: ["super_admin", "hr_admin", "hiring_manager"] },
  { href: "/agent", label: "AI Agent", icon: Bot, roles: ["super_admin", "hr_admin"] },
  { href: "/tickets", label: "Position Board", icon: TicketCheck, roles: ["super_admin", "hr_admin", "recruiter", "hiring_manager"] },
  { href: "/interviews", label: "Interviews", icon: CalendarDays, roles: ["super_admin", "hr_admin", "recruiter", "hiring_manager"] },
  { href: "/departments", label: "Departments", icon: Layers, roles: ["super_admin", "hr_admin"] },
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

  const currentItem = ENTERPRISE_ITEMS.find(item => item.href === location || (item.href !== "/analyzer" && location.startsWith(item.href)));
  const pageTitle = currentItem?.label || (location === "/login" ? "Login" : "Dashboard");

  return (
    <div className="min-h-screen w-full flex flex-col md:flex-row bg-background">
      <aside className="w-full md:w-64 border-r border-border bg-card flex flex-col z-10 shadow-sm relative shrink-0">
        <div className="p-5 pb-3 flex-1 overflow-y-auto">
          <div className="flex items-center gap-2 mb-6">
            <img src="/logo.png" alt="Synesis Logo" className="w-16 h-16 object-contain shrink-0" />
            <div>
              <span className="font-bold text-base tracking-tight block">Synesis</span>
              {user && <span className="text-xs text-muted-foreground">Enterprise</span>}
            </div>
          </div>

          {user && visibleEnterprise.length > 0 && (
            <>
              <div className="mb-2 px-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Enterprise Tools</p>
              </div>
              <nav className="space-y-0.5">
                {visibleEnterprise.map(item => <NavLink key={item.href} item={item} location={location} />)}
              </nav>
            </>
          )}
        </div>

        <div className="p-4 border-t border-border space-y-1 bg-muted/20">
          <Link
            href="/help"
            className="flex items-center gap-3 px-3 py-2.5 rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors group"
          >
            <HelpCircle size={18} className="text-muted-foreground group-hover:text-foreground transition-colors" />
            <span className="text-sm">Help & Support</span>
          </Link>
          <Link
            href="/manual"
            className="flex items-center gap-3 px-3 py-2.5 rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors group"
          >
            <Book size={18} className="text-muted-foreground group-hover:text-foreground transition-colors" />
            <span className="text-sm">User Manual</span>
          </Link>
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-[100dvh] overflow-hidden relative">
        <header className="h-14 lg:h-[60px] border-b border-border bg-card/80 backdrop-blur-xl flex items-center justify-between px-6 shrink-0 z-10">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Enterprise</span>
            <ChevronRight size={14} className="text-muted-foreground/50" />
            <span className="font-medium text-foreground">{pageTitle}</span>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative hidden md:block">
              <Search className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" />
              <input
                type="search"
                placeholder="Search across enterprise..."
                className="h-8 w-[200px] lg:w-[280px] rounded-md border border-input bg-background/50 pl-9 pr-3 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
            <button className="relative p-2 rounded-full hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground">
              <Bell size={18} />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500 ring-2 ring-card" />
            </button>

            <div className="h-6 w-[1px] bg-border mx-1 hidden md:block"></div>

            {user ? (
              <div className="flex items-center gap-3">
                <div className="hidden md:block text-right">
                  <p className="text-sm font-medium leading-none">{user.name}</p>
                  <p className="text-xs text-muted-foreground mt-1.5 leading-none">{user.role.replace(/_/g, " ")}</p>
                </div>
                <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold uppercase shrink-0">
                  {user.name.charAt(0)}
                </div>
                <button
                  onClick={logout}
                  className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors ml-1"
                  title="Sign out"
                >
                  <LogOut size={16} />
                </button>
              </div>
            ) : (
              <Link href="/login" className="text-sm font-medium text-primary hover:underline ml-2">Sign in</Link>
            )}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto w-full relative bg-slate-50/50">
          <div className="w-full h-full p-6 md:p-8">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
