import * as React from "react";
import { Link, useLocation } from "wouter";
import { LayoutDashboard, FileText, History, BarChart3, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  const navItems = [
    { href: "/", label: "Analyzer", icon: FileText },
    { href: "/history", label: "History", icon: History },
    { href: "/stats", label: "Stats", icon: BarChart3 },
  ];

  return (
    <div className="min-h-screen w-full flex flex-col md:flex-row bg-background">
      <aside className="w-full md:w-64 border-r border-border bg-card flex flex-col z-10 shadow-sm relative">
        <div className="p-6 pb-4">
          <div className="flex items-center gap-2 mb-8">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground">
              <LayoutDashboard size={18} />
            </div>
            <span className="font-bold text-lg tracking-tight">MatchPoint</span>
          </div>

          <nav className="space-y-1">
            {navItems.map((item) => {
              const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
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
                    <span>{item.label}</span>
                  </div>
                  {isActive && <ChevronRight size={14} className="text-primary opacity-50" />}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="mt-auto p-6 text-xs text-muted-foreground">
          <p>MatchPoint v1.0</p>
          <p className="mt-1">Precision resume matching.</p>
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
