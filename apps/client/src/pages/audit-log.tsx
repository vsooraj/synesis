import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { ShieldCheck, Loader2 } from "lucide-react";
import { enterpriseApi, type AuditEntry } from "@/lib/enterprise-api";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const ACTION_COLORS: Record<string, string> = {
  REGISTER: "bg-green-100 text-green-700",
  LOGIN: "bg-blue-100 text-blue-700",
  INVITE_USER: "bg-teal-100 text-teal-700",
  UPDATE_ROLE: "bg-orange-100 text-orange-700",
  UPLOAD_RESUME: "bg-purple-100 text-purple-700",
  DELETE_RESUME: "bg-red-100 text-red-700",
  CREATE_JD: "bg-indigo-100 text-indigo-700",
  UPDATE_JD: "bg-yellow-100 text-yellow-700",
  DELETE_JD: "bg-red-100 text-red-700",
  SUBMIT_BULK_JOB: "bg-cyan-100 text-cyan-700",
};

export default function AuditLogPage() {
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["enterprise", "audit-log"],
    queryFn: () => enterpriseApi.auditLog.list(200),
    refetchInterval: 30000,
  });

  return (
    <Layout>
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Audit Log</h1>
          <p className="text-muted-foreground mt-1">Immutable record of all AI-assisted actions in your organisation</p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
        ) : logs.length === 0 ? (
          <Card><CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <ShieldCheck className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
            <p className="text-lg font-medium text-muted-foreground">No audit entries yet</p>
          </CardContent></Card>
        ) : (
          <Card>
            <CardHeader><CardTitle className="text-base">Recent Actions ({logs.length})</CardTitle></CardHeader>
            <CardContent className="p-0 overflow-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Time</TableHead><TableHead>Action</TableHead><TableHead>Entity</TableHead><TableHead>User</TableHead><TableHead>Detail</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {logs.map((entry: AuditEntry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{new Date(entry.createdAt).toLocaleString()}</TableCell>
                      <TableCell><Badge className={ACTION_COLORS[entry.action] || "bg-gray-100 text-gray-700"} variant="secondary">{entry.action}</Badge></TableCell>
                      <TableCell className="text-sm">{entry.entityType}{entry.entityId ? ` #${entry.entityId}` : ""}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{entry.userId ? `User #${entry.userId}` : "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{entry.detail ? JSON.stringify(entry.detail) : "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
