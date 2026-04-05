import * as React from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { enterpriseApi, type WorkloadSummary, SLA_BADGE, TICKET_STATUSES } from "@/lib/enterprise-api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, BarChart2, AlertTriangle, CheckCircle, Clock, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Layout } from "@/components/layout";

const STATUS_COLORS: Record<string, string> = {
  Draft: "bg-gray-100 text-gray-600",
  Open: "bg-blue-100 text-blue-700",
  Sourcing: "bg-purple-100 text-purple-700",
  Screening: "bg-yellow-100 text-yellow-700",
  Interviewing: "bg-orange-100 text-orange-700",
  Offer: "bg-green-100 text-green-700",
  Closed: "bg-slate-100 text-slate-500",
};

export default function TicketsWorkloadPage() {
  const { data, isLoading } = useQuery<WorkloadSummary>({
    queryKey: ["tickets-workload"],
    queryFn: () => enterpriseApi.tickets.workload(),
  });

  if (isLoading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>;
  if (!data) return null;

  const maxTickets = Math.max(...data.workload.map(w => w.tickets.length), 1);

  return (
    <Layout>
    <div className="w-full space-y-6">
      <div className="flex items-center gap-2">
        <Link href="/tickets"><Button variant="ghost" size="sm" className="gap-1"><ArrowLeft className="w-4 h-4" /> Board</Button></Link>
        <BarChart2 className="w-5 h-5 text-blue-600" />
        <h1 className="text-xl font-bold text-gray-900">Recruiter Workload</h1>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Total Positions" value={data.totalTickets} icon={<BarChart2 className="w-5 h-5 text-blue-500" />} />
        <StatCard label="Active Positions" value={data.openTickets} icon={<Clock className="w-5 h-5 text-orange-500" />} />
        <StatCard
          label="SLA Breaches"
          value={data.workload.reduce((s, w) => s + w.breached, 0)}
          icon={<AlertTriangle className="w-5 h-5 text-red-500" />}
          highlight="red"
        />
        <StatCard
          label="On Track"
          value={data.workload.reduce((s, w) => s + w.ok, 0)}
          icon={<CheckCircle className="w-5 h-5 text-green-500" />}
          highlight="green"
        />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-800">Status Breakdown</h2>
        </div>
        <div className="p-5">
          <div className="flex flex-wrap gap-2">
            {TICKET_STATUSES.map(s => (
              <div key={s} className={cn("flex items-center gap-2 rounded-lg px-3 py-2", STATUS_COLORS[s])}>
                <span className="text-sm font-medium">{s}</span>
                <span className="text-lg font-bold">{data.statusCounts[s] ?? 0}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800">By Recruiter / Assignee</h2>
        </div>
        <div className="p-5 space-y-4">
          {data.workload.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-8">No active assignments</p>
          )}
          {data.workload.map(row => {
            const total = row.tickets.length;
            const pct = Math.round((total / maxTickets) * 100);
            return (
              <div key={row.assignee} className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-gray-800 truncate max-w-xs">{row.assignee}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    {row.breached > 0 && (
                      <Badge className={cn("gap-1 text-xs", SLA_BADGE.breached.cls)}>
                        <AlertTriangle className="w-3 h-3" /> {row.breached} breached
                      </Badge>
                    )}
                    {row.warning > 0 && (
                      <Badge className={cn("gap-1 text-xs", SLA_BADGE.warning.cls)}>
                        <Clock className="w-3 h-3" /> {row.warning} at risk
                      </Badge>
                    )}
                    <span className="text-gray-500 text-xs font-medium">{total} ticket{total !== 1 ? "s" : ""}</span>
                  </div>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div
                    className={cn("h-2 rounded-full transition-all", row.breached > 0 ? "bg-red-500" : row.warning > 0 ? "bg-amber-400" : "bg-blue-500")}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="flex flex-wrap gap-1">
                  {row.tickets.slice(0, 8).map((t: { id: number; title: string; status: string; priority: string }) => (
                    <Link key={t.id} href={`/tickets/${t.id}`}>
                      <span className="text-xs bg-gray-100 hover:bg-blue-50 text-gray-600 hover:text-blue-700 rounded px-1.5 py-0.5 transition-colors cursor-pointer truncate max-w-[150px] inline-block">
                        {t.title}
                      </span>
                    </Link>
                  ))}
                  {row.tickets.length > 8 && <span className="text-xs text-gray-400">+{row.tickets.length - 8} more</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
    </Layout>
  );
}

function StatCard({ label, value, icon, highlight }: { label: string; value: number; icon: React.ReactNode; highlight?: string }) {
  return (
    <div className={cn("bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex items-center gap-3",
      highlight === "red" && value > 0 ? "border-red-200 bg-red-50" :
      highlight === "green" && value > 0 ? "border-green-200 bg-green-50" : "")}>
      <div className="shrink-0">{icon}</div>
      <div>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        <p className="text-xs text-gray-500">{label}</p>
      </div>
    </div>
  );
}
