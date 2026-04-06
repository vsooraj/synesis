import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { UserPlus, Loader2, Users } from "lucide-react";
import { enterpriseApi, type AuthUser } from "@/lib/enterprise-api";
import { useAuth } from "@/context/auth";
import { useToast } from "@/hooks/use-toast";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const ROLE_COLORS: Record<string, string> = {
  super_admin: "bg-purple-100 text-purple-700",
  hr_admin: "bg-blue-100 text-blue-700",
  hiring_manager: "bg-teal-100 text-teal-700",
  recruiter: "bg-orange-100 text-orange-700",
  employee: "bg-gray-100 text-gray-700",
};

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  hr_admin: "HR Admin",
  hiring_manager: "Hiring Manager",
  recruiter: "Recruiter",
  employee: "Employee",
};

function InviteDialog({ onInvited }: { onInvited: () => void }) {
  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState({ email: "", name: "", password: "", role: "employee" });
  const [loading, setLoading] = React.useState(false);
  const { toast } = useToast();

  const submit = async () => {
    if (!form.email || !form.name || !form.password) { toast({ variant: "destructive", title: "All fields are required" }); return; }
    setLoading(true);
    try {
      await enterpriseApi.auth.invite(form);
      toast({ title: "User invited!", description: `${form.name} can now log in` });
      setOpen(false); setForm({ email: "", name: "", password: "", role: "employee" });
      onInvited();
    } catch (err) {
      toast({ variant: "destructive", title: "Invite failed", description: err instanceof Error ? err.message : "Error" });
    } finally { setLoading(false); }
  };

  const f = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(p => ({ ...p, [k]: e.target.value }));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button onClick={() => setOpen(true)}><UserPlus className="mr-2 h-4 w-4" />Invite User</Button>
      <DialogContent>
        <DialogHeader><DialogTitle>Invite Team Member</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Name</Label><Input value={form.name} onChange={f("name")} placeholder="Jane Smith" /></div>
          <div><Label>Email</Label><Input type="email" value={form.email} onChange={f("email")} placeholder="jane@company.com" /></div>
          <div><Label>Temporary Password</Label><Input type="password" value={form.password} onChange={f("password")} placeholder="Min. 8 characters" /></div>
          <div>
            <Label>Role</Label>
            <Select value={form.role} onValueChange={r => setForm(p => ({ ...p, role: r }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(ROLE_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>Cancel</Button>
            <Button onClick={submit} disabled={loading}>{loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Inviting...</> : "Send Invite"}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function UsersPage() {
  const { user: me } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["enterprise", "users"],
    queryFn: () => enterpriseApi.auth.users(),
  });

  const roleMutation = useMutation({
    mutationFn: ({ id, role }: { id: number; role: string }) => enterpriseApi.auth.updateRole(id, role),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["enterprise", "users"] }); toast({ title: "Role updated" }); },
    onError: (err) => toast({ variant: "destructive", title: "Failed", description: err.message }),
  });

  return (
    <Layout>
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Team Members</h1>
            <p className="text-muted-foreground mt-1">Manage users and roles in your organisation</p>
          </div>
          <InviteDialog onInvited={() => qc.invalidateQueries({ queryKey: ["enterprise", "users"] })} />
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
        ) : users.length === 0 ? (
          <Card><CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Users className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
            <p className="text-lg font-medium text-muted-foreground">No team members yet</p>
          </CardContent></Card>
        ) : (
          <Card>
            <CardHeader><CardTitle className="text-base">All Users ({users.length})</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Role</TableHead><TableHead>Joined</TableHead>
                  {me?.role === "super_admin" && <TableHead>Change Role</TableHead>}
                </TableRow></TableHeader>
                <TableBody>
                  {users.map((u: AuthUser) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">{u.name}{u.id === me?.id && <span className="ml-2 text-xs text-muted-foreground">(you)</span>}</TableCell>
                      <TableCell className="text-muted-foreground">{u.email}</TableCell>
                      <TableCell><Badge className={ROLE_COLORS[u.role] || ""}>{ROLE_LABELS[u.role] || u.role}</Badge></TableCell>
                      <TableCell className="text-muted-foreground">{new Date(u.createdAt).toLocaleDateString()}</TableCell>
                      {me?.role === "super_admin" && (
                        <TableCell>
                          {u.id !== me.id && (
                            <Select value={u.role} onValueChange={role => roleMutation.mutate({ id: u.id, role })}>
                              <SelectTrigger className="w-[150px] h-8"><SelectValue /></SelectTrigger>
                              <SelectContent>{Object.entries(ROLE_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
                            </Select>
                          )}
                        </TableCell>
                      )}
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
