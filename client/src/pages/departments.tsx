import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { enterpriseApi, type Department } from "@/lib/enterprise-api";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Building2, Plus, Pencil, Trash2, Briefcase, TicketCheck, Users, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const DEPT_COLORS = [
  "bg-blue-100 text-blue-800 border-blue-200",
  "bg-purple-100 text-purple-800 border-purple-200",
  "bg-green-100 text-green-800 border-green-200",
  "bg-orange-100 text-orange-800 border-orange-200",
  "bg-pink-100 text-pink-800 border-pink-200",
  "bg-teal-100 text-teal-800 border-teal-200",
  "bg-indigo-100 text-indigo-800 border-indigo-200",
  "bg-amber-100 text-amber-800 border-amber-200",
];

function colorFor(id: number) { return DEPT_COLORS[id % DEPT_COLORS.length]; }

interface DeptFormData { name: string; description: string; headCount: string }
const EMPTY: DeptFormData = { name: "", description: "", headCount: "0" };

function DeptDialog({ open, onOpenChange, dept }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  dept: Department | null;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [form, setForm] = React.useState<DeptFormData>(EMPTY);

  React.useEffect(() => {
    if (dept) {
      setForm({ name: dept.name, description: dept.description ?? "", headCount: String(dept.headCount) });
    } else {
      setForm(EMPTY);
    }
  }, [dept, open]);

  const createMut = useMutation({
    mutationFn: (d: DeptFormData) =>
      enterpriseApi.departments.create({ name: d.name.trim(), description: d.description.trim() || undefined, headCount: parseInt(d.headCount) || 0 }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["departments"] }); onOpenChange(false); toast({ title: "Department created" }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateMut = useMutation({
    mutationFn: (d: DeptFormData) =>
      enterpriseApi.departments.update(dept!.id, { name: d.name.trim(), description: d.description.trim() || undefined, headCount: parseInt(d.headCount) || 0 }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["departments"] }); onOpenChange(false); toast({ title: "Department updated" }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const busy = createMut.isPending || updateMut.isPending;

  function submit() {
    if (!form.name.trim()) return;
    if (dept) updateMut.mutate(form);
    else createMut.mutate(form);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{dept ? "Edit Department" : "New Department"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label>Name <span className="text-red-500">*</span></Label>
            <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Engineering" />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Optional description" rows={2} />
          </div>
          <div>
            <Label>Approved Head Count</Label>
            <Input type="number" min={0} value={form.headCount} onChange={e => setForm(f => ({ ...f, headCount: e.target.value }))} placeholder="0" />
            <p className="text-xs text-muted-foreground mt-1">Total approved seats for this department</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={busy || !form.name.trim()}>
            {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {dept ? "Save Changes" : "Create Department"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function DepartmentsPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Department | null>(null);
  const [deletingId, setDeletingId] = React.useState<number | null>(null);

  const { data: departments = [], isLoading } = useQuery({
    queryKey: ["departments"],
    queryFn: () => enterpriseApi.departments.list(),
  });

  const { data: breakdown = [] } = useQuery({
    queryKey: ["dept-breakdown"],
    queryFn: () => enterpriseApi.departments.breakdown(),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => enterpriseApi.departments.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["departments"] }); qc.invalidateQueries({ queryKey: ["dept-breakdown"] }); setDeletingId(null); toast({ title: "Department deleted" }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const breakdownMap = Object.fromEntries(breakdown.map(b => [b.id, b]));

  function openCreate() { setEditing(null); setDialogOpen(true); }
  function openEdit(d: Department) { setEditing(d); setDialogOpen(true); }

  return (
    <Layout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Building2 className="w-6 h-6 text-primary" /> Departments
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Manage your organisation's departments and track hiring by team</p>
        </div>
        <Button onClick={openCreate}><Plus className="w-4 h-4 mr-2" /> Add Department</Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-48"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : departments.length === 0 ? (
        <div className="rounded-xl border border-dashed p-16 text-center text-muted-foreground">
          <Building2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No departments yet</p>
          <p className="text-sm mt-1">Create departments to track hiring by team and generate department-wise analytics</p>
          <Button className="mt-4" onClick={openCreate}><Plus className="w-4 h-4 mr-2" /> Add First Department</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {departments.map(dept => {
            const stats = breakdownMap[dept.id];
            const open = stats?.openPositions ?? 0;
            const total = stats?.totalPositions ?? 0;
            const jds = stats?.jobDescriptions ?? 0;
            const hc = dept.headCount;
            const fillPct = hc > 0 ? Math.round(((hc - open) / hc) * 100) : null;

            return (
              <div key={dept.id} className="rounded-xl border border-border bg-card shadow-sm p-5 flex flex-col gap-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <span className={cn("w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold border", colorFor(dept.id))}>
                      {dept.name.charAt(0).toUpperCase()}
                    </span>
                    <div>
                      <p className="font-semibold text-sm">{dept.name}</p>
                      {dept.description && <p className="text-xs text-muted-foreground line-clamp-1">{dept.description}</p>}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => openEdit(dept)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="w-7 h-7 text-red-500 hover:text-red-700 hover:bg-red-50"
                      onClick={() => setDeletingId(dept.id)} disabled={deleteMut.isPending && deletingId === dept.id}>
                      {deleteMut.isPending && deletingId === dept.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg bg-muted/50 p-2">
                    <div className="flex items-center justify-center gap-1 text-muted-foreground mb-0.5"><TicketCheck className="w-3 h-3" /></div>
                    <p className="text-lg font-bold">{open}</p>
                    <p className="text-xs text-muted-foreground">Open</p>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-2">
                    <div className="flex items-center justify-center gap-1 text-muted-foreground mb-0.5"><Briefcase className="w-3 h-3" /></div>
                    <p className="text-lg font-bold">{jds}</p>
                    <p className="text-xs text-muted-foreground">JDs</p>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-2">
                    <div className="flex items-center justify-center gap-1 text-muted-foreground mb-0.5"><Users className="w-3 h-3" /></div>
                    <p className="text-lg font-bold">{hc}</p>
                    <p className="text-xs text-muted-foreground">Head Count</p>
                  </div>
                </div>

                {hc > 0 && (
                  <div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                      <span>Capacity utilisation</span>
                      <span>{fillPct}%</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className={cn("h-full rounded-full transition-all", open > hc ? "bg-red-500" : open > hc * 0.75 ? "bg-amber-500" : "bg-green-500")}
                        style={{ width: `${Math.min(100, (open / hc) * 100)}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{open} open of {hc} approved seats</p>
                  </div>
                )}

                {stats && total > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {Object.entries(stats.statusBreakdown).map(([status, count]) => (
                      <Badge key={status} variant="outline" className="text-xs">{status}: {count}</Badge>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <DeptDialog open={dialogOpen} onOpenChange={setDialogOpen} dept={editing} />

      <Dialog open={deletingId !== null} onOpenChange={v => !v && setDeletingId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete Department?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Positions and job descriptions linked to this department will be unlinked but not deleted.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deletingId && deleteMut.mutate(deletingId)} disabled={deleteMut.isPending}>
              {deleteMut.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
